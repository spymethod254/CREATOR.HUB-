import { Request, Response } from 'express';
import { getDatabase } from './db';

// -------------------------------------------------------------
// 1. POST INTERACTIONS CONTROLLERS (Likes & Comments)
// -------------------------------------------------------------

// Toggle a Like on a feed post
export async function toggleLike(req: Request, res: Response) {
  try {
    const { postId, userId } = req.body;
    if (!postId || !userId) return res.status(400).json({ error: "Missing postId or userId." });

    const db = await getDatabase();

    // Check if the user already liked this post
    const existingLike = await db.get(
      'SELECT reaction_id FROM post_reactions WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existingLike) {
      // Unlike if record exists
      await db.run('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?', [postId, userId]);
      return res.json({ success: true, liked: false, message: "Post unliked successfully." });
    } else {
      // Insert new like record
      await db.run('INSERT INTO post_reactions (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      return res.json({ success: true, liked: true, message: "Post liked successfully." });
    }
  } catch (error) {
    // ✅ OPTIMIZATION: Always log the exact server error stack for structural debugging
    console.error("🔴 Toggle Like Database Exception:", error);
    return res.status(500).json({ error: "Failed to update post reaction loop." });
  }
}

// Add a text comment onto a feed post
export async function addComment(req: Request, res: Response) {
  try {
    const { postId, userId, commentText } = req.body;
    if (!postId || !userId || !commentText.trim()) {
      return res.status(400).json({ error: "All comment parameters are required." });
    }

    const db = await getDatabase();
    const result = await db.run(
      'INSERT INTO post_comments (post_id, user_id, comment_text) VALUES (?, ?, ?)',
      [postId, userId, commentText]
    );

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      commentId: result.lastID
    });
  } catch (error) {
    console.error("🔴 Add Comment Database Exception:", error);
    return res.status(500).json({ error: "Failed to insert comment data." });
  }
}

// Fetch all comments and live like counts for a post
export async function getPostEngagement(req: Request, res: Response) {
  try {
    const { postId } = req.params;
    const db = await getDatabase();

    const likeCount = await db.get('SELECT COUNT(*) as count FROM post_reactions WHERE post_id = ?', [postId]);
    
    // ✅ FIX: Standardized mapped aliases (comment_id as commentId, created_at as createdAt) 
    // to match standard React dynamic key expectations and prevent frontend runtime crashes.
    const comments = await db.all(`
      SELECT 
        c.comment_id as commentId, 
        c.post_id as postId, 
        c.user_id as userId, 
        c.comment_text as commentText, 
        c.created_at as createdAt,
        u.username,
        u.profile_picture_url as profilePictureUrl
      FROM post_comments c 
      JOIN users u ON c.user_id = u.user_id 
      WHERE c.post_id = ? 
      ORDER BY c.comment_id ASC
    `, [postId]);

    return res.json({
      likes: likeCount?.count || 0,
      comments: comments
    });
  } catch (error) {
    console.error("🔴 Get Engagement Database Exception:", error);
    return res.status(500).json({ error: "Failed to load post engagement tracking." });
  }
}

// -------------------------------------------------------------
// 2. CREATOR MATRIX FOLLOWER SYSTEM CONTROLLERS
// -------------------------------------------------------------

// Follow or Unfollow another content creator profile
export async function toggleFollow(req: Request, res: Response) {
  try {
    const { followerId, followingId } = req.body;
    if (!followerId || !followingId) return res.status(400).json({ error: "Follower and Following IDs required." });
    if (followerId === followingId) return res.status(400).json({ error: "Creators cannot follow their own profile." });

    const db = await getDatabase();

    const existingFollow = await db.get(
      'SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    if (existingFollow) {
      await db.run('DELETE FROM followers WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
      return res.json({ success: true, following: false, message: "Creator unfollowed successfully." });
    } else {
      await db.run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [followerId, followingId]);
      return res.json({ success: true, following: true, message: "Creator followed successfully." });
    }
  } catch (error) {
    console.error("🔴 Toggle Follow Database Exception:", error);
    return res.status(500).json({ error: "Failed to process follow framework matrix query." });
  }
}

// Get public statistics numbers for follower lists
export async function getFollowStats(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const db = await getDatabase();

    const followers = await db.get('SELECT COUNT(*) as count FROM followers WHERE following_id = ?', [userId]);
    const following = await db.get('SELECT COUNT(*) as count FROM followers WHERE follower_id = ?', [userId]);

    return res.json({
      totalFollowers: followers?.count || 0,
      totalFollowing: following?.count || 0
    });
  } catch (error) {
    console.error("🔴 Get Follow Stats Database Exception:", error);
    return res.status(500).json({ error: "Failed to load follower network stats." });
  }
}
