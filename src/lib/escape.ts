// Helpers for putting user-entered text (ticket titles, names, file names)
// into HTML strings and CSV files.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Makes text safe to interpolate into an HTML string (element content or a
// quoted attribute value).
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// One quoted CSV cell. A leading =, +, -, @, tab or carriage return makes
// Excel and Sheets treat the cell as a formula, so such values get a leading
// apostrophe (OWASP "CSV injection").
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Joins rows of raw values into CSV text, quoting every cell.
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
