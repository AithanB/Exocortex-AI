import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Register } from './screens/Register';
import { LanguageProvider, useLanguage } from './lib/language';
import { ThemeProvider } from './lib/theme';
import { Login } from './screens/Login';

import { AppShell } from './components/AppShell';
import { BottomNav } from './components/BottomNav';
import { formatClock } from './lib/calendar';
import { askGemini } from './lib/gemini';
import { localReply } from './lib/localReply';
import {
  DEFAULT_PREFS,
  deleteMessages,
  fetchMessages,
  fetchPrefs,
  fetchTasks,
  deleteTask as deleteTaskFromDb,
  insertMessage,
  insertTask,
  insertTasks,
  updateTask,
  updateTaskStatus,
  type UserPrefs,
} from './lib/db';
import { CalendarScreen } from './screens/CalendarScreen';
import { ChatScreen } from './screens/ChatScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import type { ChatMessage, NavTab, NewTaskInput, Task, TaskStatus } from './types';

interface PendingDelete {
  task: Task;
  index: number;
  userId: string;
  timer: number;
}

function welcomeMessage(name: string): ChatMessage {
  return {
    id: 0,
    role: 'ai',
    text: `Hello, ${name}. I'm your study assistant. Add your first task and I'll help you plan your week.`,
    time: formatClock(new Date()),
  };
}

function AppContent() {
  const { language, t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLogin, setShowLogin] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatCleared, setChatCleared] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [deleteToastId, setDeleteToastId] = useState<string | null>(null);
  const pendingDeletesRef = useRef(new Map<string, PendingDelete>());

  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const userId = session?.user?.id;
  const username: string = session?.user?.user_metadata?.username || 'Student';

  // Актуальные задачи для таймера ответа ИИ (чтобы не читать устаревшее замыкание).
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  // Текущий пользователь для отложенных колбэков (в замыкании userId может устареть).
  const userIdRef = useRef<string | undefined>(undefined);
  userIdRef.current = userId;
  // История для контекста ИИ и защита от параллельных запросов (двойной клик / быстрый Enter).
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const prefsRef = useRef<UserPrefs>(DEFAULT_PREFS);
  prefsRef.current = prefs;
  const chatBusyRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const messageWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  function latestPendingDeleteId(): string | null {
    const pending = Array.from(pendingDeletesRef.current.values());
    return pending[pending.length - 1]?.task.id ?? null;
  }

  function clearPendingDeletes(): void {
    pendingDeletesRef.current.forEach(({ timer }) => window.clearTimeout(timer));
    pendingDeletesRef.current.clear();
    setDeleteToastId(null);
  }

  useEffect(() => () => {
    pendingDeletesRef.current.forEach(({ timer }) => window.clearTimeout(timer));
    pendingDeletesRef.current.clear();
  }, []);

  // --- Сессия Supabase ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Данные ТЕКУЩЕГО пользователя. Перезагружаются при смене userId (вход/выход/смена аккаунта). ---
  useEffect(() => {
    // Любой выход или смена аккаунта: сразу чистим всё, чтобы не мелькали чужие данные.
    clearPendingDeletes();
    setTasks([]);
    setMessages([]);
    setChatCleared(false);
    setPrefs(DEFAULT_PREFS);
    chatAbortRef.current?.abort(); // отменяем незавершённый запрос ИИ предыдущего пользователя
    chatBusyRef.current = false;
    setChatLoading(false);
    setDataError(null);
    setActiveTab('home');

    if (!userId) {
      setDataLoading(false);
      return undefined;
    }

    let cancelled = false;
    setDataLoading(true);

    Promise.all([fetchTasks(), fetchMessages(), fetchPrefs()])
      .then(([loadedTasks, loadedMessages, loadedPrefs]) => {
        if (cancelled) return;
        setTasks(loadedTasks);
        setMessages(loadedMessages);
        setPrefs(loadedPrefs);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setDataError(error.message);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const reportError = useCallback((error: unknown) => {
    setDataError(error instanceof Error ? error.message : String(error));
  }, []);

  function enqueueMessageWrite(write: () => Promise<void>): void {
    messageWriteQueueRef.current = messageWriteQueueRef.current.then(write).catch(reportError);
  }

  function handleClearChat(): void {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    chatBusyRef.current = false;
    setChatLoading(false);
    setMessages([]);
    setChatCleared(true);
    enqueueMessageWrite(deleteMessages);
  }

  async function handleAddTask(input: NewTaskInput): Promise<void> {
    try {
      const created = await insertTask(input);
      setTasks((prev) => [created, ...prev]);
    } catch (error) {
      reportError(error);
    }
  }

  async function handleUpdateTask(id: string, input: NewTaskInput): Promise<void> {
    const previous = tasksRef.current.find((task) => task.id === id);
    if (!previous) return;
    const updated: Task = {
      ...previous,
      subject: input.subject,
      title: input.title,
      due: input.due,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      status: input.status,
      urgent: input.urgent,
      timeEst: input.timeEst,
      category: input.category ?? previous.category,
      hasTime: input.hasTime ?? Boolean(input.dueTime),
      isCompleted: input.isCompleted ?? input.status === 'Done',
      createdAt: input.createdAt ?? previous.createdAt,
    };
    setTasks((current) => current.map((task) => task.id === id ? updated : task));
    try {
      await updateTask(id, input);
    } catch (error) {
      setTasks((current) => current.map((task) => task.id === id ? previous : task));
      reportError(error);
    }
  }

  function handleDeleteTask(task: Task): void {
    if (!userId || pendingDeletesRef.current.has(task.id)) return;
    const index = tasksRef.current.findIndex((item) => item.id === task.id);
    if (index < 0) return;

    const pending: PendingDelete = {
      task,
      index,
      userId,
      timer: 0,
    };
    pending.timer = window.setTimeout(() => {
      if (pendingDeletesRef.current.get(task.id) !== pending) return;
      pendingDeletesRef.current.delete(task.id);
      setDeleteToastId((current) => current === task.id ? latestPendingDeleteId() : current);
      deleteTaskFromDb(task.id).catch((error) => {
        if (userIdRef.current === pending.userId) {
          setTasks((current) => {
            if (current.some((item) => item.id === task.id)) return current;
            const restored = [...current];
            restored.splice(Math.min(pending.index, restored.length), 0, pending.task);
            return restored;
          });
        }
        reportError(error);
      });
    }, 5000);
    pendingDeletesRef.current.set(task.id, pending);
    setDeleteToastId(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
  }

  function handleUndoDelete(): void {
    if (!deleteToastId) return;
    const pending = pendingDeletesRef.current.get(deleteToastId);
    if (!pending) {
      setDeleteToastId(latestPendingDeleteId());
      return;
    }
    window.clearTimeout(pending.timer);
    pendingDeletesRef.current.delete(deleteToastId);
    setTasks((current) => {
      if (current.some((item) => item.id === pending.task.id)) return current;
      const restored = [...current];
      restored.splice(Math.min(pending.index, restored.length), 0, pending.task);
      return restored;
    });
    setDeleteToastId(latestPendingDeleteId());
  }

  async function handleBrainDump(parsedTasks: Task[]): Promise<void> {
    try {
      const created = await insertTasks(parsedTasks.map((task) => ({
        subject: task.subject,
        title: task.title,
        due: task.due,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        status: task.status,
        urgent: task.urgent,
        timeEst: task.timeEst,
        category: task.category,
        hasTime: task.hasTime,
        isCompleted: task.isCompleted,
        createdAt: task.createdAt,
      })));
      setTasks((previous) => [...created, ...previous]);
    } catch (error) {
      reportError(error);
      throw error;
    }
  }

  async function handleStatusChange(id: string, next: TaskStatus): Promise<void> {
    const previous = tasksRef.current.find((task) => task.id === id)?.status;
    // Оптимистично обновляем UI, при ошибке откатываем.
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: next, isCompleted: next === 'Done' } : task)));
    try {
      await updateTaskStatus(id, next);
    } catch (error) {
      if (previous) {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: previous, isCompleted: previous === 'Done' } : task)));
      }
      reportError(error);
    }
  }

  async function handleSendMessage(text: string): Promise<void> {
    // Пока ждём ответ — новые запросы не отправляем (ни одного лишнего обращения к API).
    if (chatBusyRef.current) return;
    chatBusyRef.current = true;

    const history = messagesRef.current; // сообщения ДО текущего вопроса
    const sendingUserId = userId;
    setChatCleared(false);
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      text,
      time: formatClock(new Date()),
    };
    setMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);
    enqueueMessageWrite(() => insertMessage('user', text));

    const controller = new AbortController();
    chatAbortRef.current = controller;
    const params = {
      question: text,
      history,
      tasks: tasksRef.current,
      userName: username,
      language,
    };

    let replyText: string;
    try {
      if (prefsRef.current.aiMode) {
        // askGemini сам переключает модели, ограничивает повторы и при любом сбое отдаёт локальный ответ.
        replyText = (await askGemini({ ...params, signal: controller.signal })).text;
      } else {
        // «AI Study Mode» выключен — к Gemini не обращаемся вообще.
        replyText = localReply(text, params.tasks, language, username);
      }
    } catch (error) {
      if (controller.signal.aborted) return; // пользователь вышел/сменился — ответ не нужен
      // Страховка: что бы ни случилось, пользователь получает ответ.
      replyText = localReply(text, params.tasks, language, username);
      console.warn('AI request failed, local reply used:', error);
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      if (!controller.signal.aborted) {
        chatBusyRef.current = false;
        setChatLoading(false);
      }
    }

    // Если за это время пользователь вышел/сменился — ответ не показываем и не сохраняем.
    if (sendingUserId !== userIdRef.current) return;
    const aiMessage: ChatMessage = {
      id: Date.now() + 1,
      role: 'ai',
      text: replyText,
      time: formatClock(new Date()),
    };
    setMessages((prev) => [...prev, aiMessage]);
    enqueueMessageWrite(() => insertMessage('ai', replyText));
  }

  // --- Экран загрузки сессии ---
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#121212', color: '#fff' }}>
        <h3>Синхронизация профиля...</h3>
      </div>
    );
  }

  // --- Нет сессии: только вход/регистрация ---
  if (!session) {
    return (
      <AppShell>
        <main className="app-content min-h-0 overflow-y-auto bg-page">
          <div className="accent-bar" />
          <div className="mx-auto flex min-h-full w-full max-w-device flex-col px-6 py-7 sm:px-8 sm:py-9">
            <header className="flex shrink-0 items-center gap-3 border-b border-ui pb-5">
              <span className="h-2.5 w-2.5 bg-accent-red" aria-hidden="true" />
              <div>
                <p className="font-display text-[10px] font-bold tracking-[0.16em] text-charcoal">EXOCORTEX AI</p>
                <p className="mt-0.5 font-body text-[10px] text-muted-2">AI STUDY PLANNER</p>
              </div>
            </header>
            <div className="flex flex-1 items-center justify-center py-7">
              {showLogin ? <Login /> : <Register />}
            </div>
            <footer className="shrink-0 border-t border-ui pt-5 text-center">
              <p className="font-body text-[12px] text-slate">
                {showLogin ? 'New to Exocortex AI?' : 'Already have an account?'}
              </p>
              <button type="button" onClick={() => setShowLogin(!showLogin)}
                className="mt-2 bg-transparent font-display text-[10px] font-bold tracking-widest text-charcoal underline decoration-accent-red decoration-2 underline-offset-4 hover:text-accent-red">
                {showLogin ? 'CREATE AN ACCOUNT' : 'SIGN IN'}
              </button>
            </footer>
          </div>
        </main>
      </AppShell>
    );
  }

  // --- Загрузка данных пользователя ---
  if (dataLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#121212', color: '#fff' }}>
        <h3>Loading your data...</h3>
      </div>
    );
  }

  const chatMessages = messages.length === 0 && !chatCleared ? [welcomeMessage(username)] : messages;

  return (
    <AppShell>
      {dataError ? (
        <div
          role="alert"
          onClick={() => setDataError(null)}
          style={{ background: '#b00020', color: '#fff', padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}
        >
          Ошибка данных: {dataError} (нажми, чтобы скрыть)
        </div>
      ) : null}
      <div className="app-content">
        {activeTab === 'home' ? (
          <HomeScreen
            tasks={tasks}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onBrainDump={handleBrainDump}
            onStatusChange={handleStatusChange}
          />
        ) : null}
        {activeTab === 'calendar' ? <CalendarScreen tasks={tasks} /> : null}
        {activeTab === 'chat' ? (
          <ChatScreen messages={chatMessages} loading={chatLoading} onSend={handleSendMessage} onClear={handleClearChat} />
        ) : null}
        {activeTab === 'profile' ? (
          <ProfileScreen
            tasks={tasks}
            session={session}
          />
        ) : null}
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      {deleteToastId ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-[68px] left-4 right-4 z-[80] flex items-center justify-between border border-primary bg-primary px-4 py-3 text-primary-contrast shadow-overlay"
        >
          <span className="font-body text-[12px]">{t('Task deleted')}</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="font-display text-[10px] font-bold tracking-wider text-primary-contrast underline decoration-accent-red decoration-2 underline-offset-4"
          >
            {t('Undo')}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LanguageProvider>
  );
}
