import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { useLanguage } from '../lib/language';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (id: string, next: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddClick: () => void;
  topContent?: ReactNode;
}

interface ExitingTask {
  task: Task;
  index: number;
}

export function TaskList({ tasks, onStatusChange, onEdit, onDelete, onAddClick, topContent }: TaskListProps) {
  const { t } = useLanguage();
  const [exitingTasks, setExitingTasks] = useState<ExitingTask[]>([]);
  useEffect(() => {
    setExitingTasks((current) => current.filter(({ task }) => !tasks.some((item) => item.id === task.id)));
  }, [tasks]);

  const visibleTasks = [...tasks];
  exitingTasks
    .filter(({ task }) => !tasks.some((item) => item.id === task.id))
    .sort((a, b) => a.index - b.index)
    .forEach(({ task, index }) => visibleTasks.splice(Math.min(index, visibleTasks.length), 0, task));

  function beginDelete(task: Task): void {
    setExitingTasks((current) => [
      ...current.filter((item) => item.task.id !== task.id),
      { task, index: tasks.findIndex((item) => item.id === task.id) },
    ]);
    onDelete(task);
  }

  function finishExit(id: string): void {
    setExitingTasks((current) => current.filter((item) => item.task.id !== id));
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" aria-label={t('Tasks')}>
      {topContent}
      {visibleTasks.length === 0 ? (
        <p className="py-10 text-center font-display text-[13px] text-muted-4">{t('No tasks')}</p>
      ) : (
        visibleTasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            last={index === visibleTasks.length - 1}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={beginDelete}
            deleting={exitingTasks.some((item) => item.task.id === task.id)}
            onExited={() => finishExit(task.id)}
          />
        ))
      )}

      <button
        type="button"
        onClick={onAddClick}
        className="mt-2 flex w-full items-center justify-center gap-2 bg-primary py-[13px] text-primary-contrast transition-colors hover:opacity-90"
      >
        <Plus size={11} strokeWidth={2.5} aria-hidden />
        <span className="font-display text-[10px] font-bold tracking-wider">{t('ADD NEW TASK')}</span>
      </button>
    </section>
  );
}
