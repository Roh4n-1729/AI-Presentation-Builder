import { Kbd } from '@/primitives/ui/kbd.jsx';
import { DropdownMenuItem } from '@/primitives/ui/dropdown-menu.jsx';

/**
 * The one menu row used across the app: icon, one-line label, optional shortcut as a `Kbd` chip
 * (the same chip the toolbar tooltips use). Longer explanations go in `title`, not a second line.
 * @param {{ icon: import('react').ComponentType<any>, label: string, shortcut?: string,
 *   onSelect?: (e: Event) => void, title?: string, disabled?: boolean }} props
 */
export function MenuItem({ icon: Icon, label, shortcut, ...props }) {
  return (
    <DropdownMenuItem {...props}>
      <Icon strokeWidth={1.5} />
      {label}
      {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
    </DropdownMenuItem>
  );
}
