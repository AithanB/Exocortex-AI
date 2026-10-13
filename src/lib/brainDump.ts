import { MONTHS_SHORT } from './calendar';
import { supabase } from './supabase';
import type { Task, TaskCategory } from '../types';

const MAX_INPUT_LENGTH = 6_000;
const MAX_TASKS = 30;
const GEMINI_TIMEOUT_MS = 12_000;

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

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, воскресенье: 0, воскресенья: 0, воскресенью: 0,
  monday: 1, mon: 1, понедельник: 1, понедельника: 1, понедельнику: 1,
  tuesday: 2, tue: 2, tues: 2, вторник: 2, вторника: 2, вторнику: 2,
  wednesday: 3, wed: 3, среда: 3, среды: 3, среду: 3, среде: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, четверг: 4, четверга: 4, четвергу: 4,
  friday: 5, fri: 5, пятница: 5, пятницу: 5, пятницы: 5, пятнице: 5,
  saturday: 6, sat: 6, суббота: 6, субботу: 6, субботы: 6, субботе: 6,
};

const ACTION_VERBS = [
  'сдать', 'сделать', 'закончить', 'подготовить', 'написать', 'прочитать', 'повторить',
  'выучить', 'позвонить', 'купить', 'сходить', 'пойти', 'встретиться', 'отправить',
  'проверить', 'убрать', 'записаться', 'оплатить', 'заказать', 'сдать',
  'finish', 'complete', 'prepare', 'write', 'read', 'review', 'study', 'call',
  'buy', 'go', 'visit', 'meet', 'send', 'check', 'clean', 'book', 'pay',
];

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function extractDate(text: string, now: Date): { date: Date | null; remaining: string } {
  let remaining = text;
  const explicitIso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(remaining);
  if (explicitIso) {
    const date = validCalendarDate(Number(explicitIso[1]), Number(explicitIso[2]), Number(explicitIso[3]));
    if (date) return { date, remaining: remaining.replace(explicitIso[0], ' ') };
  }

  const numericDate = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/.exec(remaining);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    let year = numericDate[3] ? Number(numericDate[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    let date = validCalendarDate(year, month, day);
    if (date && !numericDate[3] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      date = validCalendarDate(year + 1, month, day);
    }
    if (date) return { date, remaining: remaining.replace(numericDate[0], ' ') };
  }

  const relative = /(^|[^\p{L}\p{N}])(today|tomorrow|сегодня|завтра)(?=$|[^\p{L}\p{N}])/iu.exec(remaining);
  if (relative) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (/tomorrow|завтра/i.test(relative[2])) date.setDate(date.getDate() + 1);
    return { date, remaining: remaining.replace(relative[0], ' ') };
  }

  const weekday = /\b(next\s+)?(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b|(?:в|к|до)?\s*(воскресенье|воскресенья|воскресенью|понедельник|понедельника|понедельнику|вторник|вторника|вторнику|среда|среды|среду|среде|четверг|четверга|четвергу|пятница|пятницу|пятницы|пятнице|суббота|субботу|субботы|субботе)\b/i.exec(remaining);
  if (weekday) {
    const dayName = (weekday[2] || weekday[3]).toLowerCase();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let offset = (WEEKDAYS[dayName] - date.getDay() + 7) % 7;
    if (offset === 0 || weekday[1]) offset += 7;
    date.setDate(date.getDate() + offset);
    return { date, remaining: remaining.replace(weekday[0], ' ') };
  }
  return { date: null, remaining };
}

function extractTime(text: string): { hour: number | null; minute: number; remaining: string } {
  const match = /(?<![\p{L}\p{N}])(?:at|в)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/iu.exec(text);
  if (!match) return { hour: null, minute: 0, remaining: text };

  let hour = Number(match[1] ?? match[4]);
  const minute = Number(match[2] ?? match[5] ?? 0);
  const meridiem = (match[3] ?? match[6])?.toLowerCase();
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) {
    return { hour: null, minute: 0, remaining: text };
  }
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return { hour, minute, remaining: text.replace(match[0], ' ') };
}

function splitThoughts(input: string): string[] {
  const verbPattern = ACTION_VERBS.join('|');
  return input
    .replace(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s*/g, '\n')
    .split(/[\n;!?]+|,(?=\s)|\.(?=\s|$)/)
    .flatMap((part) => part.split(new RegExp(`(?<![\\p{L}\\p{N}])(?:and|also|и|а также)\\s+(?=(?:${verbPattern})(?![\\p{L}\\p{N}]))`, 'iu')))
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_TASKS);
}

function parseLocally(input: string): Task[] {
  const now = new Date();
  const candidates = splitThoughts(input).map((thought) => {
    const extractedDate = extractDate(thought, now);
    const extractedTime = extractTime(extractedDate.remaining);
    let title = extractedTime.remaining
      .replace(/\b(?:by|on|for|к|до|на)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.:–—-]+|[\s,.:–—-]+$/g, '')
      .trim();
    if (!title) title = thought.trim();

    const normalized = thought.toLowerCase();
    const category: TaskCategory =
      /экзамен|урок|учеб|лаборатор|домашн|лекци|курс|study|class|homework|exam|lecture|course|lab\b/.test(normalized)
        ? 'study'
        : /зал|трениров|спорт|врач|магазин|покуп|домой|gym|workout|doctor|shop|personal/.test(normalized)
          ? 'personal'
          : 'general';
    const dueDate = extractedDate.date ?? (extractedTime.hour !== null
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : null);
    if (dueDate && extractedTime.hour !== null) {
      dueDate.setHours(extractedTime.hour, extractedTime.minute, 0, 0);
    }
    const dateValue = dueDate
      ? `${isoDate(dueDate)}${extractedTime.hour !== null ? `T${String(extractedTime.hour).padStart(2, '0')}:${String(extractedTime.minute).padStart(2, '0')}:00` : ''}`
      : null;
    return {
      title,
      dueDate: dateValue,
      hasTime: extractedTime.hour !== null,
      category,
    };
  });

  return parseTaskList(candidates);
}

function isAuthError(error: { context?: unknown }): boolean {
  if (error.context instanceof Response) {
    return error.context.status === 401 || error.context.status === 403;
  }
  return false;
}

export async function parseBrainDump(userInput: string): Promise<Task[]> {
  const input = userInput.trim();
  if (!input) return [];
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error('Please keep your brain dump under 6,000 characters.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    try {
      const { data, error } = await supabase.functions.invoke('parse-brain-dump', {
        body: { userInput: input },
        signal: controller.signal,
      });
      if (error) {
        if (isAuthError(error)) {
          throw new Error('Please sign in again before using Brain Dump.');
        }
        console.warn('[brain-dump] Gemini unavailable; parsing locally.', error.name);
        return parseLocally(input);
      }
      try {
        return parseTaskList(data);
      } catch (error) {
        console.warn('[brain-dump] Invalid Gemini response; parsing locally.', error);
        return parseLocally(input);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Please sign in again before using Brain Dump.') {
        throw error;
      }
      console.warn('[brain-dump] Request failed; parsing locally.', error);
      return parseLocally(input);
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
