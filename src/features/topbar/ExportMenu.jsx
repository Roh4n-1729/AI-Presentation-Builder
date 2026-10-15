import { Download, FileJson, FileText, Loader2, Presentation } from 'lucide-react';
import { useDeck } from '@/hooks/useDeck.js';
import { useExport } from '@/hooks/useExport.js';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

function Item({ icon: Icon, label, hint, shortcut, onSelect }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start">
      <Icon strokeWidth={1.5} className="mt-0.5" />
      <span className="flex flex-col">
        {label}
        {hint && <span className="text-label text-muted-foreground">{hint}</span>}
      </span>
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}

/** Export ▾: PowerPoint (native charts and tables), PDF via the print view, deck file. */
export function ExportMenu() {
  const { busy, pptx, json, pdf } = useExport();
  const empty = useDeck((s) => s.deck.slideOrder.length === 0);
  const aiBusy = useDeck((s) => s.aiBusy);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={empty || busy || aiBusy}>
          {busy ? (
            <Loader2 className="animate-spin" strokeWidth={1.75} />
          ) : (
            <Download strokeWidth={1.75} />
          )}
          {busy ? 'Exporting…' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-label text-muted-foreground">
          Download as
        </DropdownMenuLabel>
        <Item
          icon={Presentation}
          label="PowerPoint (.pptx)"
          hint="Editable text, charts and tables · Cambria / Arial"
          onSelect={pptx}
        />
        <Item
          icon={FileText}
          label="PDF"
          hint="Print dialog → Save as PDF · exact fonts"
          shortcut="Ctrl P"
          onSelect={pdf}
        />
        <DropdownMenuSeparator />
        <Item
          icon={FileJson}
          label="Deck file (.json)"
          hint="Backup, or open in another browser"
          onSelect={json}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
