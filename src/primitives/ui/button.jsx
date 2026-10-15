import { cva } from 'class-variance-authority';
import { cn } from '@/primitives/cn';
import { Slot } from 'radix-ui';
// shadcn button, restyled for §8c: primary actions are pills (dark + light, with a subtle inset
// highlight), toolbar/icon buttons are 6px-rounded ghosts, `ai` is the saffron AI action.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-ui font-medium whitespace-nowrap transition-[color,background-color,box-shadow,opacity] duration-120 ease-standard outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'rounded-full bg-primary text-primary-foreground shadow-pill hover:bg-primary/90',
        secondary:
          'rounded-full bg-secondary text-secondary-foreground shadow-pill-light hover:bg-accent',
        outline: 'rounded-full border bg-panel hover:bg-accent hover:text-accent-foreground',
        ai: 'rounded-full bg-ai text-white shadow-pill hover:bg-ai/90',
        destructive:
          'rounded-full bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20',
        ghost: 'rounded-md hover:bg-accent hover:text-accent-foreground',
        link: 'text-user underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 has-[>svg]:px-3',
        xs: "h-6 gap-1 px-2 text-label has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 text-sm has-[>svg]:px-4',
        icon: "size-9 [&_svg:not([class*='size-'])]:size-[18px]",
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': "size-8 [&_svg:not([class*='size-'])]:size-[18px]",
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
function Button({ className, variant = 'default', size = 'default', asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
