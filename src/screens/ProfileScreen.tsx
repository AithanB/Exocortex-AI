import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase'; // Импортируем клиент Supabase для выхода
import { Header } from '../components/Header';
import { KpiCard } from '../components/KpiCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { toIsoDate } from '../lib/calendar';
import { useLanguage } from '../lib/language';
import { useTheme } from '../lib/theme';
import type { Course, Kpi, ProfileSection, Task } from '../types';

// Статистика считается из задач ТЕКУЩЕГО пользователя, а не из демо-данных.
function buildKpis(tasks: Task[], t: (value: string) => string): Kpi[] {
    const done = tasks.filter((task) => task.status === 'Done').length;
    const open = tasks.length - done;
    const urgentOpen = tasks.filter((task) => task.urgent && task.status !== 'Done').length;
    const rate = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

    const now = new Date();
    const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const from = toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
    const to = toIsoDate(weekAhead.getFullYear(), weekAhead.getMonth(), weekAhead.getDate());
    const dueSoon = tasks.filter(
        (task) => task.status !== 'Done' && task.dueDate !== null && task.dueDate >= from && task.dueDate <= to,
    ).length;

    return [
        { label: t('Tasks Completed'), value: String(done), sub: `${t('Of')} ${tasks.length} ${t('total')}` },
        { label: t('Open Tasks'), value: String(open), sub: `${urgentOpen} ${t('urgent')}`, accent: true },
        { label: t('Completion Rate'), value: `${rate}%`, sub: t('All time') },
        { label: t('Due in 7 Days'), value: String(dueSoon), sub: t('Not completed yet') },
    ];
}

function buildCourses(tasks: Task[]): Course[] {
    const map = new Map<string, Course>();
    tasks.forEach((task) => {
        const course = map.get(task.subject) ?? { subject: task.subject, open: 0, total: 0 };
        course.total += 1;
        if (task.status !== 'Done') course.open += 1;
        map.set(task.subject, course);
    });
    return Array.from(map.values()).sort((a, b) => b.open - a.open || a.subject.localeCompare(b.subject));
}

interface ProfileScreenProps {
    tasks: Task[];
    session: any; // <-- Принимаем сессию от Supabase
}

export function ProfileScreen({ tasks, session }: ProfileScreenProps) {
    const [section, setSection] = useState<ProfileSection>('kpis');
    const { language, setLanguage, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const kpis = useMemo(() => buildKpis(tasks, t), [tasks, t]);
    const courses = useMemo(() => buildCourses(tasks), [tasks]);

    // Достаем реальные данные из сессии Supabase
    const email = session?.user?.email || t('No email');
    // Юзернейм берем из метаданных (тот, что вводили при регистрации)
    const username = session?.user?.user_metadata?.username || t('Student');

    // Генерируем инициалы из первых двух букв юзернейма (или одну, если он короткий)
    const initials = username.substring(0, 2).toUpperCase();

    // Функция для выхода из аккаунта
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert(`${t('Sign out failed')}: ${error.message}`);
        }
    };

    return (
        <main className="flex h-full flex-col overflow-y-auto bg-page">
            <Header
                overline={t('STUDENT PROFILE')}
                title={username} // <-- Реальный юзернейм вместо фейкового имени
                subtitle={email}    // <-- Реальный email вместо фейкового вуза
                trailing={
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-sm border border-primary bg-primary">
                        <span className="font-display text-lg font-extrabold text-primary-contrast">{initials}</span>
                    </div>
                }
            />

            <div className="grid shrink-0 grid-cols-2 border-b border-ui" role="tablist" aria-label={t('STUDENT PROFILE')}>
                {([
                    { id: 'kpis', label: 'PERFORMANCE' },
                    { id: 'courses', label: 'COURSES' },
                ] as const).map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={section === item.id}
                        onClick={() => setSection(item.id)}
                        className={`bg-transparent py-3.5 font-display text-[10px] font-semibold tracking-wider ${
                            section === item.id
                                ? 'border-b-2 border-charcoal text-charcoal'
                                : 'border-b-2 border-transparent text-muted-2'
                        }`}
                    >
                        {t(item.label)}
                    </button>
                ))}
            </div>

            {section === 'kpis' ? (
                <section className="grid shrink-0 grid-cols-2 gap-3 px-6 py-5" aria-label={t('PERFORMANCE')}>
                    {kpis.map((kpi) => (
                        <KpiCard key={kpi.label} kpi={kpi} />
                    ))}
                </section>
            ) : (
                <section className="shrink-0 px-6" aria-label={t('COURSES')}>
                    {courses.length === 0 ? (
                        <p className="py-10 text-center font-display text-[13px] text-muted-4">
                            {t('No courses yet — add a task to see it here')}
                        </p>
                    ) : (
                        courses.map((course, index) => (
                            <article
                                key={course.subject}
                                className={`flex items-center justify-between py-4 ${
                                    index < courses.length - 1 ? 'border-b border-row' : ''
                                }`}
                            >
                                <div>
                                    <p className="font-display text-sm font-semibold text-charcoal">{t(course.subject)}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-2">
                                        {course.open} {t(course.open === 1 ? 'task open' : 'tasks open')}
                                    </p>
                                </div>
                                <div className="rounded-sm border border-charcoal px-3 py-[5px]">
                                    <span className="font-display text-sm font-bold text-charcoal">
                                        {course.total - course.open}/{course.total}
                                    </span>
                                </div>
                            </article>
                        ))
                    )}
                </section>
            )}

            <div className="h-2 shrink-0 border-y border-row bg-surface-2" />

            <section className="shrink-0 px-6" aria-label={t('SETTINGS')}>
                <p className="type-label pb-2 pt-4">{t('SETTINGS')}</p>
                <div className="flex items-center justify-between border-b border-surface-3 py-3.5">
                    <span className="font-body text-[13px] text-ink">{t('Dark theme')}</span>
                    <ToggleSwitch
                        checked={theme === 'dark'}
                        onChange={toggleTheme}
                        label={t('Dark theme')}
                    />
                </div>
                {/* КНОПКА ВЫХОДА: стилизована под твою опасную (danger) кнопку в списке настроек */}
                <div className="flex items-center justify-between border-b border-surface-3 py-3.5"><span className="font-body text-[13px] text-ink">{t('Language')}</span><select value={language} onChange={e=>setLanguage(e.target.value as 'en'|'ru')} aria-label={t('Language')} className="rounded-sm border border-ui bg-page px-2.5 py-2 font-body text-xs text-charcoal outline-none focus:border-charcoal"><option value="en">{t('English')}</option><option value="ru">{t('Russian')}</option></select></div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-between py-3.5 text-left border-transparent transition-colors hover:opacity-80"
                >
          <span className="font-body text-[13px] font-medium text-accent-red">{t('Sign out')}</span>
                    <span className="font-body text-xs text-accent-red">→</span>
                </button>
            </section>
            <div className="h-6" />
        </main>
    );
}
