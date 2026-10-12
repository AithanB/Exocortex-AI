import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Language = 'en' | 'ru';

const ru: Record<string, string> = {
  Today: 'Сегодня', PENDING: 'ОЖИДАЮТ', All: 'Все', Todo: 'К выполнению', 'In Progress': 'В процессе', Done: 'Готово',
  'No tasks': 'Нет задач', 'ADD NEW TASK': 'ДОБАВИТЬ ЗАДАЧУ', TASKS: 'ЗАДАЧИ', CALENDAR: 'КАЛЕНДАРЬ', AI: 'ИИ', PROFILE: 'ПРОФИЛЬ',
  'STUDENT PROFILE': 'ПРОФИЛЬ СТУДЕНТА', PERFORMANCE: 'РЕЗУЛЬТАТЫ', COURSES: 'ПРЕДМЕТЫ', SETTINGS: 'НАСТРОЙКИ',
  Notifications: 'Уведомления', 'AI Study Mode': 'Режим учебного ИИ', Language: 'Язык', English: 'Английский', Russian: 'Русский',
  'NEW TASK': 'НОВАЯ ЗАДАЧА', 'Add Task': 'Добавить задачу', Close: 'Закрыть', CATEGORY: 'КАТЕГОРИИ',
  'EDIT TASK': 'ИЗМЕНИТЬ ЗАДАЧУ', 'Edit Task': 'Изменить задачу', 'SAVE CHANGES': 'СОХРАНИТЬ ИЗМЕНЕНИЯ',
  Edit: 'Изменить', Delete: 'Удалить', 'Task options': 'Параметры задачи',
  'Task deleted': 'Задача удалена', Undo: 'Отменить', 'No due date': 'Без срока',
  Theme: 'Тема', 'Dark theme': 'Тёмная тема',
  'Type a category and press Enter': 'Введите категорию и нажмите Enter', 'Remove category': 'Удалить категорию',
  'TASK TITLE': 'НАЗВАНИЕ ЗАДАЧИ', 'e.g. Problem Set 5': 'Например, задачи № 5', 'DUE DATE': 'СРОК',
  'Select a date below': 'Выберите дату ниже', TIME: 'ВРЕМЯ', STATUS: 'СТАТУС', 'TIME ESTIMATE': 'ОЦЕНКА ВРЕМЕНИ',
  URGENT: 'СРОЧНО', 'Mark with red priority dot': 'Отметить красным индикатором приоритета', 'ADD TASK': 'ДОБАВИТЬ ЗАДАЧУ',
  'Task title is required.': 'Введите название задачи.', 'Due date is required.': 'Укажите срок выполнения.',
  'Scroll to select time': 'Прокрутите, чтобы выбрать время', 'Scroll to select an estimate': 'Прокрутите, чтобы выбрать длительность',
  'ACADEMIC CALENDAR': 'УЧЕБНЫЙ КАЛЕНДАРЬ', 'TOTAL TASKS': 'ВСЕГО ЗАДАЧ', 'DUE THIS WEEK': 'НА ЭТОЙ НЕДЕЛЕ',
  COMPLETED: 'ВЫПОЛНЕНО', 'Select a day to view tasks': 'Выберите день, чтобы увидеть задачи', 'No tasks on': 'Нет задач на',
  'AI ASSISTANT': 'ИИ-АССИСТЕНТ', 'Study AI': 'Учебный ИИ', ONLINE: 'В СЕТИ', 'Assistant is typing': 'Ассистент печатает',
  'Clear chat': 'Очистить чат',
  'Ask anything about your studies...': 'Спросите о своей учёбе...', Message: 'Сообщение', SEND: 'ОТПРАВИТЬ',
  'Summarize my week': 'Подведи итоги недели', "Explain Gauss's Law": 'Объясни закон Гаусса',
  'Quiz me on Chapter 5': 'Проверь меня по главе 5', 'Prioritize my tasks': 'Расставь приоритеты задач',
  'Previous month': 'Предыдущий месяц', 'Next month': 'Следующий месяц', 'Month grid': 'Календарная сетка',
  'Month summary': 'Итоги месяца', Tasks: 'Задачи', TASK: 'ЗАДАЧА', 'Task filters': 'Фильтры задач', Primary: 'Основная навигация',
  'SMART BRAIN DUMP': 'УМНАЯ ВЫГРУЗКА МЫСЛЕЙ', 'Dump your thoughts (e.g., ‘Do physics lab by Friday, go to gym tomorrow at 6 PM’)…': 'Запишите мысли, например: «Сдать лабораторную по физике к пятнице, пойти в зал завтра в 18:00»…',
  'No actionable tasks found. Try adding a little more detail.': 'Задачи не найдены. Добавьте немного деталей.',
  'task added successfully!': 'задача успешно добавлена!', 'tasks added successfully!': 'задач успешно добавлено!',
  'Something went wrong. Please try again.': 'Что-то пошло не так. Попробуйте ещё раз.', PARSING: 'ОБРАБОТКА…', 'ADD TASKS': 'ДОБАВИТЬ ЗАДАЧИ',
  STUDY: 'УЧЁБА', PERSONAL: 'ЛИЧНОЕ', GENERAL: 'ОБЩЕЕ', EST: 'ОЦЕНКА', 'All day': 'Весь день', Urgent: 'Срочно',
  'Mark task as done': 'Отметить задачу выполненной', 'Mark task as not done': 'Отметить задачу невыполненной',
  'Tap to advance status': 'Нажмите, чтобы сменить статус', 'Tasks Completed': 'Выполнено задач', 'Open Tasks': 'Открытые задачи',
  'Completion Rate': 'Процент выполнения', 'Due in 7 Days': 'Срок в ближайшие 7 дней', 'Of': 'Из', total: 'всего', urgent: 'срочных',
  'All time': 'За всё время', 'Not completed yet': 'Ещё не выполнено', 'No courses yet — add a task to see it here': 'Пока нет предметов — добавьте задачу, чтобы увидеть их здесь',
  'task open': 'открытая задача', 'tasks open': 'открытых задач',
  'No email': 'Нет email', Student: 'Студент', 'Sign out': 'Выйти', 'Sign out failed': 'Не удалось выйти',
  'Welcome back': 'С возвращением', 'Sign in': 'Войти', 'Pick up where you left off and keep your study plan moving.': 'Продолжите с того места, где остановились, и двигайтесь по учебному плану.',
  'Email address': 'Адрес электронной почты', Password: 'Пароль', 'Enter your password': 'Введите пароль', 'SIGNING IN…': 'ВХОД…', 'SIGN IN': 'ВОЙТИ',
  'Sign-in failed': 'Не удалось войти', 'Start planning': 'НАЧНИТЕ ПЛАНИРОВАТЬ', 'Create your account': 'Создайте аккаунт',
  'Set up your study space and bring your week into focus.': 'Настройте учебное пространство и спланируйте неделю.', Username: 'Имя пользователя',
  'Choose a username': 'Выберите имя пользователя', 'Create a password': 'Создайте пароль', 'CREATING ACCOUNT…': 'СОЗДАНИЕ АККАУНТА…',
  'CREATE ACCOUNT': 'СОЗДАТЬ АККАУНТ', 'Registration failed': 'Не удалось зарегистрироваться',
  'Account created. Check your email if confirmation is enabled.': 'Аккаунт создан. Проверьте почту, если включено подтверждение.',
};

const Context = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (value: string) => string } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState<Language>(() => window.localStorage.getItem('skillset-language') === 'ru' ? 'ru' : 'en');
  function setLanguage(value: Language): void { window.localStorage.setItem('skillset-language', value); setValue(value); }
  const t = useCallback((value: string): string => language === 'ru' ? (ru[value] ?? value) : value, [language]);
  return <Context.Provider value={{ language, setLanguage, t }}>{children}</Context.Provider>;
}

export function useLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing LanguageProvider');
  return value;
}
