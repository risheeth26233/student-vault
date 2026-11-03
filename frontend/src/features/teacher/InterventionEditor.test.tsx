// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InterventionEditor } from './InterventionEditor';
afterEach(cleanup);
it('saves same-topic reassessment scores and closes only after success', async () => {
  const save = vi.fn().mockResolvedValue(undefined); const close = vi.fn();
  render(<InterventionEditor edit={{id:'test',mode:'complete',hasTopic:true}} onClose={close} onSave={save} />);
  fireEvent.change(screen.getByLabelText('What did you complete or learn?'), {target:{value:'Checked each conversion'}});
  fireEvent.change(screen.getByLabelText('Reassessment score'), {target:{value:'7'}});
  fireEvent.change(screen.getByLabelText('Maximum score'), {target:{value:'10'}});
  fireEvent.click(screen.getByRole('button',{name:'Save completion'}));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith({note:'Checked each conversion',followUp:false,score:7,maximum:10});
});
it('retains feedback and shows an actionable error when saving fails', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Service unavailable')); const close = vi.fn();
  render(<InterventionEditor edit={{id:'test',mode:'feedback'}} onClose={close} onSave={save} />);
  fireEvent.change(screen.getByLabelText('Feedback'), {target:{value:'Explain your second step'}});
  fireEvent.click(screen.getByRole('button',{name:'Save feedback'}));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Feedback') as HTMLTextAreaElement).value).toBe('Explain your second step');
  expect(close).not.toHaveBeenCalled();
});
