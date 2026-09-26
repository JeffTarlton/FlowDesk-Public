import { useMemo } from 'react';
import { useTicketStore } from '../store/useTicketStore';

interface CustomerDropdownProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function CustomerDropdown({ value, onChange, className = '' }: CustomerDropdownProps) {
  const { tickets } = useTicketStore();

  const customers = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach(ticket => {
      if (ticket.customer_name) {
        names.add(ticket.customer_name.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px] ${className}`}
    >
      <option value="">All Customers</option>
      {customers.map(customer => (
        <option key={customer} value={customer}>
          {customer}
        </option>
      ))}
    </select>
  );
}
