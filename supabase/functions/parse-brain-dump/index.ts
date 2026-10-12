import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, requireAuthenticatedUser } from '../_shared/auth.ts';

const MAX_INPUT_LENGTH = 6_000;
const MAX_TASKS = 30;
const TOTAL_BUDGET_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];

const taskSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    dueDate: { type: 'STRING', nullable: true },
    hasTime: { type: 'BOOLEAN' },
    category: { type: 'STRING', enum: ['study', 'personal', 'general'] },
  },
  required: ['title', 'dueDate', 'hasTime', 'category'],
};

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

function parseTasks(value: unknown, createdAt: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > MAX_TASKS) {
    throw new Error('The model returned an invalid task list.');
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim().slice(0, 300) : '';
    if (!title) return [];
    const dueDate = typeof candidate.dueDate === 'string' ? candidate.dueDate : null;
    if (dueDate) {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(dueDate);
      if (!dateMatch) throw new Error('The model returned an invalid due date.');
      const [, year, month, day] = dateMatch.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
        || (dueDate.includes('T') && Number.isNaN(new Date(dueDate).getTime()))
      ) {
        throw new Error('The model returned an invalid due date.');
      }
    }
    const category = candidate.category === 'study' || candidate.category === 'personal'
      ? candidate.category
      : 'general';
    return [{
      id: crypto.randomUUID(),
      title,
      dueDate,
      hasTime: Boolean(candidate.hasTime && dueDate?.includes('T')),
      category,
      isCompleted: false,
      createdAt,
    }];
  });
}

async function callModel(
  model: string,
  apiKey: string,
  baseline: string,
  userInput: string,
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
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: [
                'You are a specialized task extraction parser for a student planner.',
                `Current date and time: ${baseline}. Resolve relative dates from this baseline.`,
                'Extract discrete actionable tasks and ignore conversational filler.',
                'Write concise imperative titles in the same language as the input.',
                'Return dueDate as YYYY-MM-DD when only a date is known, ISO datetime and hasTime=true when a time is given, or null when no date is stated.',
                "Use category 'study', 'personal', or 'general'. Mark every task incomplete.",
                `Return at most ${MAX_TASKS} tasks. Return JSON only, matching the schema.`,
              ].join('\n'),
            }],
          },
          contents: [{ role: 'user', parts: [{ text: userInput }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3_072,
            responseMimeType: 'application/json',
            responseSchema: { type: 'ARRAY', items: taskSchema },
          },
        }),
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

  let userInput: unknown;
  try {
    const body: unknown = await request.json();
    userInput = body && typeof body === 'object' ? (body as Record<string, unknown>).userInput : undefined;
  } catch {
    return responseError('Request body must be valid JSON.', 400);
  }
  if (typeof userInput !== 'string' || !userInput.trim()) {
    return responseError('Add some text before analyzing your brain dump.', 400);
  }
  const input = userInput.trim();
  if (input.length > MAX_INPUT_LENGTH) {
    return responseError('Please keep your brain dump under 6,000 characters.', 413);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('Brain Dump Edge Function is missing GEMINI_API_KEY.');
    return responseError('Brain Dump is not configured. Please contact the app administrator.', 503);
  }

  const baseline = new Date().toISOString();
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastStatus: number | null = null;
  for (const model of models()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 500) break;

      let response: Response;
      try {
        response = await callModel(model, apiKey, baseline, input, remainingMs);
      } catch {
        console.warn(`Brain Dump provider request failed for model ${model}.`);
        lastStatus = 0;
        break;
      }

      if (response.ok) {
        try {
          const payload: unknown = await response.json();
          const candidate = payload && typeof payload === 'object'
            ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]
            : undefined;
          const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
          if (!text) throw new Error('Empty provider response.');
          const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(cleaned) as unknown;
          const tasks = parseTasks(parsed, baseline);
          return Response.json({ tasks }, { headers: corsHeaders });
        } catch (error) {
          console.error('Brain Dump provider returned an invalid response.', error);
          return responseError('The task parser returned an invalid response. Please try again.', 502);
        }
      }

      lastStatus = response.status;
      if (response.status === 404) break;
      if (response.status !== 429 && response.status < 500 && response.status !== 408) {
        console.error(`Brain Dump provider rejected the request (${response.status}).`);
        return responseError('The task parser could not process this request. Please try again.', 502);
      }
      if (attempt === 0 && Date.now() + 300 < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      break;
    }
  }

  console.error('Brain Dump provider exhausted its bounded retry budget.', lastStatus);
  return responseError('The task parser is busy right now. Please try again in a moment.', 503);
});
