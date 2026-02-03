import React, { useEffect, useId, useRef, useState } from 'react';
import './Popover.css';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  placement?: 'top' | 'bottom' | 'left' | 'right';
  triggerClassName?: string;
  triggerAriaLabel?: string;
  triggerAriaHaspopup?: 'menu' | 'dialog' | 'listbox' | 'tree' | 'grid';
  onOpenChange?: (open: boolean) => void;
}

const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  placement = 'bottom',
  triggerClassName,
  triggerAriaLabel,
  triggerAriaHaspopup,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const close = () => {
    setOpen(false);
    onOpenChange?.(false);
    triggerRef.current?.focus();
  };

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      onOpenChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={wrapperRef} className={`popover popover-${placement}`} data-no-swipe="true">
      <button
        ref={triggerRef}
        type="button"
        className={`popover-trigger ${triggerClassName || ''}`.trim()}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={triggerAriaLabel}
        aria-haspopup={triggerAriaHaspopup}
      >
        {trigger}
      </button>
      {open && (
        <div className="popover-panel" id={panelId}>
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
};

export default Popover;
