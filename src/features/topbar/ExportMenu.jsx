import { Download, FileJson, FileText, Loader2, Presentation } from 'lucide-react';
import { useDeck } from '@/hooks/useDeck.js';
import { useExport } from '@/hooks/useExport.js';
import { MenuItem } from '@/primitives/MenuItem.jsx';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-label text-muted-foreground">
          Download as
        </DropdownMenuLabel>
        <MenuItem
          icon={Presentation}
          label="PowerPoint (.pptx)"
          title="Editable text, charts and tables (Cambria / Arial)"
          onSelect={pptx}
        />
        <MenuItem
          icon={FileText}
          label="PDF"
          shortcut="Ctrl P"
          title="Opens the print dialog: choose Save as PDF"
          onSelect={pdf}
        />
        <DropdownMenuSeparator />
        <MenuItem
          icon={FileJson}
          label="Deck file (.json)"
          title="Backup, or open in another browser"
          onSelect={json}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
