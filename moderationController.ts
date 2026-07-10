import { Request, Response } from 'express';
import { supabase } from './server';

// 1. UPDATE USER ACCOUNT RESTRICTION STATUS (None, Restricted, Spam_Flagged, Banned)
export async function updateUserRestriction(req: Request, res: Response) {
  try {
    const { targetUserId, newStatus } = req.body;

    const validStatuses = ['None', 'Restricted', 'Spam_Flagged', 'Banned'];
    if (!targetUserId || !validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: "Invalid target user ID or restriction status payload." });
    }

    // 1. Check if user exists
    const { data: userExists, error: findError } = await supabase
      .from('users')
      .select('username')
      .eq('user_id', targetUserId)
      .single();

    if (findError || !userExists) {
      return res.status(404).json({ error: "Target creator account not found." });
    }

    // 2. Update restriction status + force offline
    const { error: updateError } = await supabase
      .from('users')
      .update({ restriction_status: newStatus, is_online: 0 })
      .eq('user_id', targetUserId);

    if (updateError) throw updateError;

    // 3. Force disconnect their socket session immediately if restricted/banned
    if (newStatus === 'Banned' || newStatus === 'Restricted') {
      const io = req.app.get('io');
      if (io) {
        io.emit('force_disconnect_user', { userId: targetUserId.toString() });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Account status successfully updated to: ${newStatus}`,
      details: { targetUserId, status: newStatus }
    });

  } catch (error: any) {
    console.error("🔴 Moderation Error:", error);
    return res.status(500).json({ error: error.message || "Internal server moderation loop failure." });
  }
}

// 2. FETCH ALL SPAM-FLAGGED OR RESTRICTED ACCOUNTS FOR ADMIN VIEW
export async function getFlaggedAccounts(req: Request, res: Response) {
  try {
    const { data: flaggedUsers, error } = await supabase
      .from('users')
      .select('user_id, username, email, phone_number, restriction_status')
      .in('restriction_status', ['Restricted', 'Spam_Flagged', 'Banned'])
      .or('restriction_status.is.null'); // to also catch NULL like in your old query

    if (error) throw error;

    return res.json(flaggedUsers);
  } catch (error: any) {
    console.error("🔴 Get Flagged Accounts Error:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve restricted database entries." });
  }
}