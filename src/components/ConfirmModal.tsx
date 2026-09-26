import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = true
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-6 animate-slide-in">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 p-1.5 rounded-lg"
        >
          <X size={20} />
        </button>
        
        <div className="flex flex-col items-center text-center mt-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${
            isDestructive 
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
          }`}>
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">{message}</p>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors shadow-md ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' 
                  : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
