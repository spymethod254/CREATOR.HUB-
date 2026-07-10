import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
<<<<<<< HEAD
import { supabase } from './server'; // we exported it from server.ts
=======
import { getDatabase } from './db';
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4

// REGISTER
export async function registerUser(req: Request, res: Response) {
  try {
    const { username, email, password, phone_number, work_status, relationship_status } = req.body;

    if (!username || !email || !password || !phone_number) {
      return res.status(400).json({ error: "Missing required registration parameters." });
    }

<<<<<<< HEAD
    // 1. Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('username, email, phone_number')
      .or(`username.eq.${username},email.eq.${email},phone_number.eq.${phone_number}`);

    if (checkError) throw checkError;

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.username === username) return res.status(400).json({ error: "Username is already taken." });
      if (existing.email === email) return res.status(400).json({ error: "Email account is already registered." });
      if (existing.phone_number === phone_number) return res.status(400).json({ error: "Mobile number already used." });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insert into Supabase
    const { data, error } = await supabase
      .from('users')
      .insert([{
        username,
        email,
        password_hash: passwordHash,
        phone_number,
        work_status: work_status || 'Available',
        relationship_status: relationship_status || 'Private',
        is_online: 0,
        restriction_status: 'None'
      }])
      .select()
      .single();

    if (error) throw error;
=======
    const db = await getDatabase();

    const existingUser = await db.get(
      'SELECT username, email, phone_number FROM users WHERE username = ? OR email = ? OR phone_number = ?',
      [username, email, phone_number]
    );

    if (existingUser) {
      if (existingUser.username === username) return res.status(400).json({ error: "Username is already taken." });
      if (existingUser.email === email) return res.status(400).json({ error: "Email account is already registered." });
      if (existingUser.phone_number === phone_number) return res.status(400).json({ error: "Mobile number already used." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users (
        username,
        email,
        password_hash,
        phone_number,
        work_status,
        relationship_status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        passwordHash,
        phone_number,
        work_status || 'Available',
        relationship_status || 'Private'
      ]
    );
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4

    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
<<<<<<< HEAD
      user: { user_id: data.user_id, username: data.username }
=======
      user: { user_id: result.lastID, username }
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4
    });

  } catch (error: any) {
    console.error("Registration Error:", error);
<<<<<<< HEAD
    return res.status(500).json({ error: error.message || "Internal server error." });
=======
    return res.status(500).json({ error: "Internal server error." });
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4
  }
}

// LOGIN
export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required." });
    }

<<<<<<< HEAD
    // 1. Find user by email OR username
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, password_hash, restriction_status')
      .or(`username.eq.${email},email.eq.${email}`)
      .single();

    if (error || !user) {
=======
    const db = await getDatabase();

    const user = await db.get(
      'SELECT user_id, username, password_hash, restriction_status FROM users WHERE username = ? OR email = ?',
      [email, email]
    );

    if (!user) {
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (user.restriction_status === 'Banned') {
      return res.status(403).json({ error: "Account banned." });
    }

<<<<<<< HEAD
    // 2. Check password
    const match = await bcrypt.compare(password, user.password_hash);
=======
    const match = await bcrypt.compare(password, user.password_hash);

>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

<<<<<<< HEAD
    // 3. Update online status
    await supabase
      .from('users')
      .update({ is_online: 1, last_seen: new Date().toISOString() })
      .eq('user_id', user.user_id);
=======
    await db.run(
      'UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
      [user.user_id]
    );
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4

    return res.json({
      success: true,
      user: { userId: user.user_id, username: user.username }
    });

<<<<<<< HEAD
  } catch (error: any) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error." });
=======
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error." });
>>>>>>> bb04b15be8c7e317e14f69e42aeb1a9740ebe2d4
  }
}