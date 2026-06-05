import { Request, Response } from 'express';
import { getDatabase } from './db';

// 1. UPDATE USER ACCOUNT RESTRICTION STATUS (None, Restricted, Spam_Flagged, Banned)
export async function updateUserRestriction(req: Request, res: Response) {
  try {
    const { targetUserId, newStatus } = req.body;

    const validStatuses = ['None', 'Restricted', 'Spam_Flagged', 'Banned'];
    if (!targetUserId || !validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: "Invalid target user ID or restriction status payload." });
    }

    const db = await getDatabase();

    const userExists = await db.get('SELECT username FROM users WHERE user_id = ?', [targetUserId]);
    if (!userExists) {
      return res.status(404).json({ error: "Target creator account not found." });
    }

    await db.run(
      'UPDATE users SET restriction_status = ?, is_online = 0 WHERE user_id = ?',
      [newStatus, targetUserId]
    );

    // ✅ FIX 1: Real-time eviction. Force disconnect their socket session immediately if restricted/banned
    if (newStatus === 'Banned' || newStatus === 'Restricted') {
      const io = req.app.get('io'); // Retrieves the Socket.io server instance attached in server.ts
      if (io) {
        // Find their active socket in the global room connection map and boot them
        io.emit('force_disconnect_user', { userId: targetUserId.toString() });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Account status successfully updated to: ${newStatus}`,
      details: { targetUserId, status: newStatus }
    });

  } catch (error) {
    console.error("🔴 Moderation Error:", error);
    return res.status(500).json({ error: "Internal server moderation loop failure." });
  }
}

// 2. FETCH ALL SPAM-FLAGGED OR RESTRICTED ACCOUNTS FOR ADMIN VIEW
export async function getFlaggedAccounts(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    
    // ✅ FIX 2: Added explicit 'IN' operators and NULL checks to prevent SQLite skipping corrupted fields
    const flaggedUsers = await db.all(`
      SELECT user_id, username, email, phone_number, restriction_status 
      FROM users 
      WHERE restriction_status IN ('Restricted', 'Spam_Flagged', 'Banned')
         OR restriction_status IS NULL
    `);

    return res.json(flaggedUsers);
  } catch (error) {
    console.error("🔴 Get Flagged Accounts Error:", error);
    return res.status(500).json({ error: "Failed to retrieve restricted database entries." });
  }
}
