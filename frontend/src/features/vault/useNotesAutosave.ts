// Debounced notes autosave with an explicit saving/saved/error indicator.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveTopicNotes } from '../../hooks/useTopics';
import type { Topic } from '../../types/api';

export type NotesSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 800;

export function useNotesAutosave(topic: Topic) {
  const saveNotes = useSaveTopicNotes();
  const saveRef = useRef(saveNotes);

  useEffect(() => {
    saveRef.current = saveNotes;
  }, [saveNotes]);

  const [value, setValue] = useState(topic.notes);
  const [status, setStatus] = useState<NotesSaveStatus>('idle');

  const timerRef = useRef<number | null>(null);
  const valueRef = useRef(topic.notes);
  const savedRef = useRef(topic.notes);
  const idRef = useRef(topic.id);
  const dirtyRef = useRef(false);

  // Re-sync when the card is reused for a different topic.
  useEffect(() => {
    if (idRef.current === topic.id) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    idRef.current = topic.id;
    valueRef.current = topic.notes;
    savedRef.current = topic.notes;
    dirtyRef.current = false;
    setValue(topic.notes);
    setStatus('idle');
  }, [topic.id, topic.notes]);

  const persist = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = valueRef.current;
    if (current === savedRef.current) {
      setStatus('idle');
      return;
    }
    setStatus('saving');
    saveRef.current.mutate(
      { id: idRef.current, notes: current },
      {
        onSuccess: () => {
          savedRef.current = current;
          dirtyRef.current = false;
          setStatus('saved');
        },
        onError: () => {
          setStatus('error');
        },
      }
    );
  }, []);

  const schedulePersist = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      persist();
    }, DEBOUNCE_MS);
  }, [persist]);

  const change = useCallback(
    (next: string) => {
      valueRef.current = next;
      dirtyRef.current = next !== savedRef.current;
      setValue(next);
      setStatus('idle');
      if (dirtyRef.current) schedulePersist();
    },
    [schedulePersist]
  );

  // Flush pending edits when the card unmounts (navigation, filter change…).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!dirtyRef.current || valueRef.current === savedRef.current) return;
      const current = valueRef.current;
      dirtyRef.current = false;
      saveRef.current.mutate(
        { id: idRef.current, notes: current },
        {
          onSuccess: () => {
            savedRef.current = current;
          },
        }
      );
    };
  }, []);

  return { value, status, change, flush: persist };
}
