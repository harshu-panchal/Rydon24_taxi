import React from 'react';
import SupportChatPanel from '../../../shared/components/SupportChatPanel';

const Chat = () => (
  <div className="space-y-4">
    <SupportChatPanel
      mode="admin"
      title="Chats"
      subtitle="Admin <-> User & Driver conversations"
    />
  </div>
);

export default Chat;
