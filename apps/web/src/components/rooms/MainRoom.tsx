import React from 'react';
import Phase1SessionUI from '../../App';
import GeometricCanvas from '../visual/GeometricCanvas';

const MainRoom: React.FC = () => {
  return (
    <div className="room-content" style={{ maxWidth: '100%', width: '100%', position: 'relative' }}>
      {/* C-1: Lissajous curve for harmony */}
      <GeometricCanvas pattern="lissajous" isActive={true} />
      <Phase1SessionUI />
    </div>
  );
};

export default MainRoom;
