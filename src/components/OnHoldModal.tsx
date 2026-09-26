import { X, HandMetal, Code, Headphones, FileText } from 'lucide-react';
import { TicketStatus } from '../types';

interface Props {
  onClose: () => void;
  onSelectCategory: (status: TicketStatus) => void;
}

export default function OnHoldModal({ onClose, onSelectCategory }: Props) {
  const options = [
    {
      id: 'on_hold_customer',
      title: 'Customer hold',
      description: 'Waiting on information or approval from the customer.',
      icon: <HandMetal size={24} className="text-blue-500" />
    },
    {
      id: 'on_hold_dev',
      title: 'Developer hold',
      description: 'Blocked by technical limitations, environment issues, or dependencies.',
      icon: <Code size={24} className="text-purple-500" />
    },
    {
      id: 'on_hold_support',
      title: 'Support hold',
      description: 'Pending external vendor review or internal support clarification.',
      icon: <Headphones size={24} className="text-green-500" />
    },
    {
      id: 'on_hold_sow',
      title: 'SOW hold',
      description: 'Awaiting Statement of Work creation or signature.',
      icon: <FileText size={24} className="text-orange-500" />
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800 animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-surface-dark/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Why is this request on hold?</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => onSelectCategory(option.id as TicketStatus)}
              className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left group"
            >
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:scale-110 transition-transform">
                {option.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5">{option.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
