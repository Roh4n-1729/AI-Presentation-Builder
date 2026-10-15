import { cn } from '@/primitives/cn.js';

/** A row of toolbar controls; consecutive groups are separated by a hairline divider. */
export function ToolbarGroup({ className, children, ...props }) {
  return (
    <div
      role="group"
      className={cn('flex items-center gap-0.5 [&+&]:ml-1 [&+&]:border-l [&+&]:pl-1.5', className)}
      {...props}
    >
      {children}
    </div>
  );
}
