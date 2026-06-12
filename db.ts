import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.DATABASE_PATH || '/tmp/creator_platform.db';

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // safer PRAGMA (must use run, not get)
  await dbInstance.run('PRAGMA foreign_keys = ON');

  await createDatabaseTables(dbInstance);

  return dbInstance;
}

async function createDatabaseTables(db: Database) {

  // USERS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      phone_number TEXT UNIQUE,
      profile_picture_url TEXT DEFAULT 'default_avatar.png',
      date_of_birth TEXT,
      work_status TEXT DEFAULT 'Available',
      relationship_status TEXT DEFAULT 'Private',
      restriction_status TEXT DEFAULT 'None',
      is_online INTEGER DEFAULT 0,
      last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // POSTS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      post_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      media_url TEXT,
      is_admin_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // FOLLOWERS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS followers (
      follower_id INTEGER,
      following_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );
  `);

  // COMMENTS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_comments (
      comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      comment_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // REACTIONS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      UNIQUE(post_id, user_id)
    );
  `);

  // MESSAGES
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER,
      sender_id INTEGER,
      message_type TEXT DEFAULT 'text',
      file_url TEXT,
      is_view_once INTEGER DEFAULT 0,
      is_opened INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("🚀 Database ready (SQLite initialized)");
}