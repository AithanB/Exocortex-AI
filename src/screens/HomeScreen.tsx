import { useMemo, useState } from 'react';
import { AddTaskSheet } from '../components/AddTaskSheet';
import { BrainDumpInput } from '../components/BrainDumpInput';
import { Header } from '../components/Header';
import { TaskList } from '../components/TaskList';
import { formatHeaderDate } from '../lib/calendar';
import { TASK_FILTERS } from '../mockData';
import { useLanguage } from '../lib/language';
import type { NewTaskInput, Task, TaskFilter, TaskStatus } from '../types';

interface HomeScreenProps {
  tasks: Task[];
  onAddTask: (task: NewTaskInput) => void;
  onUpdateTask: (id: string, task: NewTaskInput) => void;
  onDeleteTask: (task: Task) => void;
  onBrainDump: (tasks: Task[]) => Promise<void>;
  onStatusChange: (id: string, next: TaskStatus) => void;
}

export function HomeScreen({ tasks, onAddTask, onUpdateTask, onDeleteTask, onBrainDump, onStatusChange }: HomeScreenProps) {
  const { language, t } = useLanguage();
  const [filter, setFilter] = useState<TaskFilter>('All');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const pendingCount = tasks.filter((task) => task.status !== 'Done').length;
  const filtered = useMemo(
    () => (filter === 'All' ? tasks : tasks.filter((task) => task.status === filter)),
    [filter, tasks],
  );

  return (
    <main className="relative flex min-h-0 flex-1 flex-col bg-page">
      <Header
        overline={formatHeaderDate(new Date(), language)}
        title={t('Today')}
        trailing={
          <div className="text-right">
            <p className="font-display text-[9px] font-semibold tracking-wide text-muted-2">{t('PENDING')}</p>
            <p className="font-display text-[22px] font-bold leading-none text-charcoal">{pendingCount}</p>
          </div>
        }
      />

      <div className="flex gap-[18px] overflow-x-auto px-6 pt-3.5" role="tablist" aria-label={t('Task filters')}>
        {TASK_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={`whitespace-nowrap bg-transparent pb-2.5 font-display text-[10px] font-semibold tracking-[0.07em] ${
              filter === item
                ? 'border-b-2 border-charcoal text-charcoal'
                : 'border-b-2 border-transparent text-muted-3'
            }`}
          >
            {t(item).toUpperCase()}
          </button>
        ))}
      </div>

      <TaskList
        tasks={filtered}
        onStatusChange={onStatusChange}
        onEdit={(task) => {
          setEditingTask(task);
          setShowModal(true);
        }}
        onDelete={onDeleteTask}
        onAddClick={() => setShowModal(true)}
        topContent={<BrainDumpInput onTasksParsed={async (parsedTasks) => {
          await onBrainDump(parsedTasks);
          setFilter('All');
        }} />}
      />

      <AddTaskSheet
        open={showModal}
        initialTask={editingTask}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        onSubmit={(task) => {
          if (editingTask) onUpdateTask(editingTask.id, task);
          else onAddTask(task);
          setFilter('All');
          setShowModal(false);
          setEditingTask(null);
        }}
      />
    </main>
  );
}
