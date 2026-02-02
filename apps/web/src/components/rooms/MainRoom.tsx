import React from 'react';
import ChatSessionUI from '../main/ChatSessionUI';

const MainRoom: React.FC = () => {
  return (
    <div className="room-content" style={{ maxWidth: '100%', width: '100%', position: 'relative' }}>
      <ChatSessionUI />
    </div>
  );
};

export default MainRoom;
