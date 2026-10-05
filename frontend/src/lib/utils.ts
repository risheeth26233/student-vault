// Utility functions

type ClassValue = string | undefined | null | false | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .filter((input): input is string | Record<string, boolean> => Boolean(input))
    .flatMap(input => 
      typeof input === 'string' 
        ? input.split(' ') 
        : Object.entries(input).filter(([, v]) => v).map(([k]) => k)
    )
    .join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}