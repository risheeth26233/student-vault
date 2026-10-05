// Toast System
// Design system primitive with portal

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: React.ReactNode;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const toastIcons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastColors: Record<ToastType, string> = {
  success: 'bg-teal-50 border-teal-200 text-teal-800',
  error: 'bg-coral-50 border-coral-200 text-coral-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const toastIconColors: Record<ToastType, string> = {
  success: 'text-teal-600',
  error: 'text-coral-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = toastIcons[toast.type];
  
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in',
        toastColors[toast.type],
        'max-w-sm w-full'
      )}
      role="alert"
      aria-live="polite"
    >
      <div className={cn('flex-shrink-0 mt-0.5', toastIconColors[toast.type])}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm opacity-90">{toast.message}</p>
        )}
        {toast.action && (
          <div className="mt-3">{toast.action}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 opacity-50 hover:opacity-100" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastPortal toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastPortal({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full sm:max-w-md pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience helpers
export function useToastHelpers() {
  const { showToast } = useToast();
  
  return {
    success: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'success', title, message, ...options }),
    error: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'error', title, message, ...options }),
    warning: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'warning', title, message, ...options }),
    info: (title: string, message?: string, options?: Partial<Toast>) =>
      showToast({ type: 'info', title, message, ...options }),
  };
}

// Add animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-slide-in { animation: slide-in 200ms ease-out; }
  `;
  document.head.appendChild(style);
}