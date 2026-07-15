import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, ThumbsUp } from 'lucide-react';
import { supabase } from './supabaseClient';

type Post = {
  post_id: number;
  user_id: string;
  content: string;
  media_url?: string | null;
  is_admin_featured?: number | null;
  created_at?: string;
  username?: string | null;
  profile_picture_url?: string | null;
  likes_count?: number;
  comments_count?: number;
};

export default function Homepage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserId = localStorage.getItem('userId') || '';

  useEffect(() => {
    if (!currentUserId) {
      navigate('/login');
      return;
    }
    fetchFeedPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const fetchFeedPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          post_id,
          user_id,
          content,
          media_url,
          is_admin_featured,
          created_at,
          users ( username, profile_picture_url )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedPosts = await Promise.all(
        (postsData || []).map(async (post: any) => {
          const { count: likesCount } = await supabase
            .from('post_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.post_id);

          const { count: commentsCount } = await supabase
            .from('post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.post_id);

          return {
            post_id: post.post_id,
            user_id: post.user_id,
            content: post.content,
            media_url: post.media_url,
            is_admin_featured: post.is_admin_featured,
            created_at: post.created_at,
            username: post.users?.username ?? 'Anonymous',
            profile_picture_url: post.users?.profile_picture_url ?? null,
            likes_count: likesCount ?? 0,
            comments_count: commentsCount ?? 0
          } as Post;
        })
      );

      setPosts(enrichedPosts);
    } catch (err) {
      console.error('Error loading network feed:', err);
    }
  };

  const handlePublishPost = async () => {
    if (!newPostContent.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: newPostContent
      });
      if (error) throw error;
      setNewPostContent('');
      fetchFeedPosts();
    } catch (err: any) {
      alert(err.message || 'Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: number) => {
    try {
      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .single();

      if (existing) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', currentUserId);
      } else {
        await supabase.from('post_reactions').insert({ post_id: postId, user_id: currentUserId });
      }

      fetchFeedPosts();
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <aside className="w-64 p-4 bg-slate-900 border-r hidden md:block">
        <h2 className="font-bold text-indigo-400 text-lg">CREATOR.HUB</h2>
      </aside>

      <main className="flex-1 max-w-3xl mx-auto p-4">
        <div className="bg-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">
              {(localStorage.getItem('username') || 'You').substring(0, 2).toUpperCase()}
            </div>
            <input
              type="text"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Share an update..."
              className="flex-1 bg-slate-700 rounded-xl px-4 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button onClick={handlePublishPost} disabled={isSubmitting || !newPostContent.trim()} className="bg-indigo-500 px-4 py-2 rounded-lg">
              {isSubmitting ? 'Publishing...' : 'Post Update'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center text-slate-500">No posts yet</div>
          ) : (
            posts.map((post) => (
              <article key={post.post_id} className="bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold">
                      {post.username?.substring(0, 2).toUpperCase() ?? 'CC'}
                    </div>
                    <div>
                      <div className="font-bold">{post.username}</div>
                      <div className="text-xs text-slate-400">Creator Hub Member</div>
                    </div>
                  </div>
                  {post.is_admin_featured === 1 && (
                    <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><Award size={12}/>Featured</span>
                  )}
                </div>

                <div className="text-slate-300 mb-3">{post.content}</div>
                {post.media_url && <img src={post.media_url} alt="media" className="max-h-60 rounded-lg mb-3 w-full object-cover" />}

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <button onClick={() => handleToggleLike(post.post_id)} className="flex items-center gap-2">
                    <ThumbsUp size={14} /> {post.likes_count ?? 0}
                  </button>
                  <div className="flex items-center gap-2"><MessageCircle size={14}/> {post.comments_count ?? 0}</div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
