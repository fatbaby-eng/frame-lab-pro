import { useEffect, useCallback, useState } from 'react';

export interface Shortcut {
  key: string;
  label: string;
  scope: string;
  action: () => void;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  deps: unknown[] = []
) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const pressed = [];
    if (e.ctrlKey || e.metaKey) pressed.push('ctrl');
    if (e.altKey) pressed.push('alt');
    if (e.shiftKey) pressed.push('shift');
    const keyName = e.key === ' ' ? 'space' : e.key.toLowerCase();
    pressed.push(keyName);
    const combo = pressed.join('+');

    // Global help toggle: ? or Shift+/
    if (combo === '?' || combo === 'shift+/') {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    for (const s of shortcuts) {
      if (s.key === combo) {
        e.preventDefault();
        s.action();
        return;
      }
    }
  }, [shortcuts, ...deps]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
