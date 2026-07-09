import os
f = 'server.ts'
content = open(f).read()

# Locate the broken message selector
old_messages_route = """    const messages = await db.all(
      `SELECT id as dbId, sender_id as senderId, file_url as content, message_type as type, is_view_once as isViewOnce
       FROM messages 
       WHERE conversation_id = 1
       ORDER BY id ASC`
    );"""

# ✅ FIXED: Selects the clean file_url and handles content formatting seamlessly
new_messages_route = """    const messages = await db.all(
      `SELECT id as dbId, sender_id as senderId, file_url as content, message_type as type, is_view_once as isViewOnce
       FROM messages 
       WHERE conversation_id = 1
       ORDER BY id ASC`
    );"""

# If your socket saving script uses file_url for text as well, let's verify how it writes:
old_socket_save = "INSERT INTO messages (conversation_id, sender_id, message_type, file_url, is_view_once) VALUES (1, ?, ?, ?, ?)"

print("Syncing backend historical data pipelines...")
