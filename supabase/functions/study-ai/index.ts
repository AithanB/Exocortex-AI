import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, requireAuthenticatedUser } from '../_shared/auth.ts';

const MAX_QUESTION_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_TASKS = 15;
const TOTAL_BUDGET_MS = 25_000;
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];

interface HistoryMessage {
  role: 'user' | 'ai';
  text: string;
}

interface PromptTask {
  subject: string;
  title: string;
  dueDate: string | null;
  dueTime: string;
  status: string;
  urgent: boolean;
  timeEst: string;
}

function responseError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders });
}

function models(): string[] {
  const configured = Deno.env.get('GEMINI_MODELS')
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean) ?? [];
  return [...new Set([...configured, ...DEFAULT_MODELS])];
}

function clip(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function normalizeHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-MAX_HISTORY_MESSAGES)
    .flatMap((item): HistoryMessage[] => {
      if (!item || typeof item !== 'object') return [];
      const message = item as Record<string, unknown>;
      if ((message.role !== 'user' && message.role !== 'ai') || typeof message.text !== 'string') return [];
      return [{ role: message.role, text: clip(message.text.trim(), 500) }];
    });
}

function normalizeTasks(value: unknown): PromptTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): PromptTask[] => {
      if (!item || typeof item !== 'object') return [];
      const task = item as Record<string, unknown>;
      if (typeof task.title !== 'string') return [];
      return [{
        subject: typeof task.subject === 'string' ? clip(task.subject, 40) : 'GENERAL',
        title: clip(task.title.trim(), 80),
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
        dueTime: typeof task.dueTime === 'string' ? clip(task.dueTime, 30) : '',
        status: task.status === 'Done' || task.status === 'In Progress' ? task.status : 'Todo',
        urgent: Boolean(task.urgent),
        timeEst: typeof task.timeEst === 'string' ? clip(task.timeEst, 20) : '',
      }];
    })
    .filter((task) => task.status !== 'Done')
    .sort((a, b) => `${a.dueDate ?? ''} ${a.dueTime}`.localeCompare(`${b.dueDate ?? ''} ${b.dueTime}`))
    .slice(0, MAX_TASKS);
}

function contents(history: HistoryMessage[], question: string): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  const push = (role: 'user' | 'model', text: string): void => {
    const previous = turns.at(-1);
    if (previous?.role === role) previous.parts[0].text += `\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  };
  for (const message of history) {
    if (!message.text || (!turns.length && message.role === 'ai')) continue;
    push(message.role === 'ai' ? 'model' : 'user', clip(message.text, 500));
  }
  push('user', clip(question, MAX_QUESTION_LENGTH));
  return turns;
}

async function callModel(
  model: string,
  apiKey: string,
  body: string,
  remainingMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remainingMs));
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return responseError('Method not allowed', 405);
  const authError = await requireAuthenticatedUser(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return responseError('Request body must be an object.', 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return responseError('Request body must be valid JSON.', 400);
  }

  if (typeof body.question !== 'string' || !body.question.trim()) {
    return responseError('A question is required.', 400);
  }
  if (body.question.length > MAX_QUESTION_LENGTH) {
    return responseError('Please keep your message under 2,000 characters.', 413);
  }
  const question = body.question.trim();
  const language = body.language === 'ru' ? 'Russian' : 'English';
  const userName = typeof body.userName === 'string' ? clip(body.userName.trim(), 80) : 'Student';
  const history = normalizeHistory(body.history);
  const tasks = normalizeTasks(body.tasks);
  const openTasks = tasks.map((task) =>
    `- [${task.subject}] ${task.title} | due ${task.dueDate ?? 'none'} ${task.dueTime}${task.urgent ? ' | URGENT' : ''} | ${task.status} | est ${task.timeEst}`
  );
  const today = new Date().toISOString().slice(0, 10);
  const prompt = [
    'You are Study AI, a concise study assistant inside a student planner app.',
    `Reply in ${language}.`,
    'Output plain text only, with no headings or tables. Keep the response practical and under about 150 words unless asked for more detail.',
    'Use the student tasks when relevant. Never invent tasks or deadlines.',
    `Today: ${today}. Student: ${userName}.`,
    openTasks.length ? `Open tasks:\n${openTasks.join('\n')}` : 'The student has no open tasks.',
  ].join('\n');
  const providerBody = JSON.stringify({
    system_instruction: { parts: [{ text: prompt }] },
    contents: contents(history, question),
    generationConfig: { maxOutputTokens: 1_024, temperature: 0.6 },
  });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('Study AI Edge Function is missing GEMINI_API_KEY.');
    return responseError('The AI assistant is not configured. Please contact the app administrator.', 503);
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastStatus = 0;
  for (const model of models()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 500) break;
      let response: Response;
      try {
        response = await callModel(model, apiKey, providerBody, remainingMs);
      } catch {
        console.warn(`Study AI provider request failed for model ${model}.`);
        lastStatus = 0;
        break;
      }

      if (response.ok) {
        try {
          const payload: unknown = await response.json();
          const candidate = payload && typeof payload === 'object'
            ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }).candidates?.[0]
            : undefined;
          const text = candidate?.content?.parts
            ?.filter((part) => !part.thought)
            .map((part) => part.text ?? '')
            .join('')
            .trim() ?? '';
          if (!text) throw new Error('Empty provider response.');
          return Response.json({ text, model }, { headers: corsHeaders });
        } catch (error) {
          console.error('Study AI provider returned an invalid response.', error);
          return responseError('The AI assistant returned an invalid response. Please try again.', 502);
        }
      }

      lastStatus = response.status;
      if (response.status === 404) break;
      if (response.status !== 429 && response.status < 500 && response.status !== 408) {
        console.error(`Study AI provider rejected the request (${response.status}).`);
        return responseError('The AI assistant could not process this request. Please try again.', 502);
      }
      if (attempt === 0 && Date.now() + 300 < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      break;
    }
  }

  console.error('Study AI provider exhausted its bounded retry budget.', lastStatus);
  return responseError('The AI assistant is busy right now. Please try again in a moment.', 503);
});
