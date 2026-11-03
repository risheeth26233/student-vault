import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Input, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export interface InterventionEdit {
  id: string;
  mode: 'feedback' | 'review' | 'complete';
  hasTopic?: boolean;
}
export function InterventionEditor({ edit, onClose, onSave }: {
  edit: InterventionEdit;
  onClose: () => void;
  onSave: (values: { note: string; followUp: boolean; score?: number; maximum?: number }) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [score, setScore] = useState('');
  const [maximum, setMaximum] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const completing = edit.mode === 'complete';
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <DialogTitle>{completing ? 'Complete your follow-up' : edit.mode === 'review' ? 'Review the outcome' : 'Feedback for your student'}</DialogTitle>
      <DialogDescription>{completing ? 'Describe your work and record a reassessment for the same topic. These are student-entered results.' : 'Give a clear next step supported by the recorded work. Feedback becomes available to the student after saving.'}</DialogDescription>
      <form className="space-y-5" onSubmit={async event => {
        event.preventDefault(); setError('');
        if (!note.trim()) { setError('Add a short note before saving.'); return; }
        if (completing && edit.hasTopic && (!/^\d+$/.test(score) || !/^\d+$/.test(maximum) || Number(maximum) < 1 || Number(score) > Number(maximum))) { setError('Enter whole-number scores between zero and the maximum.'); return; }
        setBusy(true);
        try { await onSave({ note: note.trim(), followUp, ...(completing && edit.hasTopic ? { score: Number(score), maximum: Number(maximum) } : {}) }); onClose(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your text is preserved; try again.'); }
        finally { setBusy(false); }
      }}>
        <Textarea label={completing ? 'What did you complete or learn?' : 'Feedback'} value={note} onChange={event => setNote(event.target.value)} required maxLength={2000} rows={5} disabled={busy} />
        {completing && edit.hasTopic && <div className="grid grid-cols-2 gap-4"><Input label="Reassessment score" type="number" min="0" step="1" value={score} onChange={event => setScore(event.target.value)} required disabled={busy} /><Input label="Maximum score" type="number" min="1" step="1" value={maximum} onChange={event => setMaximum(event.target.value)} required disabled={busy} /></div>}
        {edit.mode === 'review' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={followUp} onChange={event => setFollowUp(event.target.checked)} disabled={busy} className="mt-1" />Another teacher follow-up is required</label>}
        {error && <p role="alert" className="text-sm text-coral-600">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save {completing ? 'completion' : 'feedback'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
