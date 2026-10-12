import { MONTHS_SHORT } from './calendar';
import { supabase } from './supabase';
import type { Task, TaskCategory } from '../types';

const MAX_INPUT_LENGTH = 6_000;
const MAX_TASKS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!match) return false;
  if (value.includes('T') && Number.isNaN(new Date(value).getTime())) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function displayDue(dueDate: string | null, hasTime: boolean): { due: string; dueTime: string } {
  if (!dueDate) return { due: 'No due date', dueTime: '' };

  const [datePart] = dueDate.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  let dueTime = '';
  if (hasTime && dueDate.includes('T')) {
    const date = new Date(dueDate);
    if (!Number.isNaN(date.getTime())) {
      dueTime = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }
  return {
    due: `${MONTHS_SHORT[month - 1]} ${day}, ${year}${dueTime ? ` · ${dueTime}` : ''}`,
    dueTime,
  };
}

function parseTaskList(value: unknown): Task[] {
  const rawTasks = Array.isArray(value) ? value : isRecord(value) ? value.tasks : null;
  if (!Array.isArray(rawTasks) || rawTasks.length > MAX_TASKS) {
    throw new Error('The task parser returned an invalid task list. Please try again.');
  }

  const createdAt = new Date().toISOString();
  return rawTasks.map((item): Task => {
    if (!isRecord(item) || typeof item.title !== 'string' || !item.title.trim()) {
      throw new Error('The task parser returned an invalid task. Please try again.');
    }
    const title = item.title.trim();
    const dateValue = typeof item.dueDate === 'string' ? item.dueDate : null;
    if (dateValue && !validDate(dateValue)) {
      throw new Error('The task parser returned an invalid due date. Please try again.');
    }
    const dueDate = dateValue;
    const hasTime = Boolean(item.hasTime) && Boolean(dueDate?.includes('T'));
    const category: TaskCategory =
      item.category === 'study' || item.category === 'personal' || item.category === 'general'
        ? item.category
        : 'general';
    const { due, dueTime } = displayDue(dueDate, hasTime);

    return {
      id: crypto.randomUUID(),
      title,
      dueDate,
      hasTime,
      category,
      isCompleted: false,
      createdAt,
      subject: category.toUpperCase(),
      due,
      dueTime,
      status: 'Todo',
      urgent: false,
      timeEst: '30m',
    };
  });
}

async function messageFromFunctionError(error: { context?: unknown }, fallback: string): Promise<Error> {
  if (error.context instanceof Response) {
    const response = error.context;
    try {
      const body: unknown = await response.clone().json();
      if (isRecord(body) && typeof body.error === 'string') return new Error(body.error);
    } catch {
      // Use the bounded, non-sensitive fallback below for non-JSON gateway errors.
    }
    if (response.status === 401 || response.status === 403) {
      return new Error('Please sign in again before using Brain Dump.');
    }
  }
  return new Error(fallback);
}

export async function parseBrainDump(userInput: string): Promise<Task[]> {
  const input = userInput.trim();
  if (!input) return [];
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error('Please keep your brain dump under 6,000 characters.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35_000);
  try {
    const { data, error } = await supabase.functions.invoke('parse-brain-dump', {
      body: { userInput: input },
      signal: controller.signal,
    });
    if (error) {
      console.error('[brain-dump] Supabase Edge Function invocation failed', error.name);
      throw await messageFromFunctionError(error, 'Brain Dump is temporarily unavailable. Please try again.');
    }
    return parseTaskList(data);
  } finally {
    window.clearTimeout(timeout);
  }
}
