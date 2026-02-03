import React from 'react';
import './SegmentedControl.css';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel = '選択',
}: SegmentedControlProps<T>) => {
  return (
    <div className="segmented-control" role="group" aria-label={ariaLabel} data-no-swipe="true">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`segmented-item ${value === option.id ? 'is-active' : ''}`}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
