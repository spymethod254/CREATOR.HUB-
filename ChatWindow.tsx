import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft, Send, ShieldAlert, Eye, Phone, Video,
  Mic, Image, Film, Paperclip, MoreVertical, Smile, Square, Search, MessageCircle
} from 'lucide-react';

interface User {
  user_id: string; // Supabase uses UUID strings
  username: string;
  is_online: number;
  work_status: string;
  lastMessageSnippet?: string;
}

interface Message {
  messageId?: string;
  dbId?: number;
  senderId: string;
  recipientId?: string;
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio';
  timestamp?: string;
  isViewOnce?: boolean;
  message_text?: string;
  media_url?: string;
  message_type?: string;
  created_at?: string;
}

const API_URL = import.meta.env.VITE_API_URL || ''; // set this in.env for prod

export default function ChatWindow() {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('userId') || '';

  const [users, setUsers] = useState<User[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [viewOnceToggle, setViewOnceToggle] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socketRef.current = io(API_URL, { transports: ['websocket'] });
    socketRef.current.emit('user_online', currentUserId);

    const fetchDirectory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users`);
        if (res.ok) {
          const list = await res.json();
          const filtered = list.filter((u: User) => u.user_id!== currentUserId);

          const enrichedList = filtered.map((u: User, index: number) => ({
           ...u,
            lastMessageSnippet: index % 2 === 0? "🎙️ Sent an audio track note" : "Tap here to start chatting..."
          }));

          setUsers(enrichedList);
          if (enrichedList.length > 0) setActiveRecipient(enrichedList[0]);
        }
      } catch (err) {
        console.error("Failed to load directory", err);
      }
    };
    fetchDirectory();

    socketRef.current.on('receive_message', (incomingMsg: Message) => {
      if (incomingMsg.senderId === activeRecipient?.user_id || incomingMsg.recipientId === activeRecipient?.user_id) {
        setMessages((prev) => [...prev, incomingMsg]);
      }
    });

    socketRef.current.on('destroy_view_once_media', (data: { messageId: string }) => {
      setMessages((prev) => prev.map(m => m.messageId === data.messageId? {...m, content: '🔒 Media Content Expired', type: 'text' } : m));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!activeRecipient) return;
    const loadChatLogs = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/messages/${currentUserId}/${activeRecipient.user_id}`);
        if (res.ok) {
          const history = await res.json();
          const formatted = history.map((h: any) => ({
            dbId: h.message_id,
            senderId: h.sender_id,
            recipientId: h.recipient_id,
            content: h.message_type === 'text'? h.message_text : h.media_url,
            type: h.message_type,
            isViewOnce: h.is_view_once,
            timestamp: h.created_at
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Chat logs load failed", err);
      }
    };
    loadChatLogs();
  }, [activeRecipient, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (msgType: 'text' | 'image' | 'video' | 'audio' = 'text', customVal?: string) => {
    if (!socketRef.current ||!activeRecipient) return;
    const bodyContent = customVal || typedMessage;
    if (!bodyContent.trim()) return;

    const uniqueMsgId = crypto.randomUUID();
    const messagePayload: Message = {
      messageId: uniqueMsgId,
      senderId: currentUserId,
      recipientId: activeRecipient.user_id,
      content: bodyContent,
      type: msgType,
      isViewOnce: viewOnceToggle
    };

    socketRef.current.emit('send_message', {
      messageId: uniqueMsgId,
      senderId: currentUserId,
      recipientId: activeRecipient.user_id,
      type: msgType,
      content: bodyContent,
      isViewOnce: viewOnceToggle
    });

    setUsers(prev => prev.map(u => u.user_id === activeRecipient.user_id? {
     ...u, lastMessageSnippet: msgType === 'audio'? "🎙️ Sent an audio track note" : msgType === 'image'? "📸 Image Asset" : bodyContent.substring(0, 30)
    } : u));

    setMessages((prev) => [...prev, messagePayload]);
    if (!customVal) setTypedMessage('');
    setViewOnceToggle(false);
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>, targetType: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const fileUrl = `${API_URL}${data.fileUrl}`;
        handleSendMessage(targetType, fileUrl);
      }
    } catch {
      alert("Failed to securely transport file.");
    }
  };

  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        handleSendMessage('audio', audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone permission denied.");
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleOpenViewOnce = (dbId?: number, messageId?: string) => {
    if (!socketRef.current ||!activeRecipient) return;
    socketRef.current.emit('message_read', {
      messageId: messageId || '',
      senderId: activeRecipient.user_id,
      recipientId: currentUserId,
      isViewOnce: true,
      dbId: dbId
    });
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans w-full overflow-hidden">
      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleLocalFileChange(e, 'image')} />
      <input type="file" ref={videoInputRef} accept="video/*" className="hidden" onChange={(e) => handleLocalFileChange(e, 'video')} />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileSidebarOpen(false)}></div>
      )}

      <aside className={`fixed md:relative top-0 left-0 h-full w-80 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 z-40 transform transition-transform ${mobileSidebarOpen? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-4 border-b border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white"><ArrowLeft size={18} /></button>
              <MessageCircle size={20} className="text-indigo-400" />
              <h3 className="font-black text-base tracking-wide">Messages</h3>
            </div>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border-indigo-500/30">{users.length} Chats</span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Search size={14} /></span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-slate-700/60 border-slate-600/50 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredUsers.length === 0? (
            <div className="text-center py-8 text-xs text-slate-500 uppercase tracking-wider">No conversations found</div>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => { setActiveRecipient(u); setMobileSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition text-left border ${activeRecipient?.user_id === u.user_id? 'bg-indigo-600/10 border-indigo-500/40 text-white shadow-sm' : 'border-transparent text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 font-black text-sm flex items-center justify-center text-white border-indigo-400/20 uppercase shadow-inner">{u.username.substring(0, 1)}</div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${u.is_online === 1? 'bg-green-500' : 'bg-slate-600'}`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold truncate text-slate-200">{u.username}</p>
                    <span className="text-[10px] text-slate-500 font-medium">{u.is_online === 1? 'Online' : 'Offline'}</span>
                  </div>
                  <p className="text-xs truncate text-slate-400">{u.lastMessageSnippet}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex-col min-w-0 h-screen relative bg-slate-900">
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="md:hidden text-slate-400 hover:text-white transition"><MessageCircle size={20} /></button>
            <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="font-bold text-sm">Room: {activeRecipient?.username || 'Select a chat'}</h2>
              <p className="text-[10px] text-green-400 font-semibold">● {activeRecipient?.is_online === 1? 'Online' : 'Offline'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button type="button" onClick={() => alert("Outgoing secure VOIP link...")} className="hover:text-indigo-400 transition"><Phone size={18} /></button>
            <button type="button" onClick={() => alert("P2P video session...")} className="hover:text-indigo-400 transition"><Video size={18} /></button>
            <button type="button" className="hover:text-slate-200 transition"><MoreVertical size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-36">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === currentUserId;
            const isInferredImage = msg.type === 'image' || msg.content?.match(/\.(jpeg|jpg|gif|png|webp)/i) || msg.content?.includes('/uploads/');

            return (
              <div key={i} className={`flex ${isMe? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMe? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border-slate-700'}`}>
                  {msg.isViewOnce? (
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-amber-400 font-bold"><ShieldAlert size={14} /> View Once Vault</span>
                      {msg.content === '🔒 Media Content Expired'? (
                        <span className="text-slate-500 italic text-xs">{msg.content}</span>
                      ) : (
                        <button type="button" onClick={() => handleOpenViewOnce(msg.dbId, msg.messageId)} className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg text-xs hover:bg-amber-500/30 transition mt-1"><Eye size={12} /> Reveal Secret</button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {isInferredImage? (
                        <div className="p-1 bg-slate-900/40 rounded-xl max-w-[240px] cursor-pointer hover:opacity-90 transition" onClick={() => setSelectedImageUrl(msg.content)}>
                          <img src={msg.content} alt="Attachment Preview" className="rounded-lg object-cover max-h-48 w-full border-slate-700 shadow-sm" />
                        </div>
                      ) : msg.type === 'video'? (
                        <div className="p-1 bg-slate-900/40 rounded-xl max-w-[240px]"><video src={msg.content} controls className="rounded-lg max-h-48 w-full" /></div>
                      ) : msg.type === 'audio'? (
                        <div className="p-1.5 bg-slate-900/40 rounded-xl flex-col gap-1 w-48"><div className="flex items-center gap-2 text-emerald-400 text-xs font-bold"><Mic size={14} /> Recorded Audio</div><audio src={msg.content} controls className="w-full h-8 mt-1 scale-95 origin-left" /></div>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <footer className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 p-3 z-40">
          <div className="max-w-2xl mx-auto flex-col gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-xl transition shrink-0" title="Upload Image"><Image size={18} /></button>
              <button type="button" onClick={() => videoInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-xl transition shrink-0" title="Upload Video"><Film size={18} /></button>
              <button type="button" onClick={isRecording? stopRecordingAudio : startRecordingAudio} className={`p-2 rounded-xl transition shrink-0 ${isRecording? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50'}`}>{isRecording? <Square size={18} /> : <Mic size={18} />}</button>
              <button type="button" className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-xl transition shrink-0"><Paperclip size={18} /></button>
              <div className="h-4 w-[1px] bg-slate-700 mx-1 shrink-0"></div>
              <button type="button" onClick={() => setViewOnceToggle(!viewOnceToggle)} className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0 ${viewOnceToggle? 'bg-amber-500 text-slate-900 scale-105' : 'bg-slate-700/50 text-amber-400 hover:bg-slate-700'}`}><ShieldAlert size={16} /> View Once</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 text-slate-400 hover:text-slate-200 transition shrink-0"><Smile size={18} /></button>
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder={isRecording? "Recording active..." : "Type text message entry string..."}
                disabled={isRecording}
                className="flex-1 bg-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendMessage('text'); } }}
              />
              <button type="button" onClick={() => handleSendMessage('text')} disabled={!typedMessage.trim() || isRecording} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 p-2.5 rounded-xl text-white transition shrink-0"><Send size={16} /></button>
            </div>
          </div>
        </footer>
      </div>

      {selectedImageUrl && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 transition" onClick={() => setSelectedImageUrl(null)}>
          <button type="button" className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold bg-slate-800/80 px-3 py-1.5 rounded-xl border-slate-700 transition">✕ Close Theater View</button>
          <img src={selectedImageUrl} alt="Expanded Media Theater" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl border-slate-800" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}