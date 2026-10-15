import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import DesignCheck from './dev/DesignCheck.jsx';
import ScaffoldCheck from './dev/ScaffoldCheck.jsx';
import { useColorScheme } from './hooks/useColorScheme.js';
import { IconButtonTip } from './primitives/IconButtonTip.jsx';
import { Button } from './primitives/ui/button.jsx';
import { TooltipProvider } from './primitives/ui/tooltip.jsx';
import { cn } from './primitives/cn.js';

// Temporary dev shell: two check pages behind a tab bar. Replaced by the editor at the canvas port.
const PAGES = [
  ['design', 'Design system', DesignCheck],
  ['canvas', 'Canvas & SSE', ScaffoldCheck],
];

export default function App() {
  const [page, setPage] = useState('design');
  const { scheme, toggle } = useColorScheme();
  const Page = PAGES.find(([id]) => id === page)[2];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-panel px-4">
          <span className="text-sm font-semibold">AI Presentation Builder</span>
          <span className="rounded-full bg-subtle px-2 py-0.5 text-label text-muted-foreground">
            dev checks
          </span>
          <nav className="flex gap-1">
            {PAGES.map(([id, label]) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                aria-current={page === id ? 'page' : undefined}
                className={cn(page === id && 'bg-accent')}
                onClick={() => setPage(id)}
              >
                {label}
              </Button>
            ))}
          </nav>
          <div className="ml-auto">
            <IconButtonTip
              icon={scheme === 'dark' ? Sun : Moon}
              label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggle}
            />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-background">
          <Page />
        </main>
      </div>
    </TooltipProvider>
  );
}
