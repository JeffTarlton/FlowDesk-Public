import { TicketStatus } from '../types';
import { Check, PauseCircle, XCircle } from 'lucide-react';

interface Props {
  status: TicketStatus;
}

export default function TicketProgressBar({ status }: Props) {
  const STAGES = [
    { label: 'Intake', id: 0, statuses: ['pending', 'planning', 'sow_in_progress', 'awaiting_customer_approval'] },
    { label: 'Ready', id: 1, statuses: ['ready_for_dev'] },
    { label: 'In Progress', id: 2, statuses: ['dev_in_progress', 'in_review'] },
    { label: 'Approved', id: 3, statuses: ['beta_testing'] },
    { label: 'Released', id: 4, statuses: ['done'] }
  ];

  const isOnHold = status.startsWith('on_hold');
  const isRejected = status === 'rejected';

  let activeIndex = STAGES.findIndex(s => s.statuses.includes(status as any));

  if (isOnHold || isRejected) {
    return (
      <div className="mb-6 p-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-col items-center justify-center gap-2">
         {isOnHold ? (
           <>
             <PauseCircle className="text-orange-500 w-10 h-10 mb-1" />
             <div className="font-semibold text-lg text-gray-900 dark:text-white">Ticket is On Hold</div>
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{status.replace(/_/g, ' ')}</div>
           </>
         ) : (
           <>
             <XCircle className="text-red-500 w-10 h-10 mb-1" />
             <div className="font-semibold text-lg text-red-600 dark:text-red-400">Ticket Rejected</div>
           </>
         )}
      </div>
    );
  }

  // Fallback
  if (activeIndex === -1) activeIndex = 0;

  return (
    <div className="mb-6 px-4 pt-6 pb-10 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6 text-center">Ticket Progress</div>
      <div className="relative flex justify-between items-center w-full max-w-sm mx-auto">
        {/* Background Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full" />
        
        {/* Progress Line */}
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] bg-primary-500 rounded-full transition-all duration-500 ease-in-out" 
          style={{ width: `${(activeIndex / (STAGES.length - 1)) * 100}%` }}
        />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < activeIndex;
          const isActive = idx === activeIndex;

          return (
            <div key={stage.label} className="relative z-10 flex flex-col items-center gap-2">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  isCompleted ? 'bg-primary-500 border-primary-500 text-white shadow-sm' : 
                  isActive ? 'bg-white dark:bg-gray-900 border-primary-500 text-primary-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)] dark:shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 
                  'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                }`}
              >
                {isCompleted ? <Check size={12} strokeWidth={4} /> : <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary-500' : 'bg-transparent'}`} />}
              </div>
              <div 
                className={`absolute top-9 w-24 text-center text-[10px] uppercase font-bold tracking-wider ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 
                  isCompleted ? 'text-gray-600 dark:text-gray-400' : 
                  'text-gray-400 dark:text-gray-600'
                }`}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
