import type { LucideIcon } from 'lucide-react';
import { Upload, FileAudio, FileImage, FileJson, Box, File } from 'lucide-react';
import type { DroppedFile } from '../hooks/useDragAndDrop';

interface DropZoneProps {
  isDragging: boolean;
  acceptedTypes?: DroppedFile['type'][];
}

const typeConfig: Record<DroppedFile['type'], { label: string; icon: LucideIcon; color: string }> = {
  audio: { label: 'Audio', icon: FileAudio, color: 'text-blue-400' },
  image: { label: 'Image', icon: FileImage, color: 'text-purple-400' },
  json: { label: 'JSON', icon: FileJson, color: 'text-yellow-400' },
  model: { label: '3D Model', icon: Box, color: 'text-green-400' },
  unknown: { label: 'File', icon: File, color: 'text-slate-400' },
};

export default function DropZone({ isDragging, acceptedTypes }: DropZoneProps) {
  if (!isDragging) return null;

  const types = acceptedTypes && acceptedTypes.length > 0
    ? acceptedTypes
    : (Object.keys(typeConfig) as DroppedFile['type'][]);

  return (
    <div className="absolute inset-0 z-50 bg-surface-900/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="border-2 border-dashed border-accent rounded-2xl p-10 flex flex-col items-center gap-4 bg-surface-800/80 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <Upload size={32} className="text-accent-light" />
        </div>
        <p className="text-lg font-semibold text-white">Drop files here</p>
        <div className="flex gap-3">
          {types.map(t => {
            const cfg = typeConfig[t];
            const Icon = cfg.icon;
            return (
              <div key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-600">
                <Icon size={14} className={cfg.color} />
                <span className="text-xs text-slate-300">{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
