import { X, Keyboard, Command } from 'lucide-react';
import type { Shortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  shortcuts: Shortcut[];
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ shortcuts, onClose }: KeyboardShortcutsModalProps) {
  // Group shortcuts by scope
  const grouped = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.scope]) acc[s.scope] = [];
    acc[s.scope].push(s);
    return acc;
  }, {});

  const formatKey = (key: string) => {
    return key
      .replace(/ctrl\+/g, 'Ctrl ')
      .replace(/alt\+/g, 'Alt ')
      .replace(/shift\+/g, 'Shift ')
      .toUpperCase()
      .split(' ')
      .map(k => (
        <kbd key={k} className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-[10px] font-mono text-white">
          {k}
        </kbd>
      ));
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface-800 border border-surface-600 rounded-2xl w-[28rem] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-accent-light" />
            <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-700 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {Object.entries(grouped).map(([scope, items]) => (
            <div key={scope}>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{scope}</h3>
              <div className="space-y-1.5">
                {items.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-700/50 transition-colors">
                    <span className="text-xs text-slate-300">{s.label}</span>
                    <div className="flex gap-1">
                      {formatKey(s.key)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-surface-600 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <Command size={10} />
          Press <kbd className="px-1 rounded bg-surface-700 border border-surface-600 font-mono">?</kbd> anytime to toggle this palette
        </div>
      </div>
    </div>
  );
}
