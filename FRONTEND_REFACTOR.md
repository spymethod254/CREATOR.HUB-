# Frontend refactor: use Supabase client

This branch refactors the frontend to use the shared Supabase client (supabaseClient.ts) for data operations and storage. Main changes:

- ChatWindow.tsx
  - Replaced complex socket.io client usage with Supabase client operations + Realtime (postgres_changes) subscription for new messages.
  - Media uploads go to Supabase Storage bucket `uploads` and return public URLs.
  - View-once media implemented by updating message row and replacing content locally.
  - Fixed audio recording, file uploads, message formatting, and UI bugs.

- Homepage.tsx
  - Feed queries use supabase.from('posts') and enrich each post with likes and comment counts via Promise.all.
  - Fixed useEffect dependency and normalized current user handling.

- RegisterLogin.tsx
  - Updated to current Supabase auth API shape (getSession, onAuthStateChange) and signIn/signUp flows.

- UserProfile.tsx
  - Fixed double-imports, avatar upload to bucket `avatars` and public URL update, follow/unfollow toggle, and profile editing.

Notes / migration
- Ensure these env vars are set for the frontend:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_KEY (anon/public)
- Storage buckets used:
  - uploads (chat/media)
  - avatars (profile pictures)
  Both are currently used with getPublicUrl (public access). If you require private/signed URLs, I can change that flow.

Testing steps
1. git checkout fix/frontend-supabase
2. npm install
3. Create .env with VITE_SUPABASE_URL and VITE_SUPABASE_KEY
4. npm run dev
5. Test register/login, posting, liking, chat, uploads, and profile updates.

If you'd like me to also update backend controllers to consistently import supabase from supabaseClient.ts to avoid circular imports, I can prepare that in a follow-up branch/PR.
