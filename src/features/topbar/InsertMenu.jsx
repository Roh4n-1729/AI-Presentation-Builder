import { useRef } from 'react';
import {
  ArrowRight,
  ChartColumn,
  ChartLine,
  ChartPie,
  Circle,
  ImagePlus,
  Link,
  List,
  Minus,
  Plus,
  Square,
  Table,
  Type,
} from 'lucide-react';
import { useDeck } from '@/hooks/useDeck.js';
import { useInsert } from '@/hooks/useInsert.js';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

function Item({ icon: Icon, label, onSelect }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <Icon strokeWidth={1.5} /> {label}
    </DropdownMenuItem>
  );
}

/** Insert ▾: text, list, chart, table, image (upload or URL), shapes, on the active slide. */
export function InsertMenu() {
  const { insert, insertImageFile, insertImageUrl } = useInsert();
  const aiBusy = useDeck((s) => s.aiBusy);
  const fileRef = useRef(null);
  const reportError = (err) => window.alert(err?.message ?? 'Could not insert that image.');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={aiBusy}>
            <Plus strokeWidth={1.75} /> Insert
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <Item icon={Type} label="Text box" onSelect={() => insert('text')} />
          <Item icon={List} label="Bulleted list" onSelect={() => insert('bullets')} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label text-muted-foreground">Data</DropdownMenuLabel>
          <Item icon={ChartColumn} label="Bar chart" onSelect={() => insert('chart-bar')} />
          <Item icon={ChartLine} label="Line chart" onSelect={() => insert('chart-line')} />
          <Item icon={ChartPie} label="Pie chart" onSelect={() => insert('chart-pie')} />
          <Item icon={Table} label="Table" onSelect={() => insert('table')} />
          <DropdownMenuSeparator />
          <Item
            icon={ImagePlus}
            label="Image from your computer…"
            onSelect={() => fileRef.current?.click()}
          />
          <Item
            icon={Link}
            label="Image from a URL…"
            onSelect={() => {
              const url = window.prompt('Image URL (https://…)');
              if (url && /^https?:\/\//.test(url.trim())) insertImageUrl(url.trim());
            }}
          />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label text-muted-foreground">Shapes</DropdownMenuLabel>
          <Item icon={Square} label="Rectangle" onSelect={() => insert('rect')} />
          <Item icon={Circle} label="Ellipse" onSelect={() => insert('ellipse')} />
          <Item icon={Minus} label="Line" onSelect={() => insert('line')} />
          <Item icon={ArrowRight} label="Arrow" onSelect={() => insert('arrow')} />
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow picking the same file again
          if (file) insertImageFile(file).catch(reportError);
        }}
      />
    </>
  );
}
