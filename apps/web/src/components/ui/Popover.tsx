import React, { useEffect, useRef, useState } from 'react';
import './Popover.css';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  triggerClassName?: string;
}

const Popover: React.FC<PopoverProps> = ({ trigger, children, placement = 'bottom', triggerClassName }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className={`popover popover-${placement}`} data-no-swipe="true">
      <button type="button" className={`popover-trigger ${triggerClassName || ''}`.trim()} onClick={() => setOpen((v) => !v)}>
        {trigger}
      </button>
      {open && <div className="popover-panel">{children}</div>}
    </div>
  );
};

export default Popover;
