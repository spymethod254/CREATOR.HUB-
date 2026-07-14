import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseRealtimePayload } from '@supabase/supabase-js';
import { MessageCircle, ArrowLeft, Search, Mic, Image, Film } from 'lucide-react';
import { supabase } from './supabaseClient';

type User = {
  user_id: string;
  username: string;
  is_online?: number;
  work_status?: string;
  lastMessageSnippet?: string;
};

type MessageItem = {
  dbId?: number;
  messageId?: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio';
  isViewOnce?: boolean;
  created_at?: string;
};

export default function ChatWindow() {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('userId') || '';
  const [users, setUsers] = useState<User[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [viewOnceToggle, setViewOnceToggle] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ensureAuth = () => {
    if (!currentUserId) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, username, is_online, work_status')
        .order('username', { ascending: true });
      if (error) throw error;
      const enriched = (data || [])
        .filter((u: any) => u.user_id !== currentUserId)
        .map((u: any, i: number) => ({
          ...u,
          lastMessageSnippet: i % 2 === 0 ? 'Tap here to start chatting...' : ''
        }));
      setUsers(enriched as User[]);
      if (!activeRecipient && enriched.length > 0) setActiveRecipient(enriched[0] as User);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!ensureAuth()) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('message_id, sender_id, recipient_id, message_type, message_text, media_url, is_view_once, created_at')
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true });
      if (error) throw error;
      const formatted = (data || []).map((m: any) => ({
        dbId: m.message_id,
        senderId: m.sender_id,
        recipientId: m.recipient_id,
        content: m.message_type === 'text' ? m.message_text : m.media_url,
        type: m.message_type,
        isViewOnce: m.is_view_once,
        created_at: m.created_at
      }));
      setMessages(formatted);
    } catch (err) {
      console.error('Failed to load messages', err);
      setMessages([]);
    }
  };

  const sendMessage = async (type: MessageItem['type'], content: string, recipientId: string, isViewOnce = false) => {
    if (!ensureAuth()) return;
    try {
      const messageId = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const payload = {
        sender_id: currentUserId,
        recipient_id: recipientId,
        message_type: type,
        message_text: type === 'text' ? content : null,
        media_url: type === 'text' ? null : content,
        is_view_once: isViewOnce
      } as any;

      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (error) {
        console.error('Failed to send message', error);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          dbId: data.message_id,
          messageId,
          senderId: currentUserId,
          recipientId,
          content: payload.message_text ?? payload.media_url!,
          type,
          isViewOnce,
          created_at: data.created_at
        }
      ]);
    } catch (err) {
      console.error('sendMessage error', err);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      const bucket = 'uploads';
      const filePath = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error('uploadFile error', err);
      throw err;
    }
  };

  const handleSendText = async () => {
    if (!activeRecipient) return;
    const text = typedMessage.trim();
    if (!text) return;
    await sendMessage('text', text, activeRecipient.user_id, viewOnceToggle);
    setTypedMessage('');
    setViewOnceToggle(false);
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || !activeRecipient) return;
    try {
      const publicUrl = await uploadFile(file);
      await sendMessage(type === 'image' ? 'image' : 'video', publicUrl, activeRecipient.user_id, false);
    } catch {
      alert('Upload failed.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        try {
          const publicUrl = await uploadFile(file);
          if (activeRecipient) await sendMessage('audio', publicUrl, activeRecipient.user_id, false);
        } catch (err) {
          console.error('Audio upload failed', err);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone permission denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const openViewOnce = async (msg: MessageItem) => {
    if (!msg.dbId) return;
    try {
      await supabase.from('messages').update({ is_read: true }).eq('message_id', msg.dbId);
      setMessages((prev) => prev.map((m) => (m.dbId === msg.dbId ? { ...m, content: '🔒 Media Content Expired', type: 'text' } : m)));
    } catch (err) {
      console.error('openViewOnce error', err);
    }
  };

  useEffect(() => {
    if (!ensureAuth()) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ensureAuth()) return;
    if (activeRecipient) fetchMessages(activeRecipient.user_id);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRecipient]);

  useEffect(() => {
    if (!ensureAuth()) return;
    const channel = supabase.channel('public:messages');
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload: SupabaseRealtimePayload<any>) => {
        const newRow = payload.new;
        const isRelevant =
          newRow.sender_id === currentUserId ||
          newRow.recipient_id === currentUserId ||
          newRow.sender_id === activeRecipient?.user_id ||
          newRow.recipient_id === activeRecipient?.user_id;
        if (!isRelevant) return;
        const msg: MessageItem = {
          dbId: newRow.message_id,
          senderId: newRow.sender_id,
          recipientId: newRow.recipient_id,
          content: newRow.message_type === 'text' ? newRow.message_text : newRow.media_url,
          type: newRow.message_type,
          isViewOnce: newRow.is_view_once,
          created_at: newRow.created_at
        };
        setMessages((prev) => [...prev, msg]);
      }
    );
    channel.subscribe();
    return () => channel.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, activeRecipient?.user_id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLocalFileChange(e, 'image')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleLocalFileChange(e, 'video')} />

      <aside className="w-80 bg-slate-800 border-r p-4">
        <div className="flex items-center gap-3 mb-3">
          <MessageCircle size={18} />
          <h3 className="font-bold">Messages</h3>
        </div>
        <div className="mb-3">
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-500"><Search size={14} /></span>
            <input className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-700" placeholder="Search..." onChange={() => {}} />
          </div>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[70vh]">
          {users.map((u) => (
            <button
              key={u.user_id}
              onClick={() => setActiveRecipient(u)}
              className={`w-full text-left p-2 rounded-lg ${activeRecipient?.user_id === u.user_id ? 'bg-indigo-600/10' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{u.username}</div>
                  <div className="text-xs text-slate-400">{u.lastMessageSnippet}</div>
                </div>
                <div className={`h-3 w-3 rounded-full ${u.is_online === 1 ? 'bg-green-400' : 'bg-slate-600'}`} />
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
            <div>
              <div className="font-bold">{activeRecipient?.username ?? 'Select a chat'}</div>
              <div className="text-xs text-slate-400">{activeRecipient?.is_online === 1 ? 'Online' : 'Offline'}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === currentUserId;
            const isImage = msg.type === 'image' || (msg.content && /\.(jpe?g|png|gif|webp)$/i.test(msg.content));
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                  {msg.isViewOnce ? (
                    <>
                      <div className="text-amber-300 text-xs font-bold">🔒 View Once</div>
                      {msg.content === '🔒 Media Content Expired' ? (
                        <div className="italic text-slate-400">{msg.content}</div>
                      ) : (
                        <button className="underline text-amber-300 mt-1 text-sm" onClick={() => openViewOnce(msg)}>Open</button>
                      )}
                    </>
                  ) : (
                    <>
                      {isImage ? (
                        <img src={msg.content} alt="attachment" className="max-w-[240px] rounded-lg" />
                      ) : msg.type === 'video' ? (
                        <video src={msg.content} controls className="max-w-[240px] rounded-lg" />
                      ) : msg.type === 'audio' ? (
                        <audio src={msg.content} controls />
                      ) : (
                        <div>{msg.content}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <footer className="p-3 border-t bg-slate-800">
          <div className="flex items-center gap-2">
            <button onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400"><Image size={18} /></button>
            <button onClick={() => videoInputRef.current?.click()} className="p-2 text-slate-400"><Film size={18} /></button>
            <button onClick={() => (isRecording ? stopRecording() : startRecording())} className="p-2 text-slate-400">
              <Mic size={18} />
            </button>
            <input
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(); }}
              className="flex-1 bg-slate-700 rounded-xl px-4 py-2 text-sm"
              placeholder="Type a message..."
            />
            <button onClick={handleSendText} className="bg-indigo-600 text-white px-3 py-2 rounded-xl">Send</button>
          </div>
          <div className="mt-2 text-xs">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={viewOnceToggle} onChange={() => setViewOnceToggle((s) => !s)} />
              <span className="text-slate-400">View once</span>
            </label>
          </div>
        </footer>
      </div>
    </div>
  );
}
