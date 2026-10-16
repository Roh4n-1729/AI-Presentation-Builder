import { Plus } from 'lucide-react';
import { useDeckActions } from '@/hooks/useDeck.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';

/** "+" between slides in the column: add a blank slide right here. */
export function InsertBetween({ afterSlideId }) {
  const { addBlankSlide } = useDeckActions();
  return (
    <div className="group flex h-12 items-center justify-center">
      <div className="flex items-center gap-2 opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100">
        <span className="h-px w-24 bg-border" />
        <IconButtonTip
          icon={Plus}
          label="Add blank slide here"
          onClick={() => addBlankSlide(afterSlideId)}
        />
        <span className="h-px w-24 bg-border" />
      </div>
    </div>
  );
}
