import { Moon, Sun } from 'lucide-react';
import { useColorScheme } from '@/hooks/useColorScheme.js';
import { IconButtonTip } from '@/primitives/IconButtonTip.jsx';

/** Light/dark for the app (D40). One button, used by the top bar and the start page (D71). */
export function ColorSchemeToggle(props) {
  const { scheme, toggle } = useColorScheme();
  return (
    <IconButtonTip
      icon={scheme === 'dark' ? Sun : Moon}
      label={scheme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={toggle}
      {...props}
    />
  );
}
