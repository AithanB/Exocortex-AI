interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant?: 'neutral' | 'accent' | 'ink';
}

export function Chip({ label, selected, onClick, variant = 'neutral' }: ChipProps) {
  const selectedClass =
    variant === 'ink'
      ? 'border-primary bg-primary text-primary-contrast'
      : 'border-primary bg-primary text-primary-contrast';

  const idleClass =
    variant === 'accent'
      ? 'border-hairline border-accent-red bg-page text-accent-red'
      : 'border-hairline border-muted-4 bg-page text-slate';

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-sm px-2.5 py-[5px] font-display text-[9px] font-semibold tracking-wide ${
        selected ? selectedClass : idleClass
      }`}
    >
      {label}
    </button>
  );
}
