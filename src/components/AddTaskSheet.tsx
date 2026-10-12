import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../lib/language';
import { formatDueLabel, formatDuration, formatTimeValue, toIsoDate } from '../lib/calendar';
import type { NewTaskInput, Task, TaskStatus } from '../types';
import { WheelPicker } from './WheelPicker';
import { MiniCalendar } from './MiniCalendar';
import { ToggleSwitch } from './ToggleSwitch';

interface FieldBlockProps {
  label: string;
  children: React.ReactNode;
}

function FieldBlock({ label, children }: FieldBlockProps) {
  return (
    <div>
      <p className="type-label mb-2">{label}</p>
      {children}
    </div>
  );
}

interface AddTaskSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: NewTaskInput) => void;
  initialTask: Task | null;
}

function timePickerValue(task: Task): string {
  const time = task.dueTime || task.dueDate?.match(/T(\d{2}):(\d{2})/)?.slice(1).join(':') || '';
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (twelveHour) return `${Number(twelveHour[1])}:${twelveHour[2]} ${twelveHour[3].toUpperCase()}`;
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!twentyFourHour) return '9:00 AM';
  const hour = Number(twentyFourHour[1]);
  return `${hour % 12 || 12}:${twentyFourHour[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function AddTaskSheet({ open, onClose, onSubmit, initialTask }: AddTaskSheetProps) {
  const now = new Date();
  const { language, t } = useLanguage();
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [urgent, setUrgent] = useState(false);
  const [timeEst, setTimeEst] = useState('1h 00m');
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calDay, setCalDay] = useState<number | null>(null);
  const [dueTime, setDueTime] = useState('9:00 AM');
  const [hasTime, setHasTime] = useState(true);
  const [error, setError] = useState('');

  const timeOptions = useMemo(() => Array.from({ length: 96 }, (_, index) => {
    const hour = Math.floor(index / 4);
    const minute = (index % 4) * 15;
    const value = `${String(hour % 12 || 12)}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
    return { value, label: formatTimeValue(hour, minute, language) };
  }), [language]);
  const estimateOptions = useMemo(() => Array.from({ length: 48 }, (_, index) => {
    const totalMinutes = (index + 1) * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = hours === 0 ? `${minutes}m` : `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return { value, label: formatDuration(value, language) };
  }), [language]);
  const selectedTimeLabel = timeOptions.find((option) => option.value === dueTime)?.label ?? dueTime;
  function addCategory(){const v=categoryInput.trim().replace(/,$/,'');if(v&&!categories.some(x=>x.toLowerCase()===v.toLowerCase()))setCategories(xs=>[...xs,v]);setCategoryInput('')}

  function populate(task: Task | null): void {
    setError('');
    if (!task) {
      setCategories([]);
      setCategoryInput('');
      setTitle('');
      setStatus('Todo');
      setUrgent(false);
      setTimeEst('1h 00m');
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
      setCalDay(null);
      setDueTime('9:00 AM');
      setHasTime(true);
      return;
    }

    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(task.dueDate ?? '');
    setCategories(task.subject.split(',').map((category) => category.trim()).filter(Boolean));
    setCategoryInput('');
    setTitle(task.title);
    setStatus(task.status);
    setUrgent(task.urgent);
    setTimeEst(task.timeEst);
    setCalYear(date ? Number(date[1]) : now.getFullYear());
    setCalMonth(date ? Number(date[2]) - 1 : now.getMonth());
    setCalDay(date ? Number(date[3]) : null);
    setDueTime(timePickerValue(task));
    setHasTime(task.hasTime);
  }

  useEffect(() => {
    if (open) populate(initialTask);
  }, [open, initialTask]);

  useEffect(() => {
    if (!open) return undefined;

    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function reset(): void {
    setCategories([]);
    setCategoryInput('');
    setTitle('');
    setStatus('Todo');
    setUrgent(false);
    setTimeEst('1h 00m');
    setCalDay(null);
    setDueTime('9:00 AM');
    setHasTime(true);
    setError('');
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleSubmit(): void {
    if (!title.trim()) {
      setError(t('Task title is required.'));
      return;
    }
    if (calDay === null && !initialTask) {
      setError(t('Due date is required.'));
      return;
    }

    const dueDate = calDay === null ? null : toIsoDate(calYear, calMonth, calDay);
    const due = calDay === null
      ? t('No due date')
      : formatDueLabel(calYear, calMonth, calDay, hasTime ? selectedTimeLabel : '', language);
    onSubmit({
      subject: categories.map(x=>x.trim().toUpperCase()).join(', ') || 'GENERAL',
      title: title.trim(),
      due,
      dueDate,
      dueTime: hasTime ? dueTime : '',
      status,
      urgent,
      timeEst,
      category: initialTask?.category ?? 'general',
      hasTime,
      isCompleted: status === 'Done',
      createdAt: initialTask?.createdAt ?? new Date().toISOString(),
    });
    reset();
  }

  function prevMonth(): void {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((year) => year - 1);
    } else {
      setCalMonth((month) => month - 1);
    }
    setCalDay(null);
  }

  function nextMonth(): void {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((year) => year + 1);
    } else {
      setCalMonth((month) => month + 1);
    }
    setCalDay(null);
  }

  return (
    <div
      className="absolute inset-0 z-[100] flex flex-col justify-end bg-overlay"
      onClick={handleClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
        className="max-h-[88%] w-full overflow-y-auto border-t border-[#d0d0d0] bg-page shadow-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-row px-6 pb-3.5 pt-[18px]">
          <div>
            <p className="mb-[3px] font-display text-[9px] font-bold tracking-widest text-accent-red">
              {t(initialTask ? 'EDIT TASK' : 'NEW TASK')}
            </p>
            <h2 id="add-task-title" className="font-display text-lg font-bold tracking-tighter text-charcoal">
              {t(initialTask ? 'Edit Task' : 'Add Task')}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('Close')}
            onClick={handleClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-sm border-hairline border-muted-4"
          >
            <X size={12} className="text-slate" />
          </button>
        </header>

        <div className="flex flex-col gap-[18px] px-6 pb-8 pt-5">
          <FieldBlock label={t('CATEGORY')}>
            <div className="mb-2 flex flex-wrap gap-1.5">{categories.map(category=><span key={category} className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-2.5 py-1.5 font-display text-[9px] font-semibold tracking-wide text-primary-contrast">{category}<button type="button" aria-label={t('Remove category')+': '+category} onClick={()=>setCategories(xs=>xs.filter(x=>x!==category))} className="ml-0.5 flex h-4 w-4 items-center justify-center opacity-70 hover:opacity-100">×</button></span>)}</div>
            <input type="text" value={categoryInput} onChange={e=>setCategoryInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addCategory()}}} placeholder={t('Type a category and press Enter')} className="w-full rounded-sm border border-border bg-transparent px-3 py-2.5 font-body text-[13px] text-charcoal outline-none focus:border-charcoal"/>
          </FieldBlock>

          <FieldBlock label={t('TASK TITLE')}>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('e.g. Problem Set 5')}
              className="w-full rounded-sm border border-border bg-transparent px-3 py-2.5 font-body text-[13px] text-charcoal outline-none"
            />
          </FieldBlock>

          <FieldBlock label={t('DUE DATE')}>
            <div
              className={`mb-2.5 rounded-sm border px-3 py-[9px] font-body text-[13px] ${
                calDay ? 'border-charcoal text-charcoal' : 'border-border text-muted-3'
              }`}
            >
              {calDay
                ? formatDueLabel(calYear, calMonth, calDay, selectedTimeLabel, language)
                : t('Select a date below')}
            </div>

            <MiniCalendar
              year={calYear}
              month={calMonth}
              selectedDay={calDay}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onSelectDay={setCalDay}
            />

            <div className="mt-3"><p className="mb-2 font-display text-[9px] font-semibold tracking-wider text-muted-2">{t('TIME')}</p><WheelPicker options={timeOptions} value={dueTime} onChange={(value) => { setDueTime(value); setHasTime(true); }} label={t('TIME')} hint={t('Scroll to select time')}/></div>
          </FieldBlock>

          <FieldBlock label={t('STATUS')}>
            <div className="flex gap-2">
              {(['Todo', 'In Progress', 'Done'] as TaskStatus[]).map((item) => {
                const selected = status === item;
                let className = 'border-hairline border-border bg-page text-muted-2';
                if (selected && item === 'Done') {
                  className = 'border border-muted-4 bg-surface-3 text-charcoal';
                } else if (selected && item === 'In Progress') {
                  className = 'border border-accent-red bg-accent-red text-white';
                } else if (selected) {
                  className = 'border border-primary bg-primary text-primary-contrast';
                }

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={`rounded-sm px-3 py-[7px] font-display text-[9px] font-semibold tracking-wide ${className}`}
                  >
                    {item.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </FieldBlock>

          <FieldBlock label={t('TIME ESTIMATE')}><WheelPicker options={estimateOptions} value={timeEst} onChange={setTimeEst} label={t('TIME ESTIMATE')} hint={t('Scroll to select an estimate')}/></FieldBlock>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] font-semibold tracking-wider text-slate">{t('URGENT')}</p>
              <p className="mt-0.5 text-[11px] text-muted-2">{t('Mark with red priority dot')}</p>
            </div>
            <ToggleSwitch
              checked={urgent}
              onChange={() => setUrgent((value) => !value)}
              label={t('URGENT')}
            />
          </div>

          {error ? <p className="font-body text-[11px] text-accent-red">{error}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            className="mt-1 w-full rounded-sm bg-primary py-3.5 font-display text-[11px] font-bold tracking-wider text-primary-contrast transition-opacity hover:opacity-90"
          >
            {t(initialTask ? 'SAVE CHANGES' : 'ADD TASK')}
          </button>
        </div>
      </section>
    </div>
  );
}
