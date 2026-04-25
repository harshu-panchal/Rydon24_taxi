import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportChatPanel from '../../../shared/components/SupportChatPanel';

const SupportChat = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => navigate('/taxi/driver/help-support')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-black text-slate-900">Support Chat</h1>
      </header>

      <SupportChatPanel
        mode="participant"
        preferredRole="driver"
        title="Driver Support Chat"
        subtitle="Live Messages"
        surface="plain"
        className="flex-1"
      />
    </div>
  );
};

export default SupportChat;
