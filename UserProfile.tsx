import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, ShieldCheck, Mail, Phone, 
  Briefcase, Heart, ThumbsUp, MessageCircle, X, Camera
} from 'lucide-react';

export default function UserProfile() {
  const navigate = useNavigate();
  const { profileId } = useParams();

  const currentUserId = localStorage.getItem('userId') || '1';
  const targetProfileId = profileId || currentUserId;

  const [creator, setCreator] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editWorkStatus, setEditWorkStatus] = useState('Available');
  const [editRelationship, setEditRelationship] = useState('Private');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userPosts, setUserPosts] = useState<any[]>([]);

  const fetchProfileData = async () => {
    try {
      const userRes = await fetch(`/api/users/${targetProfileId}`);
      const userData = await userRes.json();

      if (!userRes.ok || !userData.profile) {
        throw new Error(userData.error || "Profile object missing from server response.");
      }

      const profile = userData.profile;

      const statsRes = await fetch(`/api/creators/${targetProfileId}/follow-stats`);
      const statsData = await statsRes.json();

      if (currentUserId !== targetProfileId) {
        const checkFollow = await fetch(`/api/creators/is-following/${currentUserId}/${targetProfileId}`);
        const followData = await checkFollow.json();
        setIsFollowing(followData.following);
      }

      const postsRes = await fetch(`/api/posts`);
      if (postsRes.ok) {
        const allPosts = await postsRes.json();
        const filteredPosts = allPosts.filter((p: any) => p.user_id.toString() === targetProfileId.toString());
        setUserPosts(filteredPosts);
      }

      setCreator({
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email,
        phone_number: profile.phone_number || 'No number linked',
        profile_picture_url: profile.profile_picture_url || null,
        work_status: profile.work_status || 'Available',
        relationship_status: profile.relationship_status || 'Private',
        totalFollowers: statsData.totalFollowers || 0,
        totalFollowing: statsData.totalFollowing || 0
      });

      setEditWorkStatus(profile.work_status || 'Available');
      setEditRelationship(profile.relationship_status || 'Private');
      setLoading(false);
    } catch (err) {
      console.error('Error mounting profile details:', err);
      setCreator(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [targetProfileId, currentUserId]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/users/${targetProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_status: editWorkStatus,
          relationship_status: editRelationship
        })
      });
      if (!response.ok) throw new Error("Failed to save changes");
      setIsSettingsOpen(false);
      await fetchProfileData();
    } catch (err) {
      alert("Error updating profile settings.");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      const updateRes = await fetch(`/api/users/${targetProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_status: editWorkStatus,
          relationship_status: editRelationship,
          profile_picture_url: uploadData.fileUrl
        })
      });
      if (updateRes.ok) await fetchProfileData();
    } catch (err) {
      alert("Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFollowActionToggle = async () => {
    if (!creator) return;
    try {
      const response = await fetch('/api/creators/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: Number(currentUserId), followingId: creator.user_id })
      });
      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.following);
        setCreator((prev: any) => {
          if (!prev) return null;
          const currentCount = prev.totalFollowers || 0;
          const updatedCount = data.following ? currentCount + 1 : Math.max(0, currentCount - 1);
          return { ...prev, totalFollowers: updatedCount };
        });
      }
    } catch (err) {
      console.error('Failed to execute account follow matrix toggle:', err);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center font-mono">Loading Profile...</div>;
  if (!creator) return <div className="min-h-screen bg-slate-900 text-rose-400 flex items-center justify-center font-bold">Profile record missing.</div>;

  const isProfileOwner = currentUserId.toString() === creator.user_id.toString();
  const followButtonClass = isFollowing ? 'text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm bg-slate-700 text-slate-300' : 'text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm bg-indigo-500 text-white hover:bg-indigo-600';
  const feedTabClass = activeTab === 'posts' ? 'pb-3 px-4 border-b-2 transition border-indigo-500 text-indigo-400' : 'pb-3 px-4 border-b-2 transition border-transparent text-slate-400 hover:text-slate-200';
  const aboutTabClass = activeTab === 'about' ? 'pb-3 px-4 border-b-2 transition border-indigo-500 text-indigo-400' : 'pb-3 px-4 border-b-2 transition border-transparent text-slate-400 hover:text-slate-200';
  const firstLetter = creator.username ? creator.username.charAt(0).toUpperCase() : 'C';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20 md:pb-12 relative">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition"><ArrowLeft size={20} /></button>
        <div className="flex items-center gap-1.5"><h2 className="font-bold text-sm">{creator.username}</h2><ShieldCheck size={16} className="text-indigo-400" /></div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-800 p-6 rounded-2xl border-slate-700/80 shadow-md">

          <div className="relative shadow-lg group">
            {creator.profile_picture_url ? (
              <img src={creator.profile_picture_url} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500 shadow-inner" />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-indigo-500 bg-indigo-600 flex items-center justify-center text-white font-black text-3xl select-none">{firstLetter}</div>
            )}
            {isProfileOwner && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 text-white cursor-pointer" title="Change Avatar Image">
                <Camera size={20} className={uploadingAvatar ? 'animate-spin' : ''} />
              </button>
            )}
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-slate-800 rounded-full"></span>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-black text-white">{creator.username}</h1>
            <div className="flex items-center justify-center sm:justify-start gap-4 my-2 text-xs text-slate-400">
              <div><span className="font-bold text-indigo-400">{creator.totalFollowers}</span> Followers</div>
              <div><span className="font-bold text-indigo-400">{creator.totalFollowing}</span> Following</div>
            </div>
            <div className="mt-3 flex gap-2 justify-center sm:justify-start">
              {!isProfileOwner && <button type="button" onClick={handleFollowActionToggle} className={followButtonClass}>{isFollowing ? '✓ Following' : 'Follow'}</button>}
              <button type="button" onClick={() => { if (isProfileOwner) { setIsSettingsOpen(true); } else { navigate('/chat'); } }} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm">{isProfileOwner ? 'Manage Settings' : 'Message'}</button>
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-800 mt-6 text-sm font-bold overflow-x-auto">
          <button type="button" onClick={() => setActiveTab('posts')} className={`${feedTabClass} whitespace-nowrap`}>Feed Updates</button>
          <button type="button" onClick={() => setActiveTab('about')} className={`${aboutTabClass} whitespace-nowrap`}>About Matrix</button>
        </div>

        <div className="mt-5">
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {userPosts.length === 0 ? (
                <div className="text-center py-16 text-sm text-slate-500">No feed updates published yet by this creator.</div>
              ) : (
                userPosts.map((post: any) => (
                  <article key={post.post_id} className="bg-slate-800 rounded-2xl border-slate-700 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-400"><span className="font-bold text-slate-200">{creator.username}</span> • <span>Post #{post.post_id}</span></div>
                    <p className="text-sm text-slate-300 mb-3">{post.content}</p>
                    <div className="flex gap-4 text-xs text-slate-500 font-semibold">
                      <button type="button" className="flex items-center gap-1 hover:text-indigo-400 transition"><ThumbsUp size={14}/> Likes</button>
                      <button type="button" className="flex items-center gap-1 hover:text-indigo-400 transition"><MessageCircle size={14}/> Comments</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-2xl border-slate-700 p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Details</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2 break-all"><Mail size={16} className="text-slate-400 shrink-0" /> {creator.email}</div>
                  <div className="flex items-center gap-2"><Phone size={16} className="text-slate-400 shrink-0" /> {creator.phone_number}</div>
                </div>
              </div>
              <div className="bg-slate-800 rounded-2xl border-slate-700 p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Information</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2"><Briefcase size={16} className="text-slate-400 shrink-0" /> Work: <span className="text-indigo-400 font-semibold">{creator.work_status}</span></div>
                  <div className="flex items-center gap-2"><Heart size={16} className="text-slate-400 shrink-0" /> Matrix: <span className="text-indigo-400 font-semibold">{creator.relationship_status}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button type="button" onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition"><X size={18} /></button>
            <h2 className="text-lg font-black text-white tracking-wide mb-4">Edit Profile Settings</h2>
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Work Status</label>
                <select value={editWorkStatus} onChange={(e) => setEditWorkStatus(e.target.value)} className="w-full bg-slate-700 border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Available">Available</option>
                  <option value="Busy">Busy</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Relationship Status</label>
                <select value={editRelationship} onChange={(e) => setEditRelationship(e.target.value)} className="w-full bg-slate-700 border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Private">Private</option>
                  <option value="Public">Public</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-4 py-2 rounded-xl transition">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}