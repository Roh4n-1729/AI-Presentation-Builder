import { Button } from '@/primitives/ui/button.jsx';
import { Kbd } from '@/primitives/ui/kbd.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/primitives/ui/tooltip.jsx';
import { cn } from '@/primitives/cn.js';

/**
 * Icon-only toolbar button with a tooltip (label + optional shortcut). The label doubles as the
 * accessible name. `active` = a toggled tool: tinted indigo (the user's color).
 *
 * @param {{ icon: import('react').ComponentType<any>, label: string, shortcut?: string,
 *           active?: boolean, className?: string } & import('react').ComponentProps<'button'>} props
 */
export function IconButtonTip({
  icon: Icon,
  label,
  shortcut,
  active = false,
  className,
  ...props
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active || undefined}
          className={cn(active && 'bg-user-soft text-user hover:bg-user-soft', className)}
          {...props}
        >
          <Icon strokeWidth={1.5} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="flex items-center gap-2">
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
