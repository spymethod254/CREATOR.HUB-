import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

import { registerUser, loginUser } from './authController';
import { updateUserRestriction, getFlaggedAccounts } from './moderationController';
import {
  likePost,
  commentPost,
  getComments
} from './interactionsController';

const app = express();

// SUPABASE CLIENT
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!; // use service key on backend
export const supabase = createClient(supabaseUrl, supabaseKey);

// make uploads folder if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT'] }));
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
  const { data, error } = await supabase
    .from('users')
    .select('user_id, username, is_online, work_status');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PROFILE
app.get('/api/users/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/users/:id', async (req, res) => {
  const { work_status, relationship_status } = req.body;
  const { error } = await supabase
    .from('users')
    .update({ work_status, relationship_status })
    .eq('user_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POSTS
app.get('/api/posts', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select(`*, users(username)`)
    .order('post_id', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/posts', async (req, res) => {
  const { userId, content, mediaUrl } = req.body;
  if (!userId || !content) {
    return res.status(400).json({ error: "Missing data" });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([{ 
      user_id: userId, 
      content, 
      media_url: mediaUrl || null, 
      is_admin_featured: 0 
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, postId: data.post_id });
});

// POST INTERACTIONS
app.post('/api/posts/:postId/like', likePost);
app.post('/api/posts/:postId/comment', commentPost);
app.get('/api/posts/:postId/comments', getComments);

// CHAT - UPLOAD
app.post('/api/chat/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
});

// CHAT - HISTORY
app.get('/api/chat/messages/:userId1/:userId2', async (req, res) => {
  const { userId1, userId2 } = req.params;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`)
    .order('created_at', { ascending: true });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

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
  
  // mark user online
  socket.on('user_online', async (userId: string) => {
    onlineUsers.set(userId, socket.id);
    await supabase.from('users').update({ is_online: 1 }).eq('user_id', userId);
  });

  // send message
  socket.on('send_message', async (payload) => {
    const { messageId, senderId, recipientId, type, content, isViewOnce } = payload;
    
    const { data, error } = await supabase.from('messages').insert([{
      sender_id: senderId,
      recipient_id: recipientId,
      message_text: type === 'text' ? content : null,
      message_type: type,
      media_url: type !== 'text' ? content : null,
      is_view_once: isViewOnce
    }]).select().single();

    if (error) {
      console.error("Message insert error:", error);
      return;
    }

    // send to recipient if online
    const recipientSocket = onlineUsers.get(recipientId);
    if (recipientSocket) {
      io.to(recipientSocket).emit('receive_message', { 
        ...payload, 
        dbId: data.message_id,
        recipientId
      });
    }
  });

  // view once read
  socket.on('message_read', async (data) => {
    if (data.isViewOnce && data.dbId) {
      await supabase.from('messages').update({ is_read: true }).eq('message_id', data.dbId);
      const senderSocket = onlineUsers.get(data.senderId);
      if (senderSocket) io.to(senderSocket).emit('destroy_view_once_media', { messageId: data.messageId });
    }
  });

  // disconnect
  socket.on('disconnect', async () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        await supabase.from('users').update({ is_online: 0 }).eq('user_id', userId);
      }
    }
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);