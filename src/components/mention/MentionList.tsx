import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Profile } from '../../types';

export interface MentionListProps {
  items: Profile[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.full_name || 'Unknown User' });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="bg-white dark:bg-surface-dark p-2 rounded-xl shadow-xl shadow-black/10 border border-gray-100 dark:border-gray-800 text-sm text-gray-500">
        No users found
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl shadow-black/10 border border-gray-100 dark:border-gray-800 overflow-hidden py-1 w-64 max-h-60 overflow-y-auto custom-scrollbar">
      {props.items.map((item, index) => {
        const fullName = item.full_name || 'Unknown User';
        return (
          <button
            key={item.id}
            className={`flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
            onClick={() => selectItem(index)}
          >
            {item.avatar_url ? (
              <img src={item.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate">{fullName}</span>
          </button>
        );
      })}
    </div>
  );
});

MentionList.displayName = 'MentionList';
