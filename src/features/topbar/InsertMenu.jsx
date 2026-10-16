import { useRef } from 'react';
import {
  Heading,
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
import { useFeedback } from '@/hooks/useFeedback.js';
import { useInsert } from '@/hooks/useInsert.js';
import { MenuItem } from '@/primitives/MenuItem.jsx';
import { Button } from '@/primitives/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/primitives/ui/dropdown-menu.jsx';

/** Insert ▾: text, list, chart, table, image (upload or URL), shapes, on the active slide. */
export function InsertMenu() {
  const { insert, insertImageFile, insertImageUrl } = useInsert();
  const aiBusy = useDeck((s) => s.aiBusy);
  const fileRef = useRef(null);
  const feedback = useFeedback();
  const reportError = (err) =>
    feedback.error("Couldn't insert that image", err?.message ?? 'Try another file or link.');
  // A modal instead of window.prompt (D62). Opened a tick later, after the menu has closed and
  // handed focus back, so the dialog keeps focus.
  const askForImageUrl = () =>
    setTimeout(async () => {
      const url = await feedback.prompt({
        title: 'Insert an image from a link',
        label: 'Image URL',
        placeholder: 'https://…',
        confirmLabel: 'Insert',
        validate: (v) => (/^https?:\/\/\S+$/.test(v) ? '' : 'Enter a link starting with https://'),
      });
      if (url) Promise.resolve(insertImageUrl(url)).catch(reportError);
    }, 0);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={aiBusy}>
            <Plus strokeWidth={1.75} /> Insert
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <MenuItem icon={Heading} label="Title" onSelect={() => insert('title')} />
          <MenuItem icon={Type} label="Text box" onSelect={() => insert('text')} />
          <MenuItem icon={List} label="Bulleted list" onSelect={() => insert('bullets')} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label text-muted-foreground">Data</DropdownMenuLabel>
          <MenuItem icon={ChartColumn} label="Bar chart" onSelect={() => insert('chart-bar')} />
          <MenuItem icon={ChartLine} label="Line chart" onSelect={() => insert('chart-line')} />
          <MenuItem icon={ChartPie} label="Pie chart" onSelect={() => insert('chart-pie')} />
          <MenuItem icon={Table} label="Table" onSelect={() => insert('table')} />
          <DropdownMenuSeparator />
          <MenuItem
            icon={ImagePlus}
            label="Image from your computer…"
            onSelect={() => fileRef.current?.click()}
          />
          <MenuItem icon={Link} label="Image from a URL…" onSelect={askForImageUrl} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label text-muted-foreground">Shapes</DropdownMenuLabel>
          <MenuItem icon={Square} label="Rectangle" onSelect={() => insert('rect')} />
          <MenuItem icon={Circle} label="Ellipse" onSelect={() => insert('ellipse')} />
          <MenuItem icon={Minus} label="Line" onSelect={() => insert('line')} />
          <MenuItem icon={ArrowRight} label="Arrow" onSelect={() => insert('arrow')} />
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
