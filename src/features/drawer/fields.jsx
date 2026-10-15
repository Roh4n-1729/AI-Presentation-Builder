import { cn } from '@/primitives/cn.js';

/** Grid cell input: commits on blur or Enter (one undo step per edited cell). */
export function CellInput({ value, onChange, onCommit, className, numeric, ...props }) {
  return (
    <input
      value={value}
      inputMode={numeric ? 'decimal' : undefined}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        e.stopPropagation(); // typing must not trigger canvas shortcuts
      }}
      className={cn(
        'h-8 w-full min-w-0 truncate rounded-sm border border-transparent bg-transparent px-1.5 text-ui outline-none hover:border-border focus:border-ring focus:bg-panel',
        numeric && 'text-right font-mono tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
