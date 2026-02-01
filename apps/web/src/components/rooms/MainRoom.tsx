import React from 'react';
import Phase1SessionUI from '../../App';

const MainRoom: React.FC = () => {
  return (
    <div className="room-content" style={{ maxWidth: '100%', width: '100%', position: 'relative' }}>
      <Phase1SessionUI />
    </div>
  );
};

export default MainRoom;
