import React from 'react';
import Phase1SessionUI from '../../App';
import GeometricCanvas from '../visual/GeometricCanvas';

const MainRoom: React.FC = () => {
  return (
    <div className="room-content" style={{ maxWidth: '100%', width: '100%', position: 'relative' }}>
      {/* Geometric 3D backdrop for focus */}
      <GeometricCanvas pattern="polyhedron" isActive={true} />
      <Phase1SessionUI />
    </div>
  );
};

export default MainRoom;
