import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getDatabase } from './db';

// 1. REGISTER NEW ACCOUNT CONTROLLER
export async function registerUser(req: Request, res: Response) {
  try {
    const { username, email, password, phone_number, work_status, relationship_status } = req.body;

    if (!username || !email || !password || !phone_number) {
      return res.status(400).json({ error: "Missing required registration parameters." });
    }

    const db = await getDatabase();

    const existingUser = await db.get(
      'SELECT username, email, phone_number FROM users WHERE username = ? OR email = ? OR phone_number = ?',
      [username, email, phone_number]
    );

    if (existingUser) {
      if (existingUser.username === username) return res.status(400).json({ error: "Username is already taken." });
      if (existingUser.email === email) return res.status(400).json({ error: "Email account is already registered." });
      if (existingUser.phone_number === phone_number) return res.status(400).json({ error: "Mobile number is already linked to an account." });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await db.run(
      `INSERT INTO users (username, email, password_hash, phone_number, work_status, relationship_status) 
       VALUES (?, ?, ?)`,
      [username, email, passwordHash, phone_number, work_status || 'Available', relationship_status || 'Private']
    );

    return res.status(201).json({ 
      success: true, 
      message: "Creator account successfully registered!",
      user: { user_id: result.lastID, username: username }
    });

  } catch (error: any) {
    console.error("🔴 Registration Error:", error);
    return res.status(500).json({ error: "Internal server registry loop crash." });
  }
}

// 2. LOGIN USER CONTROLLER
export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email/Username and password are required fields." });
    }

    const db = await getDatabase();

    const user = await db.get(
      'SELECT user_id, username, password_hash, restriction_status FROM users WHERE username = ? OR email = ?', 
      [email, email]
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (user.restriction_status === 'Banned') {
      return res.status(403).json({ error: "This account has been permanently banned from the network." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await db.run('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    return res.status(200).json({
      success: true,
      message: "Authentication successful!",
      user: { userId: user.user_id, username: user.username }
    });

  } catch (error: any) {
    console.error("🔴 Login Error:", error);
    return res.status(500).json({ error: "Internal server authentication crash." });
  }
}