import { Request, Response } from 'express';
import { getDatabase } from './db';  // import function, not db

export const likePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    const db = await getDatabase(); // <-- await it

    const existing = await db.get('SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ?', postId, userId);

    if (existing) {
      await db.run('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?', postId, userId);
      return res.json({ liked: false });
    } else {
      await db.run('INSERT INTO post_reactions (post_id, user_id) VALUES (?, ?)', postId, userId);
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

    const db = await getDatabase(); // <-- await it

    const result = await db.run('INSERT INTO post_comments (post_id, user_id, comment_text) VALUES (?, ?, ?)', postId, userId, text);
    const comment = await db.get('SELECT * FROM post_comments WHERE comment_id = ?', result.lastID);

    res.json(comment);
  } catch (error) {
    console.error('Error in commentPost:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const db = await getDatabase(); // <-- await it
    
    const comments = await db.all(`
      SELECT c.*, u.username, u.profile_picture_url 
      FROM post_comments c 
      JOIN users u ON c.user_id = u.user_id 
      WHERE c.post_id = ? 
      ORDER BY c.created_at DESC
    `, postId);

    res.json(comments);
  } catch (error) {
    console.error('Error in getComments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};