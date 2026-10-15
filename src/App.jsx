import { useChromePrefs } from './hooks/useColorScheme.js';
import { useDeck } from './hooks/useDeck.js';
import { useWorkspaceBoot } from './hooks/useWorkspace.js';
import { TooltipProvider } from './primitives/ui/tooltip.jsx';
import { EditorScreen } from './screens/EditorScreen.jsx';
import { StartScreen } from './screens/StartScreen.jsx';

export default function App() {
  useWorkspaceBoot();
  useChromePrefs();
  const screen = useDeck((s) => s.screen);
  return (
    <TooltipProvider delayDuration={300}>
      {screen === 'editor' ? (
        <EditorScreen />
      ) : screen === 'start' ? (
        <StartScreen />
      ) : (
        <div className="h-full bg-background" aria-busy="true" />
      )}
    </TooltipProvider>
  );
}
