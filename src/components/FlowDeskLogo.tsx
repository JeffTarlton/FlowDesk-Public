interface FlowDeskLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  /** White mark and wordmark, for use on dark or colored backgrounds */
  inverted?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: 'w-8 h-8', text: 'text-lg' },
  md: { mark: 'w-10 h-10', text: 'text-xl' },
  lg: { mark: 'w-14 h-14', text: 'text-3xl' },
};

// FlowDesk brand mark: a rounded square with three kanban columns.
// The same artwork lives in public/favicon.svg.
export default function FlowDeskLogo({ size = 'md', showWordmark = true, inverted = false, className = '' }: FlowDeskLogoProps) {
  const s = SIZES[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        className={`${s.mark} shrink-0`}
        {...(showWordmark ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'FlowDesk' })}
      >
        <rect width="32" height="32" rx="8" className={inverted ? 'fill-white' : 'fill-primary-600 dark:fill-primary-500'} />
        <g className={inverted ? 'fill-primary-600' : 'fill-white'}>
          <rect x="7.5" y="8" width="4.5" height="16" rx="2.25" />
          <rect x="13.75" y="8" width="4.5" height="11" rx="2.25" />
          <rect x="20" y="8" width="4.5" height="6.5" rx="2.25" />
        </g>
      </svg>
      {showWordmark && (
        <span className={`${s.text} font-bold tracking-tight ${inverted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          Flow<span className={inverted ? 'text-primary-200' : 'text-primary-600 dark:text-primary-400'}>Desk</span>
        </span>
      )}
    </div>
  );
}
