// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Input, Select } from './Input';
afterEach(cleanup);
it('keeps repeated field labels associated with unique controls and error messages', () => {
  render(<><Input label="Subject" error="First field needs a value" /><Input label="Subject" hint="Optional second subject" /></>);
  const inputs = screen.getAllByLabelText('Subject');
  expect(inputs[0].id).not.toBe(inputs[1].id);
  const errorId = inputs[0].getAttribute('aria-describedby');
  expect(document.getElementById(errorId!)?.textContent).toBe('First field needs a value');
});
it('preserves controlled select values with a placeholder', () => {
  render(<Select label="Topic" value="b" onChange={() => {}} placeholder="Choose a topic" options={[{value:'a',label:'First'},{value:'b',label:'Second'}]} />);
  expect((screen.getByLabelText('Topic') as HTMLSelectElement).value).toBe('b');
});
