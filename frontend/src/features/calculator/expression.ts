// Safe arithmetic expression evaluator (no eval / no arbitrary code execution).
// Grammar:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := ('+' | '-')* number
// Division by zero and malformed input produce typed error messages.

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export const INVALID_EXPRESSION = 'Invalid expression';
export const DIVIDE_BY_ZERO = 'Cannot divide by zero';

const MAX_EXPRESSION_LENGTH = 64;

class CalcError extends Error {}

type Token = { type: 'num'; value: number } | { type: 'op'; value: '+' | '-' | '*' | '/' };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '.' || (ch >= '0' && ch <= '9')) {
      let j = i;
      let seenDot = false;
      let seenDigit = false;
      while (j < src.length) {
        const c = src[j];
        if (c === '.') {
          if (seenDot) break;
          seenDot = true;
        } else if (c >= '0' && c <= '9') {
          seenDigit = true;
        } else {
          break;
        }
        j++;
      }
      const raw = src.slice(i, j);
      if (!seenDigit) throw new CalcError(INVALID_EXPRESSION);
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) throw new CalcError(INVALID_EXPRESSION);
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    // Anything else (letters, parentheses, symbols…) is invalid.
    throw new CalcError(INVALID_EXPRESSION);
  }
  return tokens;
}

function parse(tokens: Token[]): number {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];

  function parseExpr(): number {
    let value = parseTerm();
    for (;;) {
      const t = peek();
      if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        pos++;
        const rhs = parseTerm();
        value = t.value === '+' ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      const t = peek();
      if (t?.type === 'op' && (t.value === '*' || t.value === '/')) {
        pos++;
        const rhs = parseFactor();
        if (t.value === '/') {
          if (rhs === 0) throw new CalcError(DIVIDE_BY_ZERO);
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else {
        return value;
      }
    }
  }

  function parseFactor(): number {
    let sign = 1;
    while (peek()?.type === 'op') {
      const t = peek() as { type: 'op'; value: '+' | '-' | '*' | '/' };
      if (t.value === '-') sign = -sign;
      else if (t.value !== '+') throw new CalcError(INVALID_EXPRESSION); // * / cannot start a factor
      pos++;
    }
    const t = peek();
    if (!t || t.type !== 'num') throw new CalcError(INVALID_EXPRESSION);
    pos++;
    return sign * t.value;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new CalcError(INVALID_EXPRESSION);
  if (!Number.isFinite(result)) throw new CalcError(INVALID_EXPRESSION);
  return result;
}

export function evaluateExpression(input: string): EvalResult {
  try {
    const tokens = tokenize(input);
    if (tokens.length === 0) throw new CalcError(INVALID_EXPRESSION);
    return { ok: true, value: parse(tokens) };
  } catch (error) {
    if (error instanceof CalcError) return { ok: false, error: error.message };
    return { ok: false, error: INVALID_EXPRESSION };
  }
}

/** Format a result for display: trim float noise, cap at 12 significant digits. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

/** Convert an internal ASCII expression (star, slash, minus) to display glyphs (×÷−). */
export function formatForDisplay(text: string): string {
  return text.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}

export { MAX_EXPRESSION_LENGTH };
