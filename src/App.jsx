import { TooltipProvider } from './primitives/ui/tooltip.jsx';
import { EditorScreen } from './screens/EditorScreen.jsx';

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <EditorScreen />
    </TooltipProvider>
  );
}
