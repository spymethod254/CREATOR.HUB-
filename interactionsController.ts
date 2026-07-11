import { Request, Response } from 'express';
import { supabase } from './server';

export const likePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    // 1. Check if already liked
    const { data: existing, error: checkError } = await supabase
      .from('post_reactions')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle(); // maybeSingle = returns null if not found

    if (checkError) throw checkError;

    if (existing) {
      // 2. Unlike: delete
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (error) throw error;
      return res.json({ liked: false });
    } else {
      // 3. Like: insert
      const { error } = await supabase
        .from('post_reactions')
        .insert([{ post_id: postId, user_id: userId }]);
      if (error) throw error;
      return res.json({ liked: true });
    }
  } catch (error: any) {
    console.error('Error in likePost:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle like' });
  }
};

export const commentPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId, text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text required' });
    }

    // 1. Insert comment
    const { data: newComment, error } = await supabase
      .from('post_comments')
      .insert([{ post_id: postId, user_id: userId, comment_text: text }])
      .select()
      .single();

    if (error) throw error;

    res.json(newComment);
  } catch (error: any) {
    console.error('Error in commentPost:', error);
    res.status(500).json({ error: error.message || 'Failed to add comment' });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        users ( username, profile_picture_url )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // flatten the join so frontend gets same structure
    const formatted = comments?.map(c => ({
      ...c,
      username: c.users?.username,
      profile_picture_url: c.users?.profile_picture_url,
      users: undefined
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error in getComments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch comments' });
  }
};