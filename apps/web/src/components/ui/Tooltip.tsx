import React, { useId, useState } from 'react';
import './Tooltip.css';

interface TooltipProps {
  label: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ label, children, placement = 'top' }) => {
  const id = useId();
  const [open, setOpen] = useState(false);

  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ');

  return (
    <span
      className={`tooltip-wrapper tooltip-${placement}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      data-no-swipe="true"
    >
      {React.cloneElement(children, {
        'aria-describedby': describedBy,
      })}
      <span
        id={id}
        role="tooltip"
        className={`tooltip-bubble ${open ? 'is-open' : ''}`}
      >
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
