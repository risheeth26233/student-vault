// Calculator Component — display, keypad and keyboard input.
// Expression evaluation is delegated to the safe evaluator in expression.ts (no eval).
// Note: `cn` does not de-duplicate conflicting Tailwind utilities, so each key
// variant supplies its own complete color/height classes with no overlaps.

import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  evaluateExpression,
  formatResult,
  formatForDisplay,
  MAX_EXPRESSION_LENGTH,
} from './expression';

type Key = string; // '0'-'9' | '.' | '+' | '-' | '*' | '/' | '=' | 'C' | 'back'

const OPERATORS = new Set(['+', '-', '*', '/']);

const keyBase =
  'flex items-center justify-center rounded-xl border transition select-none font-semibold text-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const digitClass =
  'border-border bg-surface text-ink hover:bg-gray-50 h-12 sm:h-14';
const operatorClass =
  'border-border bg-gray-50 text-ink hover:bg-gray-100 h-12 sm:h-14';
const clearClass =
  'border-border bg-surface text-coral-600 hover:bg-coral-50 h-12 sm:h-14';
const equalsClass =
  'border-teal-600 bg-teal-600 text-white hover:bg-teal-700 row-span-2';

interface KeyDef {
  key: Key;
  label: React.ReactNode;
  className: string;
  ariaLabel?: string;
  testId?: string;
}

const keys: KeyDef[] = [
  { key: 'C', label: 'C', className: clearClass, ariaLabel: 'Clear' },
  { key: 'back', label: <Delete className="w-5 h-5" aria-hidden="true" />, className: digitClass, ariaLabel: 'Backspace', testId: 'key-back' },
  { key: '/', label: '÷', className: operatorClass, ariaLabel: 'Divide' },
  { key: '*', label: '×', className: operatorClass, ariaLabel: 'Multiply' },
  { key: '7', label: '7', className: digitClass },
  { key: '8', label: '8', className: digitClass },
  { key: '9', label: '9', className: digitClass },
  { key: '-', label: '−', className: operatorClass, ariaLabel: 'Subtract' },
  { key: '4', label: '4', className: digitClass },
  { key: '5', label: '5', className: digitClass },
  { key: '6', label: '6', className: digitClass },
  { key: '+', label: '+', className: operatorClass, ariaLabel: 'Add' },
  { key: '1', label: '1', className: digitClass },
  { key: '2', label: '2', className: digitClass },
  { key: '3', label: '3', className: digitClass },
  { key: '=', label: '=', className: equalsClass, ariaLabel: 'Equals' },
  { key: '0', label: '0', className: `${digitClass} col-span-2` },
  { key: '.', label: '.', className: operatorClass, ariaLabel: 'Decimal point' },
];

export function Calculator() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setExpression('');
    setResult(null);
    setError(null);
  };

  const backspace = () => {
    if (error) {
      setError(null);
      // fall through and trim the failed expression
    }
    if (result !== null) {
      // Resume editing from the shown result
      setExpression(result.slice(0, -1));
      setResult(null);
      return;
    }
    setExpression((prev) => prev.slice(0, -1));
  };

  const evaluate = () => {
    if (expression === '') {
      if (result === null) setError('Invalid expression');
      return;
    }
    const out = evaluateExpression(expression);
    if (out.ok) {
      setResult(formatResult(out.value));
      setError(null);
    } else {
      setResult(null);
      setError(out.error);
    }
  };

  const press = (key: Key) => {
    if (key === 'C') {
      clear();
      return;
    }
    if (key === 'back') {
      backspace();
      return;
    }
    if (key === '=') {
      evaluate();
      return;
    }

    const isOperator = OPERATORS.has(key);

    if (error) {
      // Keep editing the failed expression; any input dismisses the error.
      setError(null);
    }

    if (result !== null) {
      if (isOperator) {
        setExpression(result + key);
      } else {
        setExpression(key === '.' ? '0.' : key);
      }
      setResult(null);
      return;
    }

    if (expression.length >= MAX_EXPRESSION_LENGTH) return;

    if (isOperator) {
      if (expression === '') {
        // Only a sign makes sense at the start (unary minus/plus).
        if (key === '-' || key === '+') setExpression(key);
        return;
      }
      setExpression(expression + key);
      return;
    }

    if (key === '.') {
      const lastNumber = expression.split(/[-+*/]/).pop() ?? '';
      if (lastNumber.includes('.')) return;
      if (expression === '') {
        setExpression('0.');
        return;
      }
      setExpression(expression + key);
      return;
    }

    setExpression(expression + key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      let key: Key | null = null;
      if (/^[0-9]$/.test(event.key)) key = event.key;
      else if (event.key === '.' || event.key === ',') key = '.';
      else if (event.key === '+' || event.key === '-') key = event.key;
      else if (event.key === '*' || event.key === 'x' || event.key === 'X') key = '*';
      else if (event.key === '/') key = '/';
      else if (event.key === 'Enter' || event.key === '=') key = '=';
      else if (event.key === 'Backspace') key = 'back';
      else if (event.key === 'Escape' || event.key === 'c' || event.key === 'C') key = 'C';

      if (key === null) return;
      event.preventDefault();
      press(key);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const mainDisplay = error
    ? error
    : result !== null
      ? formatForDisplay(result)
      : expression
        ? formatForDisplay(expression)
        : '0';
  const contextDisplay = error
    ? expression
      ? formatForDisplay(expression)
      : ''
    : result !== null && expression
      ? `${formatForDisplay(expression)} =`
      : '';

  return (
    <div className="w-full max-w-md mx-auto" role="group" aria-label="Calculator">
      <div
        className="rounded-xl border border-border bg-gray-50 p-4 sm:p-5 text-right"
        role="status"
        aria-live="polite"
      >
        <div className="h-5 text-sm text-ink-muted truncate" data-testid="calc-context">
          {contextDisplay}
        </div>
        <div
          className={cn(
            'mt-1 font-bold break-all',
            error ? 'text-2xl sm:text-3xl text-coral-600' : 'text-3xl sm:text-4xl text-ink'
          )}
          data-testid="calc-display"
        >
          {mainDisplay}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3" aria-label="Calculator keypad">
        {keys.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => press(item.key)}
            className={cn(keyBase, item.className)}
            aria-label={item.ariaLabel ?? (typeof item.label === 'string' ? item.label : undefined)}
            data-testid={item.testId ?? `key-${item.key}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
