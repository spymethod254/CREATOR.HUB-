import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: './creator_platform.db',
    driver: sqlite3.Database
  });

  await dbInstance.get('PRAGMA foreign_keys = ON');
  await createDatabaseTables(dbInstance);

  return dbInstance;
}

async function createDatabaseTables(db: Database) {
  // 1. USERS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      phone_number TEXT UNIQUE, -- ✅ FIX: Made nullable or empty string handled to prevent registration crashes
      profile_picture_url TEXT DEFAULT 'default_avatar.png',
      date_of_birth TEXT,
      work_status TEXT CHECK(work_status IN ('Available', 'Busy', 'Employed', 'Freelance')) DEFAULT 'Available',
      relationship_status TEXT CHECK(relationship_status IN ('Single', 'In a relationship', 'Married', 'Private')) DEFAULT 'Private',
      restriction_status TEXT CHECK(restriction_status IN ('None', 'Restricted', 'Spam_Flagged', 'Banned')) DEFAULT 'None',
      is_online INTEGER DEFAULT 0,
      last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. SOCIAL MEDIA BADGE LINKS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_links (
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      platform_name TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE (user_id, platform_name)
    );
  `);

  // 3. FOLLOWERS SYSTEM MATRIX
  await db.exec(`
    CREATE TABLE IF NOT EXISTS followers (
      follower_id INTEGER,
      following_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY(following_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // 4. CREATOR FEEDS & POSTS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      post_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      group_id INTEGER,
      content TEXT,
      media_url TEXT,
      is_admin_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // 5. CHAT CONVERSATIONS ROOMS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_group INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. MESSAGES STREAM (Unified Key Aliases)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT, -- ✅ Synced safely with server.ts logic constraints
      conversation_id INTEGER,
      sender_id INTEGER,
      recipient_id INTEGER, -- ✅ FIX: Explicit tracking layer for peer-to-peer delivery lookup routines
      message_type TEXT CHECK(message_type IN ('text', 'image', 'video', 'audio', 'voice_note')) DEFAULT 'text',
      file_url TEXT,
      is_view_once INTEGER DEFAULT 0,
      is_opened INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // 7. MESSAGE TICK STATUS SYSTEM
  await db.exec(`
    CREATE TABLE IF NOT EXISTS message_receipts (
      message_id INTEGER,
      recipient_id INTEGER,
      is_delivered INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      delivered_at TEXT,
      read_at TEXT,
      PRIMARY KEY (message_id, recipient_id),
      FOREIGN KEY(message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
      FOREIGN KEY(recipient_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // 8. POST REACTIONS TABLE (LIKES)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE (post_id, user_id)
    );
  `);

  // 9. POST COMMENTS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_comments (
      comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      comment_text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  console.log("🚀 SQLite Database initialized successfully with all tables.");
}
