import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CompAlign } from '../types';

const ACTIONS: { id: CompAlign; Icon: LucideIcon; title: string }[] = [
  { id: 'left', Icon: AlignStartVertical, title: 'Align left' },
  { id: 'hcenter', Icon: AlignCenterVertical, title: 'Align horizontal center' },
  { id: 'right', Icon: AlignEndVertical, title: 'Align right' },
  { id: 'top', Icon: AlignStartHorizontal, title: 'Align top' },
  { id: 'vcenter', Icon: AlignCenterHorizontal, title: 'Align vertical center' },
  { id: 'bottom', Icon: AlignEndHorizontal, title: 'Align bottom' },
];

export default function AlignBar({
  onAlign,
  compact = false,
}: {
  onAlign: (align: CompAlign) => void;
  compact?: boolean;
}) {
  const size = compact ? 13 : 12;
  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {ACTIONS.map((action, i) => (
        <span key={action.id} className="contents">
          {i === 3 && <span className="w-px h-4 bg-surface-600 mx-0.5 shrink-0" />}
          <button
            type="button"
            onClick={() => onAlign(action.id)}
            className={`${compact ? 'w-7 h-7' : 'w-7 h-7'} rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-700`}
            title={action.title}
          >
            <action.Icon size={size} />
          </button>
        </span>
      ))}
    </div>
  );
}
