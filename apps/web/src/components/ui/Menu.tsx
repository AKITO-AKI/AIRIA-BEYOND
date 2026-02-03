import React from 'react';
import './Menu.css';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

interface MenuProps {
  items: MenuItem[];
}

const Menu: React.FC<MenuProps> = ({ items }) => {
  return (
    <div className="menu" role="menu">
      {items.map((item) => (
        <button
          key={item.id}
          className="menu-item"
          role="menuitem"
          onClick={item.onSelect}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default Menu;
