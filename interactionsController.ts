import { Request, Response } from 'express';
import { db } from './db';

export const likePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const existing = db.prepare('SELECT * FROM likes WHERE postId = ? AND userId = ?').get(postId, userId);
    
    if (existing) {
      db.prepare('DELETE FROM likes WHERE postId = ? AND userId = ?').run(postId, userId);
      return res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO likes (postId, userId) VALUES (?, ?)').run(postId, userId);
      return res.json({ liked: true });
    }
  } catch (error) {
    console.error('Error in likePost:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

export const commentPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId, text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text required' });
    }

    const result = db.prepare('INSERT INTO comments (postId, userId, text) VALUES (?, ?, ?)').run(postId, userId, text);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
    
    res.json(comment);
  } catch (error) {
    console.error('Error in commentPost:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const comments = db.prepare(`
      SELECT c.*, u.username, u.avatar 
      FROM comments c 
      JOIN users u ON c.userId = u.id 
      WHERE c.postId = ? 
      ORDER BY c.createdAt DESC
    `).all(postId);
    
    res.json(comments);
  } catch (error) {
    console.error('Error in getComments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};