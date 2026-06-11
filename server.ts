import { toggleLike, addComment, getPostEngagement, toggleFollow, getFollowStats } from './interactionsController';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { registerUser, loginUser } from './authController';
import { updateUserRestriction, getFlaggedAccounts } from './moderationController';
import { getDatabase } from './db';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, 'uploads/');
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const users = await db.all('SELECT user_id, username, is_online, work_status FROM users');
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: "Failed to pull workspace member directory." });
  }
});

app.post('/api/chat/upload', upload.single('file'), (req: any, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No media file sent to asset node." });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return res.json({ success: true, fileUrl });
});

app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const userProfile = await db.get(
      `SELECT user_id, username, email, phone_number, work_status, relationship_status, is_online, last_seen 
       FROM users WHERE user_id = ?`,
      [id]
    );
    if (!userProfile) return res.status(404).json({ error: "Profile record missing." });
    return res.json({ success: true, profile: userProfile });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error reading profile." });
  }
});

app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { work_status, relationship_status } = req.body;
    const db = await getDatabase();
    await db.run('UPDATE users SET work_status = ?, relationship_status = ? WHERE user_id = ?', [work_status, relationship_status, id]);
    return res.json({ success: true, message: "Profile updated successfully!" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update profile settings." });
  }
});

app.get('/api/creators/is-following/:followerId/:followingId', async (req: Request, res: Response) => {
  try {
    const { followerId, followingId } = req.params;
    const db = await getDatabase();
    const row = await db.get('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
    return res.json({ following: !!row });
  } catch (error) {
    return res.status(500).json({ error: "Failed to read matrix follow status." });
  }
});

app.get('/api/chat/messages/:senderId/:recipientId', async (req: Request, res: Response) => {
  try {
    const { senderId, recipientId } = req.params;
    const db = await getDatabase();

    const messages = await db.all(
      `SELECT message_id as dbId, sender_id as senderId, file_url as content, message_type as type, is_view_once as isViewOnce
       FROM messages 
       WHERE (sender_id = ? AND conversation_id = 1) 
          OR (sender_id = ? AND conversation_id = 1)
       ORDER BY message_id ASC`,
      [senderId, recipientId]
    );
    return res.json(messages || []);
  } catch (error) {
    console.error("Historical fetch failed completely:", error);
    return res.status(500).json({ error: "Failed to read conversation stream safely." });
  }
});

app.post('/api/admin/restrict', updateUserRestriction);
app.get('/api/admin/flagged', getFlaggedAccounts);
app.post('/api/posts/like', toggleLike);
app.post('/api/posts/comment', addComment);
app.get('/api/posts/:postId/engagement', getPostEngagement);
app.post('/api/creators/follow', toggleFollow);
app.get('/api/creators/:userId/follow-stats', getFollowStats);

app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const posts = await db.all(`SELECT p.*, u.username, u.profile_picture_url FROM posts p JOIN users u ON p.user_id = u.user_id ORDER BY p.post_id DESC`);
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch homepage feed items." });
  }
});

app.post('/api/posts', async (req: Request, res: Response) => {
  try {
    const { userId, content, mediaUrl } = req.body;
    if (!userId || !content.trim()) return res.status(400).json({ error: "Parameters are required." });
    const db = await getDatabase();
    const user = await db.get('SELECT restriction_status FROM users WHERE user_id = ?', [userId]);
    if (!user) return res.status(404).json({ error: "Creator profile record not found." });
    const result = await db.run(`INSERT INTO posts (user_id, content, media_url, is_admin_featured) VALUES (?, ?, ?)`, [userId, content, mediaUrl || null]);
    return res.status(201).json({ success: true, postId: result.lastID });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });
app.set('io', io);
const onlineUsers = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  socket.on('user_online', async (userId: string) => {
    onlineUsers.set(userId, socket.id);
    const db = await getDatabase();
    await db.run('UPDATE users SET is_online = 1 WHERE user_id = ?', [userId]);
    socket.broadcast.emit('user_status_change', { userId, status: 'online' });
  });

  socket.on('send_message', async (data: { messageId: string; senderId: string; recipientId: string; type: 'text' | 'image' | 'video' | 'audio'; content: string; isViewOnce: boolean; }) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    const db = await getDatabase();
    try {
      await db.run('INSERT OR IGNORE INTO conversations (conversation_id) VALUES (1)');
      const result = await db.run(`INSERT INTO messages (conversation_id, sender_id, message_type, file_url, is_view_once) VALUES (1, ?, ?)`, [data.senderId, data.type, data.content, data.isViewOnce ? 1 : 0]);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_message', { ...data, senderId: data.senderId, dbId: result.lastID, status: 'delivered' });
      }
    } catch (err: any) {
      console.error("Caught socket write error securely:", err.message);
    }
  });

  socket.on('message_read', async (data: { messageId: string; senderId: string; recipientId: string; isViewOnce: boolean; dbId?: number }) => {
    const senderSocketId = onlineUsers.get(data.senderId);
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (data.isViewOnce && data.dbId) {
      const db = await getDatabase();
      await db.run('UPDATE messages SET file_url = NULL, is_opened = 1 WHERE id = ?', [data.dbId]);
      if (senderSocketId) io.to(senderSocketId).emit('destroy_view_once_media', { messageId: data.messageId });
      if (recipientSocketId) io.to(recipientSocketId).emit('destroy_view_once_media', { messageId: data.messageId });
    }
  });

  socket.on('disconnect', async () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        const db = await getDatabase();
        await db.run('UPDATE users SET is_online = 0 WHERE user_id = ?', [userId]);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`🚀 Creator engine server responding live on port ${PORT}`));