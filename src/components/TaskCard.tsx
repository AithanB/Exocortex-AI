import { Check, ChevronRight, Clock, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STATUS_CYCLE } from '../mockData';
import type { Task, TaskStatus } from '../types';
import { useLanguage } from '../lib/language';
import { formatDuration } from '../lib/calendar';

interface TaskCardProps {
  task: Task;
  last: boolean;
  onStatusChange: (id: string, next: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  deleting: boolean;
  onExited: () => void;
}

function statusBadgeClass(status: TaskStatus): string {
  if (status === 'In Progress') {
    return 'border-accent-red bg-accent-red text-white';
  }
  if (status === 'Done') {
    return 'border-muted-4 bg-surface-3 text-muted';
  }
  return 'border-charcoal bg-page text-charcoal';
}

function statusDotClass(status: TaskStatus): string {
  if (status === 'In Progress') return 'bg-progress';
  if (status === 'Done') return 'bg-muted-3';
  return 'bg-charcoal';
}

export function TaskCard({ task, last, onStatusChange, onEdit, onDelete, deleting, onExited }: TaskCardProps) {
  const { language, t } = useLanguage();
  const done = task.status === 'Done';
  const [menuOpen, setMenuOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (!deleting) return undefined;
    const timeout = window.setTimeout(() => onExitedRef.current(), 240);
    return () => window.clearTimeout(timeout);
  }, [deleting]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnOutsideClick(event: PointerEvent): void {
      if (event.target instanceof Node && !articleRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  function cycleStatus(): void {
    const index = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
    onStatusChange(task.id, next);
  }

  function toggleDone(): void {
    onStatusChange(task.id, done ? 'Todo' : 'Done');
  }

  return (
    <article
      ref={articleRef}
      aria-hidden={deleting}
      className={`animate-task-enter relative transition-[max-height,opacity,padding] duration-200 ease-in ${
        deleting
          ? 'max-h-0 overflow-hidden py-0 opacity-0'
          : `max-h-[1000px] overflow-visible py-4 ${last ? '' : 'border-b border-row'}`
      }`}
    >
      <div className="mb-1.5 flex items-center gap-[7px]">
        <button
          type="button"
          aria-label={`${t(done ? 'Mark task as not done' : 'Mark task as done')}: ${task.title}`}
          aria-pressed={done}
          onClick={toggleDone}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border ${
            done ? 'border-muted-4 bg-surface-3' : 'border-charcoal bg-page'
          }`}
        >
          {done ? <Check size={11} strokeWidth={2.4} className="text-muted" /> : null}
        </button>
        {task.urgent ? (
          <span className="h-[7px] w-[7px] shrink-0 rounded-pill bg-accent-red" aria-label="Urgent" />
        ) : null}
        <p
          className={`font-display text-[9px] font-bold tracking-overline ${
            done ? 'text-muted-4' : 'text-[#888888]'
          }`}
        >
          {t(task.subject)}
        </p>
        <div className="flex-1" />
        <button
          type="button"
          title={t('Tap to advance status')}
          onClick={cycleStatus}
          className={`flex items-center gap-[5px] rounded-sm border px-2 py-[3px] ${statusBadgeClass(task.status)}`}
        >
          <span className={`h-[5px] w-[5px] shrink-0 rounded-pill ${statusDotClass(task.status)}`} />
          <span className="font-display text-[8px] font-bold tracking-[0.09em]">
            {t(task.status).toUpperCase()}
          </span>
          <ChevronRight size={10} className="opacity-50" aria-hidden />
        </button>
      </div>

      <p
        className={`mb-[7px] font-display text-sm leading-[1.3] ${
          done ? 'font-normal text-muted-3 line-through' : 'font-semibold text-charcoal'
        }`}
      >
        {task.title}
      </p>

      <div className="flex items-center gap-3.5 pr-9">
        <span className={`flex items-center gap-[5px] text-[10px] ${done ? 'text-muted-4' : 'text-[#888888]'}`}>
          <Clock size={10} className="text-muted-4" aria-hidden />
          {task.due}
        </span>
        <span className={`flex items-center gap-[5px] text-[10px] ${done ? 'text-muted-4' : 'text-[#888888]'}`}>
          <span className="font-display text-[9px] font-semibold tracking-wide text-muted-4">{t('EST')}</span>
          {formatDuration(task.timeEst, language)}
        </span>
      </div>
      <div className="absolute bottom-2 right-0">
        {menuOpen ? (
          <div
            role="menu"
            aria-label={`${task.title} ${t('Task options')}`}
            className="absolute bottom-full right-0 z-30 mb-1 min-w-32 border border-ui bg-page p-1 shadow-overlay"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(task);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left font-body text-[12px] text-charcoal hover:bg-surface-2"
            >
              <Pencil size={13} aria-hidden />
              {t('Edit')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete(task);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left font-body text-[12px] text-accent-red hover:bg-surface-2"
            >
              <Trash2 size={13} aria-hidden />
              {t('Delete')}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          aria-label={`${t('Task options')}: ${task.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-7 w-7 items-center justify-center text-muted-3 transition-colors hover:text-charcoal"
        >
          <Ellipsis size={16} aria-hidden />
        </button>
      </div>
    </article>
  );
}
