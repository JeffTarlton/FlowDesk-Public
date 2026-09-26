import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import React from 'react';

interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholderText?: string;
  className?: string;
  isClearable?: boolean;
}

export default function DatePicker({ selected, onChange, placeholderText, className, isClearable }: DatePickerProps) {
  // Custom Input forwardRef to integrate perfectly with Tailwind and existing UI
  const CustomInput = React.forwardRef<HTMLButtonElement, any>(   
    ({ value, onClick }, ref) => (
      <button
        ref={ref}
        onClick={onClick}
        type="button"
        className={`flex items-center justify-between w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
          value ? 'text-gray-900 dark:text-white' : 'text-gray-400'
        } ${className}`}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-gray-400 shrink-0" />
          {value || placeholderText || 'Pick a date'}
        </span>
        {isClearable && value && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={12} />
          </div>
        )}
      </button>
    )
  );

  return (
    <div className="relative">
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        customInput={<CustomInput />}
        dateFormat="MMM d, yyyy"
        wrapperClassName="w-full"
        popperPlacement="bottom-start"
        popperClassName="dark-theme-datepicker"
      />
    </div>
  );
}
