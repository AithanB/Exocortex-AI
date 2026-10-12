import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { parseBrainDump } from '../lib/brainDump';
import { useLanguage } from '../lib/language';
import type { Task } from '../types';

interface BrainDumpInputProps {
  onTasksParsed: (tasks: Task[]) => Promise<void>;
}

export function BrainDumpInput({ onTasksParsed }: BrainDumpInputProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error' | null>(null);
  const submittingRef = useRef(false);
  const { t } = useLanguage();
  const canSubmit = value.trim().length > 0 && !loading;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setMessage(null);
    setMessageTone(null);
    try {
      const tasks = await parseBrainDump(value);
      if (tasks.length === 0) {
        setMessage(t('No actionable tasks found. Try adding a little more detail.'));
        setMessageTone('error');
        return;
      }
      await onTasksParsed(tasks);
      setValue('');
      setMessage(`${tasks.length} ${t(tasks.length === 1 ? 'task added successfully!' : 'tasks added successfully!')}`);
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Something went wrong. Please try again.'));
      setMessageTone('error');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="brain-dump-gradient my-6">
      <section className="brain-dump-gradient-content bg-page" aria-label={t('SMART BRAIN DUMP')}>
        <div className="mb-2 flex items-center gap-1.5 border-b border-row pb-2">
          <Sparkles size={13} className="text-accent-red" aria-hidden />
          <p className="font-display text-[9px] font-bold tracking-widest text-charcoal">{t('SMART BRAIN DUMP')}</p>
        </div>
        <textarea
          value={value}
          disabled={loading}
          onChange={(event) => setValue(event.target.value)}
          maxLength={6_000}
          rows={3}
          placeholder={t('Dump your thoughts (e.g., ‘Do physics lab by Friday, go to gym tomorrow at 6 PM’)…')}
          className="w-full resize-none rounded-sm border border-ui bg-surface px-3 py-2.5 font-body text-[12px] leading-relaxed text-charcoal outline-none placeholder:text-muted-3 transition-colors focus:border-charcoal focus:bg-page disabled:cursor-wait disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={`font-body text-[10px] ${messageTone === 'success' ? 'text-success' : 'text-accent-red'}`} role="status">
            {message}
          </p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`shrink-0 rounded-sm bg-primary px-3 py-2 font-display text-[9px] font-bold tracking-wider text-primary-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              loading ? 'animate-pulse' : ''
            }`}
          >
            {loading ? t('PARSING') : t('ADD TASKS')}
          </button>
        </div>
      </section>
    </div>
  );
}
