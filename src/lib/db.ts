import { formatClock } from './calendar';
import { supabase } from './supabase';
import type { ChatMessage, ChatRole, NewTaskInput, Task, TaskCategory, TaskStatus } from '../types';

// ---------- Задачи ----------

interface TaskRow {
  id: number | string;
  subject: string;
  title: string;
  due: string;
  due_date: string | null;
  due_time: string;
  status: TaskStatus;
  urgent: boolean;
  time_est: string;
  category?: TaskCategory;
  has_time?: boolean;
  is_completed?: boolean;
  created_at?: string;
}

function categoryFor(row: TaskRow): TaskCategory {
  if (row.category === 'study' || row.category === 'personal' || row.category === 'general') return row.category;
  return row.subject === 'STUDY' ? 'study' : row.subject === 'PERSONAL' ? 'personal' : 'general';
}

function rowToTask(row: TaskRow): Task {
  return {
    id: String(row.id),
    subject: row.subject,
    title: row.title,
    due: row.due,
    dueDate: row.due_date,
    dueTime: row.due_time,
    status: row.status,
    urgent: row.urgent,
    timeEst: row.time_est,
    category: categoryFor(row),
    hasTime: row.has_time ?? Boolean(row.due_time),
    isCompleted: row.is_completed ?? row.status === 'Done',
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

// RLS на сервере сам вернёт только задачи текущего пользователя.
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    // Keep this query compatible with the currently deployed table. The enriched
    // Task fields are derived from the legacy columns until the migration is run.
    .select('id, subject, title, due, due_date, due_time, status, urgent, time_est')
    .order('due_date', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

// user_id подставляется на сервере (default auth.uid()), с клиента его не шлём.
export async function insertTask(input: NewTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      subject: input.subject,
      title: input.title,
      due: input.due,
      due_date: input.dueDate,
      due_time: input.dueTime,
      status: input.status,
      urgent: input.urgent,
      time_est: input.timeEst,
    })
    .select('id, subject, title, due, due_date, due_time, status, urgent, time_est')
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function insertTasks(inputs: NewTaskInput[]): Promise<Task[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await supabase
    .from('tasks')
    .insert(inputs.map((input) => ({
      subject: input.subject,
      title: input.title,
      due: input.due,
      due_date: input.dueDate,
      due_time: input.dueTime,
      status: input.status,
      urgent: input.urgent,
      time_est: input.timeEst,
    })))
    .select('id, subject, title, due, due_date, due_time, status, urgent, time_est');
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

export async function updateTask(id: string, input: NewTaskInput): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      subject: input.subject,
      title: input.title,
      due: input.due,
      due_date: input.dueDate,
      due_time: input.dueTime,
      status: input.status,
      urgent: input.urgent,
      time_est: input.timeEst,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Чат ----------

interface MessageRow {
  id: number;
  role: ChatRole;
  text: string;
  created_at: string;
}

export async function fetchMessages(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, text, created_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data as MessageRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    text: row.text,
    time: formatClock(new Date(row.created_at)),
  }));
}

export async function insertMessage(role: ChatRole, text: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({ role, text });
  if (error) throw error;
}

export async function deleteMessages(): Promise<void> {
  const { error } = await supabase.from('chat_messages').delete().not('id', 'is', null);
  if (error) throw error;
}

// ---------- Настройки ----------

export interface UserPrefs {
  notifications: boolean;
  aiMode: boolean;
}

export const DEFAULT_PREFS: UserPrefs = { notifications: true, aiMode: true };

export async function fetchPrefs(): Promise<UserPrefs> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('notifications, ai_mode')
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return { notifications: data.notifications, aiMode: data.ai_mode };
}

export async function savePrefs(userId: string, prefs: UserPrefs): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    notifications: prefs.notifications,
    ai_mode: prefs.aiMode,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
