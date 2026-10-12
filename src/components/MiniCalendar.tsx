import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, formatMonthName, formatWeekdays } from '../lib/calendar';
import { useLanguage } from '../lib/language';

interface MiniCalendarProps {
  year: number;
  month: number;
  selectedDay: number | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number) => void;
}

export function MiniCalendar({
  year,
  month,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: MiniCalendarProps) {
  const { language, t } = useLanguage();
  const grid = buildMonthGrid(year, month);
  const weekdays = formatWeekdays(language);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={t('Previous month')}
          onClick={onPrevMonth}
          className="flex h-6 w-6 items-center justify-center rounded-sm border-hairline border-muted-4"
        >
          <ChevronLeft size={12} className="text-slate" />
        </button>
        <p className="font-display text-[11px] font-bold tracking-label text-charcoal">
          {formatMonthName(year, month, language, 'short')}
        </p>
        <button
          type="button"
          aria-label={t('Next month')}
          onClick={onNextMonth}
          className="flex h-6 w-6 items-center justify-center rounded-sm border-hairline border-muted-4"
        >
          <ChevronRight size={12} className="text-slate" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {weekdays.map((day, index) => (
          <span
            key={`${day}-${index}`}
            className={`pb-[3px] text-center font-display text-[9px] font-semibold tracking-wide ${
              index >= 5 ? 'text-[#dddddd]' : 'text-muted-2'
            }`}
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((day, index) => {
          const selected = day === selectedDay;
          const weekend = index % 7 >= 5;

          return (
            <div key={index} className="flex h-7 items-center justify-center">
              {day ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={`flex h-6 w-6 items-center justify-center rounded-sm font-display text-[11px] ${
                    selected
                      ? 'bg-primary font-bold text-primary-contrast'
                      : weekend
                        ? 'font-normal text-muted-4'
                        : 'font-normal text-ink'
                  }`}
                >
                  {day}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
