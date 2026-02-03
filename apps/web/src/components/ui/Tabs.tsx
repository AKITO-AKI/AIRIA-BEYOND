import React, { useId } from 'react';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

const Tabs: React.FC<TabsProps> = ({ items, value, onChange, ariaLabel = 'タブ' }) => {
  const baseId = useId();

  return (
    <div className="tabs" data-no-swipe="true">
      <div className="tabs-list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => (
          <button
            key={item.id}
            id={`${baseId}-${item.id}-tab`}
            role="tab"
            aria-selected={value === item.id}
            aria-controls={`${baseId}-${item.id}-panel`}
            className={`tab-button ${value === item.id ? 'is-active' : ''}`}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-${item.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${item.id}-tab`}
          hidden={value !== item.id}
          className="tab-panel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
};

export default Tabs;
