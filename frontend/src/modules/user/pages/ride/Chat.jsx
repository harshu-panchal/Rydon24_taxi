import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Phone, Smile, Headset } from 'lucide-react';
import SupportChatPanel from '../../../shared/components/SupportChatPanel';

const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const peer = location.state?.peer || location.state?.driver || {};
  const searchParams = new URLSearchParams(location.search);
  const isAdminChat = searchParams.get('admin') === 'true';
  const routeRole = searchParams.get('role');
  const supportRole = routeRole === 'driver' || routeRole === 'user'
    ? routeRole
    : localStorage.getItem('role') === 'driver'
      ? 'driver'
      : 'user';
  const hasLiveToken = Boolean(
    supportRole === 'driver'
      ? localStorage.getItem('driverToken') || localStorage.getItem('token')
      : localStorage.getItem('userToken') || localStorage.getItem('token'),
  );
  const bottomRef = useRef(null);

  if (isAdminChat && hasLiveToken) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_60%,#EEF2F7_100%)] max-w-lg mx-auto flex flex-col font-sans relative overflow-hidden p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Support</p>
            <h1 className="text-[16px] font-black text-slate-900">
              {supportRole === 'driver' ? 'Driver Chat' : 'User Chat'}
            </h1>
          </div>
        </div>
        <SupportChatPanel
          mode="participant"
          title={supportRole === 'driver' ? 'Driver Support' : 'User Support'}
          subtitle="Connected to the support desk"
          preferredRole={supportRole}
        />
      </div>
    );
  }

  const initMessages = isAdminChat
    ? [{ id: 1, sender: 'other', text: 'Hello! How can we help you today?', time: '12:45' }]
    : [
        { id: 1, sender: 'other', text: 'Trip chat is connected.', time: '12:45' },
      ];

  const quickReplies = isAdminChat
    ? ['Payment Issue', 'Ride Cancelled', 'Lost Item', 'Safety']
    : ['Wait for me', "I'm coming", 'Where exactly?', 'Okay'];

  const [messages, setMessages] = useState(initMessages);
  const [input, setInput] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'user', text: msg, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) },
    ]);
    // Auto-reply simulation
    if (isAdminChat) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, sender: 'other', text: 'Thanks for reaching out! Our team will assist you shortly.', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) },
        ]);
      }, 1200);
    }
  };

  const otherName = isAdminChat ? 'Rydon24 Support' : peer.name || (supportRole === 'driver' ? 'Passenger' : 'Driver');
  const otherSub = isAdminChat ? 'Active now' : peer.subtitle || `${supportRole === 'driver' ? 'Passenger' : 'Driver'} - Active now`;
  const otherPhone = peer.phone || peer.mobile || peer.phoneNumber || '';
  const avatarName = encodeURIComponent(otherName);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_60%,#EEF2F7_100%)] max-w-lg mx-auto flex flex-col font-sans relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/50 blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-md px-4 py-3.5 flex items-center gap-3 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sticky top-0 z-20">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0">
          <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
        </motion.button>

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-[13px] flex items-center justify-center overflow-hidden border border-white/80 shadow-sm ${isAdminChat ? 'bg-orange-50' : 'bg-slate-100'}`}>
            {isAdminChat ? (
              <Headset size={18} className="text-orange-500" strokeWidth={2} />
            ) : (
              <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=f1f5f9&color=0f172a`} alt={otherName} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black text-slate-900 leading-tight">{otherName}</p>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">{otherSub}</p>
        </div>

        {!isAdminChat && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (!otherPhone) {
                window.alert('Phone number is not available for this chat yet.');
                return;
              }
              window.open(`tel:${String(otherPhone).replace(/[^\d+]/g, '')}`, '_self');
            }}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0"
          >
            <Phone size={15} className="text-slate-700" strokeWidth={2.5} />
          </motion.button>
        )}
      </motion.header>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, x: isUser ? 12 : -12 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ duration: 0.22 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-[18px] shadow-[0_2px_8px_rgba(15,23,42,0.06)] ${
                    isUser ? 'bg-slate-900 text-white rounded-br-[6px]' : 'bg-white/95 border border-white/80 text-slate-800 rounded-bl-[6px]'
                  }`}
                >
                  <p className="text-[14px] font-bold leading-relaxed">{m.text}</p>
                  <span className={`text-[9px] font-black mt-1 block uppercase tracking-wider ${isUser ? 'text-white/50' : 'text-slate-400'}`}>
                    {m.time}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="bg-white/90 backdrop-blur-md border-t border-white/80 px-4 pt-3 pb-6 space-y-2.5 shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
        {/* Quick replies */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {quickReplies.map((r) => (
            <motion.button key={r} whileTap={{ scale: 0.95 }} onClick={() => send(r)} className="shrink-0 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-600 active:bg-slate-100 transition-all">
              {r}
            </motion.button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 bg-slate-50/80 rounded-[16px] px-3 py-2 border border-slate-100">
          <Smile size={18} className="text-slate-400 shrink-0" strokeWidth={2} />
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => send()}
            className={`w-8 h-8 rounded-[10px] flex items-center justify-center transition-all shrink-0 ${
              input.trim() ? 'bg-slate-900 shadow-[0_4px_10px_rgba(15,23,42,0.2)]' : 'bg-slate-200'
            }`}
          >
            <Send size={14} className={input.trim() ? 'text-white' : 'text-slate-400'} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
