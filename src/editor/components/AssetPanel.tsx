import { useRef, useCallback } from 'react';
import { useEditor } from '../EditorContext';
import type { Asset, LayerType } from '../types';
import {
  Upload, Image, Video, Music, FileText, Box, Trash2, Plus,
  Film,
} from 'lucide-react';

const typeIcons: Record<LayerType, typeof Image> = {
  video: Video,
  audio: Music,
  image: Image,
  text: FileText,
  shape: Film,
  mesh3d: Box,
  effect: Film,
};

export default function AssetPanel() {
  const { state, addAsset, deleteAsset, addClip, showToast } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const url = URL.createObjectURL(file);
      let type: LayerType = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('image/')) type = 'image';

      const asset: Asset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type,
        url,
      };

      // For video, try to get dimensions and duration
      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          asset.duration = video.duration;
          asset.width = video.videoWidth;
          asset.height = video.videoHeight;
        };
        video.src = url;
      }

      // For image, get dimensions
      if (type === 'image') {
        const img = document.createElement('img');
        img.onload = () => {
          asset.width = img.naturalWidth;
          asset.height = img.naturalHeight;
        };
        img.src = url;
        img.onload = () => {
          asset.width = img.naturalWidth;
          asset.height = img.naturalHeight;
        };
        img.src = url;
      }

      addAsset(asset);
    });

    showToast(`Imported ${files.length} file(s)`);
    e.target.value = '';
  }, [addAsset, showToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      let type: LayerType = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('image/')) type = 'image';

      addAsset({
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type,
        url,
      });
    });
    if (files.length > 0) showToast(`Dropped ${files.length} file(s)`);
  }, [addAsset, showToast]);

  const addToTimeline = (asset: Asset) => {
    const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
    // Find appropriate track
    const track = comp.tracks.find(t => t.type === asset.type && t.clips.length === 0);
    const start = state.currentTime;
    const duration = asset.duration || 5;

    if (track) {
      addClip(track.id, asset.type, start, duration, asset.id);
    } else {
      // Find first compatible track
      const anyTrack = comp.tracks.find(t => t.type === asset.type);
      if (anyTrack) {
        addClip(anyTrack.id, asset.type, start, duration, asset.id);
      } else {
        showToast('No compatible track available');
      }
    }
  };

  const addGeneratedLayer = (type: LayerType) => {
    const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
    const track = comp.tracks.find(t => t.type === type);
    if (!track) {
      showToast(`No ${type} track available. Add one first.`);
      return;
    }
    addClip(track.id, type, state.currentTime, 5);
    showToast(`Added ${type} layer`);
  };

  const assetsByType = (type: LayerType) => state.project.assets.filter(a => a.type === type);

  return (
    <div className="h-full bg-surface-800 border-r border-surface-600 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-surface-600">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Assets</h2>
        <p className="text-[10px] text-slate-500 mt-0.5">{state.project.assets.length} items</p>
      </div>

      {/* Import */}
      <div className="p-3 border-b border-surface-600">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 text-xs font-medium transition-colors border border-surface-600 border-dashed"
        >
          <Upload size={14} />
          Import Media
        </button>
      </div>

      {/* Quick Add Layers */}
      <div className="p-3 border-b border-surface-600">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Add Layer</label>
        <div className="grid grid-cols-3 gap-1">
          {(['text', 'shape', 'mesh3d'] as LayerType[]).map(type => {
            const Icon = typeIcons[type];
            return (
              <button
                key={type}
                onClick={() => addGeneratedLayer(type)}
                className="flex flex-col items-center gap-1 p-1.5 rounded bg-surface-700 hover:bg-surface-600 text-slate-400 hover:text-white transition-colors text-[9px]"
              >
                <Icon size={14} />
                <span className="capitalize">{type === 'mesh3d' ? '3D' : type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset List */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-3"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Video */}
        {assetsByType('video').length > 0 && (
          <AssetSection title="Video" assets={assetsByType('video')} onAdd={addToTimeline} onDelete={deleteAsset} />
        )}
        {/* Images */}
        {assetsByType('image').length > 0 && (
          <AssetSection title="Images" assets={assetsByType('image')} onAdd={addToTimeline} onDelete={deleteAsset} />
        )}
        {/* Audio */}
        {assetsByType('audio').length > 0 && (
          <AssetSection title="Audio" assets={assetsByType('audio')} onAdd={addToTimeline} onDelete={deleteAsset} />
        )}

        {state.project.assets.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Image size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-[10px]">Drop files here or click Import</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AssetSection({ title, assets, onAdd, onDelete }: {
  title: string;
  assets: Asset[];
  onAdd: (a: Asset) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">{title}</div>
      <div className="space-y-1">
        {assets.map(asset => (
          <div
            key={asset.id}
            className="group flex items-center gap-2 p-1.5 rounded bg-surface-700/50 hover:bg-surface-700 transition-colors"
          >
            <div className="w-8 h-8 rounded bg-surface-600 flex items-center justify-center shrink-0 overflow-hidden">
              {asset.type === 'image' && asset.url ? (
                <img src={asset.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] text-slate-500 uppercase">{asset.type[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-300 truncate">{asset.name}</div>
              <div className="text-[9px] text-slate-500">
                {asset.width && asset.height ? `${asset.width}×${asset.height}` : ''}
                {asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ''}
              </div>
            </div>
            <button
              onClick={() => onAdd(asset)}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-accent/20 hover:bg-accent text-accent-light hover:text-white flex items-center justify-center transition-all"
              title="Add to timeline"
            >
              <Plus size={10} />
            </button>
            <button
              onClick={() => onDelete(asset.id)}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center transition-all"
              title="Delete"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
