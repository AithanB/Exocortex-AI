import { QUICK_PROMPTS } from '../mockData';
import type { ChatMessage, Task } from '../types';
import { localReply, type Lang } from './localReply';
import { supabase } from './supabase';

export interface AskParams {
  question: string;
  history: ChatMessage[];
  tasks: Task[];
  userName: string;
  language: Lang;
  signal?: AbortSignal;
}

export interface AskResult {
  text: string;
  source: 'gemini' | 'cache' | 'local';
  model?: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 50;
const cache = new Map<string, { text: string; model?: string; at: number }>();

function hash(value: string): string {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) + result + value.charCodeAt(index)) | 0;
  }
  return (result >>> 0).toString(36);
}

function cacheKey(params: AskParams): string | null {
  const question = params.question.trim().toLowerCase().replace(/\s+/g, ' ');
  const standalone = (QUICK_PROMPTS as readonly string[]).includes(params.question) || question.length >= 20;
  if (!standalone) return null;
  const context = JSON.stringify({
    language: params.language,
    userName: params.userName,
    question,
    history: params.history.slice(-6).map(({ role, text }) => [role, text]),
    tasks: params.tasks.map(({ id, title, status, dueDate, dueTime, urgent, timeEst }) =>
      [id, title, status, dueDate, dueTime, urgent, timeEst]),
  });
  return hash(context);
}

/** Calls the authenticated server-side function; no provider credentials enter the client bundle. */
export async function askGemini(params: AskParams): Promise<AskResult> {
  const fallback = (): AskResult => ({
    text: localReply(params.question, params.tasks, params.language, params.userName),
    source: 'local',
  });
  if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const key = cacheKey(params);
  if (key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return { text: cached.text, source: 'cache', model: cached.model };
    }
    if (cached) cache.delete(key);
  }

  try {
    const relevantTasks = params.tasks
      .filter((task) => task.status !== 'Done')
      .sort((a, b) => `${a.dueDate ?? ''} ${a.dueTime}`.localeCompare(`${b.dueDate ?? ''} ${b.dueTime}`))
      .slice(0, 15)
      .map(({ id, subject, title, dueDate, dueTime, status, urgent, timeEst }) => ({
        id,
        subject,
        title,
        dueDate,
        dueTime,
        status,
        urgent,
        timeEst,
      }));
    const { data, error } = await supabase.functions.invoke('study-ai', {
      body: {
        question: params.question,
        history: params.history.slice(-6).map(({ role, text }) => ({ role, text })),
        tasks: relevantTasks,
        userName: params.userName,
        language: params.language,
      },
      signal: params.signal,
    });
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error) {
      console.warn('[study-ai] Edge Function request failed', error.name);
      return fallback();
    }
    if (!data || typeof data.text !== 'string' || !data.text.trim()) {
      console.warn('[study-ai] Edge Function returned an invalid response.');
      return fallback();
    }

    const result: AskResult = {
      text: data.text.trim(),
      source: 'gemini',
      ...(typeof data.model === 'string' ? { model: data.model } : {}),
    };
    if (key) {
      if (cache.size >= CACHE_MAX) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(key, { text: result.text, model: result.model, at: Date.now() });
    }
    return result;
  } catch (error) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    console.warn('[study-ai] Could not reach the Edge Function; using the local reply.', error);
    return fallback();
  }
}
