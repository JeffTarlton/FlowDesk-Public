/**
 * Jira-style time utilities for FlowDesk tracking.
 * 1 week (1w) = 40 hours
 * 1 day (1d) = 8 hours
 * 1 hour (1h) = 1 hour
 * 
 * Supports strings like "1w 2d 4h" or "2.5h" or just raw numbers.
 */

export function parseTimeToHours(input: string | number): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  
  if (typeof input === 'number') {
    return input;
  }

  const cleanStr = input.trim().toLowerCase();
  
  // If it's just a raw number string
  if (!isNaN(Number(cleanStr)) && cleanStr !== '') {
    return parseFloat(cleanStr);
  }

  // Regex to match chunks like "1w", "2d", "4.5h", ".5d"
  const regex = /([\d.]+)([wdh])/g;
  let matches;
  let totalHours = 0;
  let hasMatches = false;

  while ((matches = regex.exec(cleanStr)) !== null) {
    hasMatches = true;
    const value = parseFloat(matches[1]);
    const unit = matches[2];

    switch (unit) {
      case 'w':
        totalHours += value * 40;
        break;
      case 'd':
        totalHours += value * 8;
        break;
      case 'h':
        totalHours += value;
        break;
    }
  }

  return hasMatches ? totalHours : null;
}

export function formatHoursToTime(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return '—';
  }

  if (hours === 0) {
    return '0h';
  }

  let remaining = hours;
  const weeks = Math.floor(remaining / 40);
  remaining %= 40;
  
  const days = Math.floor(remaining / 8);
  remaining %= 8;

  const parts = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (remaining > 0) parts.push(`${remaining}h`); // Keep any decimal hours like 1.5h

  return parts.join(' ');
}
