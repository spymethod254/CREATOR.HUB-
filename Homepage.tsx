import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Compass, Video, MessageSquare, ThumbsUp, MessageCircle, Share2, Award } from 'lucide-react';

interface Post {
  post_id: number;
  username: string;
  profile_picture_url: string;
  content: string;
  media_url?: string;
  is_admin_featured: number;
  likes_count?: number;      
  comments_count?: number;   
  user_has_liked?: boolean;  
}

export default function Homepage() {
  const navigate = useNavigate(); 
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserId = localStorage.getItem('userId') || '1';

  const fetchFeedPosts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/posts');
      const postsData = await res.json();
      
      const enrichedPosts = await Promise.all(
        postsData.map(async (post: Post) => {
          try {
            const engageRes = await fetch(`http://localhost:5000/api/posts/${post.post_id}/engagement`);
            const engageData = await engageRes.json();
            return {
              ...post,
              likes_count: engageData.likes || 0,
              comments_count: engageData.comments?.length || 0
            };
          } catch {
            return { ...post, likes_count: 0, comments_count: 0 };
          }
        })
      );
      
      setPosts(enrichedPosts);
    } catch (err) {
      console.error("Error loading network feed:", err);
    }
  };

  useEffect(() => {
    fetchFeedPosts();
  }, []);

  const handlePublishPost = async () => {
    if (!newPostContent.trim()) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          content: newPostContent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish post content.');
      }

      setNewPostContent(''); 
      fetchFeedPosts();      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: number) => {
    try {
      const response = await fetch('http://localhost:5000/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: currentUserId })
      });
      if (response.ok) {
        fetchFeedPosts(); 
      }
    } catch (err) {
      console.error("Failed to execute like interaction toggle:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 px-4 py-2 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-black tracking-wider text-indigo-400 cursor-pointer" onClick={() => navigate('/')}>CREATOR.HUB</h1>
        <div className="flex bg-slate-700 rounded-full px-3 py-1 text-sm border border-slate-600">
          <span className="text-green-400 mr-1.5">●</span> Community Active
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto flex">
        <aside className="w-64 p-4 hidden md:flex flex-col gap-2 border-r border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Navigation</p>
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium transition w-full text-left"><Home size={18}/> Feed Home</button>
          <button type="button" onClick={() => navigate('/profile')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-sm font-medium transition w-full text-left"><Compass size={18}/> My Profile</button>
          <button type="button" onClick={() => navigate('/chat')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-sm font-medium transition w-full text-left"><MessageSquare size={18}/> Chat Rooms</button>
          <button type="button" onClick={() => { localStorage.clear(); navigate('/login'); }} className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-400 hover:bg-rose-950/20 text-sm font-medium transition w-full text-left">Sign Out Account</button>
        </aside>

        <main className="flex-1 p-4 overflow-y-auto max-w-2xl mx-auto w-full pb-24 md:pb-4">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 mb-5 shadow-sm">
            <div className="flex gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm shrink-0">YOU</div>
              <input 
                type="text" 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share a post, job update or cross-promotion link..." 
                className="bg-slate-700 w-full rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <div className="border-t border-slate-700/60 pt-2 flex justify-end">
              <button 
                type="button" 
                onClick={handlePublishPost}
                disabled={isSubmitting || !newPostContent.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm"
              >
                {isSubmitting ? 'Publishing...' : 'Post Update'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {posts.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-10">No live updates posted on the feed yet.</div>
            ) : (
              posts.map((post) => (
                <article key={post.post_id} className="bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold border border-slate-600 shrink-0">
                        {post.username ? post.username.substring(0, 2).toUpperCase() : 'CC'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 hover:underline cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>{post.username || 'Anonymous'}</h4>
                        <p className="text-xs text-slate-400">Creator Hub Member</p>
                      </div>
                    </div>
                    {post.is_admin_featured === 1 && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md border border-amber-500/20">
                        <Award size={12}/> Featured
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-3 text-sm text-slate-300 leading-relaxed">
                    {post.content}
                  </div>

                  <div className="px-4 py-2.5 bg-slate-800/50 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-400">
                    <button type="button" onClick={() => handleToggleLike(post.post_id)} className="flex items-center gap-1.5 hover:text-indigo-400 transition">
                      <ThumbsUp size={14}/> {post.likes_count || 0} Likes
                    </button>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle size={14}/> {post.comments_count || 0} Comments
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
