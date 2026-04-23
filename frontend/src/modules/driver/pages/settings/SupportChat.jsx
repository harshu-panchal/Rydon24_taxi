import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportChatPanel from '../../../shared/components/SupportChatPanel';

const SupportChat = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 pb-8 pt-6 font-sans">
      <header className="mb-4 flex items-center gap-4">
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
        className="rounded-3xl"
      />
    </div>
  );
};

export default SupportChat;
