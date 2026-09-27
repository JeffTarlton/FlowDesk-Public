import { useId } from 'react';

interface LokdITLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  /** Small caption under the wordmark, e.g. the product name */
  subtitle?: string;
  /** For use on dark or colored backgrounds */
  inverted?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: 'w-8 h-8', text: 'text-lg', sub: 'text-[9px]' },
  md: { mark: 'w-10 h-10', text: 'text-xl', sub: 'text-[10px]' },
  lg: { mark: 'w-14 h-14', text: 'text-3xl', sub: 'text-xs' },
};

// LokdIT brand mark: a warm tile with a teal "aperture" square, matching the
// LokdIT site (lokdit.net). Brand colors are fixed so the mark stays the same
// whichever FlowDesk color theme is selected. The same artwork lives in public/favicon.svg.
export default function LokdITLogo({ size = 'md', showWordmark = true, subtitle, inverted = false, className = '' }: LokdITLogoProps) {
  const s = SIZES[size];
  const gradientId = `lokdit-aperture-${useId().replace(/:/g, '')}`;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        className={`${s.mark} shrink-0`}
        {...(showWordmark ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'LokdIT' })}
      >
        <defs>
          <linearGradient id={gradientId} x1="9" y1="9" x2="23" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2DD4BF" />
            <stop offset="1" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <rect
          width="32"
          height="32"
          rx="8"
          className={inverted ? 'fill-white' : 'fill-[#201D1A]'}
        />
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="7"
          fill="none"
          stroke="#2DD4BF"
          strokeOpacity={inverted ? 0.45 : 0.28}
        />
        <rect x="9" y="9" width="14" height="14" rx="4" fill={`url(#${gradientId})`} />
      </svg>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className={`${s.text} font-bold tracking-tight ${inverted ? 'text-white' : 'text-[#1F1B16] dark:text-[#F2EEE6]'}`}>
            Lokd
            <span
              className={
                inverted
                  ? 'text-[#99F6E4]'
                  : 'bg-gradient-to-br from-[#0D9488] to-[#115E59] dark:from-[#2DD4BF] dark:to-[#14B8A6] bg-clip-text text-transparent'
              }
            >
              IT
            </span>
          </span>
          {subtitle && (
            <span
              className={`${s.sub} mt-1 font-semibold uppercase tracking-[0.16em] ${inverted ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
