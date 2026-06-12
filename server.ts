import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';

import { registerUser, loginUser } from './authController';
import { updateUserRestriction, getFlaggedAccounts } from './moderationController';
import { getDatabase } from './db';

import {
  likePost,
  commentPost,
  getComments
} from './interactionsController';

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// AUTH
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

// USERS
app.get('/api/users', async (req, res) => {
  const db = await getDatabase();
  const users = await db.all('SELECT user_id, username, is_online, work_status FROM users');
  res.json(users);
});

// PROFILE
app.get('/api/users/:id', async (req, res) => {
  const db = await getDatabase();
  const user = await db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
  res.json(user);
});

app.put('/api/users/:id', async (req, res) => {
  const db = await getDatabase();
  const { work_status, relationship_status } = req.body;

  await db.run(
    'UPDATE users SET work_status=?, relationship_status=? WHERE user_id=?',
    [work_status, relationship_status, req.params.id]
  );

  res.json({ success: true });
});

// POSTS
app.get('/api/posts', async (req, res) => {
  const db = await getDatabase();
  const posts = await db.all(
    `SELECT p.*, u.username
     FROM posts p
     JOIN users u ON p.user_id = u.user_id
     ORDER BY p.post_id DESC`
  );

  res.json(posts);
});

app.post('/api/posts', async (req, res) => {
  const db = await getDatabase();
  const { userId, content, mediaUrl } = req.body;

  if (!userId || !content) {
    return res.status(400).json({ error: "Missing data" });
  }

  const result = await db.run(
    `INSERT INTO posts (user_id, content, media_url, is_admin_featured)
     VALUES (?, ?, ?, ?)`,
    [userId, content, mediaUrl || null, 0]
  );

  res.json({ success: true, postId: result.lastID });
});

// POST INTERACTIONS
app.post('/api/posts/:postId/like', likePost);
app.post('/api/posts/:postId/comment', commentPost);
app.get('/api/posts/:postId/comments', getComments);

// ADMIN
app.post('/api/admin/restrict', updateUserRestriction);
app.get('/api/admin/flagged', getFlaggedAccounts);

// ROOT
app.get('/', (req, res) => {
  res.json({ status: 'alive' });
});

// SERVER
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.set('io', io);

const onlineUsers = new Map<string, string>();

io.on('connection', (socket: Socket) => {

  socket.on('disconnect', async () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        const db = await getDatabase();
        await db.run('UPDATE users SET is_online=0 WHERE user_id=?', [userId]);
      }
    }
  });

});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);