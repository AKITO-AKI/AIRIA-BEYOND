import React from 'react';
import './Menu.css';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

interface MenuProps {
  items: MenuItem[];
  autoFocus?: boolean;
}

const Menu: React.FC<MenuProps> = ({ items, autoFocus = true }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    if (!autoFocus) return;
    if (items.length === 0) return;
    const el = itemRefs.current[0];
    if (!el) return;
    el.focus();
  }, [autoFocus, items.length]);

  const focusIndex = (index: number) => {
    const bounded = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(bounded);
    const el = itemRefs.current[bounded];
    el?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusIndex(activeIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusIndex(activeIndex - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusIndex(items.length - 1);
      return;
    }
  };

  return (
    <div className="menu" role="menu" aria-orientation="vertical" onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.id}
          className="menu-item"
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          onFocus={() => setActiveIndex(index)}
          onClick={() => {
            setActiveIndex(index);
            item.onSelect();
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default Menu;
