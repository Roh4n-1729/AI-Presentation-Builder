import { RouterProvider } from 'react-router';
import { AppDialog } from './features/feedback/AppDialog.jsx';
import { Toaster } from './features/feedback/Toaster.jsx';
import { useChromePrefs } from './hooks/useColorScheme.js';
import { useWorkspaceBoot } from './hooks/useWorkspace.js';
import { TooltipProvider } from './primitives/ui/tooltip.jsx';
import { router } from './router.jsx';

export default function App() {
  useWorkspaceBoot();
  useChromePrefs();
  return (
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
      <Toaster />
      <AppDialog />
    </TooltipProvider>
  );
}
