import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Puzzle,
  Plus,
  Trash2,
  Power,
  Code,
  User,
  Tag,
  Download,
  Upload,
} from 'lucide-react';

export default function PluginManager() {
  const { state, addPlugin, removePlugin, togglePlugin, showToast, setPendingDrop } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [newPlugin, setNewPlugin] = useState({ name: '', description: '', version: '1.0.0', author: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledCount = state.plugins.filter(p => p.enabled).length;

  // Handle dropped JSON files from global drag-and-drop
  useEffect(() => {
    if (!state.pendingDrop) return;
    const jsonFiles = state.pendingDrop.filter(f => f.type === 'json');
    if (jsonFiles.length > 0) {
      jsonFiles.forEach(df => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (Array.isArray(data)) {
              data.forEach((p: typeof newPlugin & { id?: string }) => {
                addPlugin({
                  id: p.id || `plugin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  name: p.name,
                  version: p.version || '1.0.0',
                  description: p.description || '',
                  enabled: true,
                  author: p.author || 'Imported',
                });
              });
              showToast(`Imported ${data.length} plugins from ${df.file.name}`);
            } else {
              addPlugin({
                id: data.id || `plugin-${Date.now()}`,
                name: data.name,
                version: data.version || '1.0.0',
                description: data.description || '',
                enabled: true,
                author: data.author || 'Imported',
              });
              showToast(`Imported plugin from ${df.file.name}`);
            }
          } catch {
            showToast(`Invalid plugin file: ${df.file.name}`);
          }
        };
        reader.readAsText(df.file);
      });
    }
    setPendingDrop(null);
  }, [state.pendingDrop, setPendingDrop, addPlugin, showToast]);

  const handleAddPlugin = () => {
    if (!newPlugin.name.trim()) {
      showToast('Plugin name is required');
      return;
    }
    const plugin = {
      id: `plugin-${Date.now()}`,
      name: newPlugin.name,
      version: newPlugin.version || '1.0.0',
      description: newPlugin.description || 'No description provided.',
      enabled: true,
      author: newPlugin.author || 'Unknown',
    };
    addPlugin(plugin);
    setNewPlugin({ name: '', description: '', version: '1.0.0', author: '' });
    setShowAdd(false);
    showToast(`Plugin "${plugin.name}" installed`);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          data.forEach((p: typeof newPlugin & { id?: string }) => {
            addPlugin({
              id: p.id || `plugin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: p.name,
              version: p.version || '1.0.0',
              description: p.description || '',
              enabled: true,
              author: p.author || 'Imported',
            });
          });
          showToast(`Imported ${data.length} plugins`);
        } else {
          addPlugin({
            id: data.id || `plugin-${Date.now()}`,
            name: data.name,
            version: data.version || '1.0.0',
            description: data.description || '',
            enabled: true,
            author: data.author || 'Imported',
          });
          showToast('Plugin imported successfully');
        }
      } catch {
        showToast('Invalid plugin file format');
      }
    };
    reader.readAsText(file);
  };

  const exportPlugins = () => {
    const data = JSON.stringify(state.plugins, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frame-lab-plugins.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Plugins exported');
  };

  return (
    <div className="flex h-full">
      {/* Plugin List */}
      <div className="flex-1 flex flex-col bg-surface-900 overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-surface-800 border-b border-surface-600 flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Puzzle size={18} className="text-accent-light" />
            <div>
              <h2 className="text-sm font-semibold text-white">Plugin Manager</h2>
              <p className="text-[10px] text-slate-400">{state.plugins.length} installed · {enabledCount} active</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 text-xs font-medium transition-colors border border-surface-600"
            >
              <Upload size={13} />
              Import
            </button>
            <button
              onClick={exportPlugins}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 text-xs font-medium transition-colors border border-surface-600"
            >
              <Download size={13} />
              Export
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              New Plugin
            </button>
          </div>
        </div>

        {/* Plugin Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.plugins.map(plugin => (
              <div
                key={plugin.id}
                className={`group rounded-xl border p-4 transition-all hover:shadow-lg ${
                  plugin.enabled
                    ? 'bg-surface-800 border-surface-600 hover:border-accent/50'
                    : 'bg-surface-800/50 border-surface-700 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      plugin.enabled ? 'bg-accent/20 text-accent-light' : 'bg-surface-700 text-slate-500'
                    }`}>
                      <Code size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{plugin.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Tag size={10} className="text-slate-500" />
                        <span className="text-[10px] text-slate-500">v{plugin.version}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePlugin(plugin.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      plugin.enabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-surface-700 text-slate-500 hover:text-slate-300'
                    }`}
                    title={plugin.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power size={14} />
                  </button>
                </div>

                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{plugin.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User size={10} className="text-slate-500" />
                    <span className="text-[10px] text-slate-500">{plugin.author}</span>
                  </div>
                  <button
                    onClick={() => {
                      removePlugin(plugin.id);
                      showToast(`Removed "${plugin.name}"`);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {state.plugins.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <Puzzle size={40} className="mb-3 opacity-20" />
              <p className="text-sm">No plugins installed</p>
              <p className="text-xs mt-1">Create, import, or drop a JSON file to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Plugin Modal Overlay */}
      {showAdd && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Create Plugin</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Plugin Name</label>
                <input
                  value={newPlugin.name}
                  onChange={e => setNewPlugin(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Color Grading"
                  className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-sm text-white placeholder-slate-500 focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <textarea
                  value={newPlugin.description}
                  onChange={e => setNewPlugin(p => ({ ...p, description: e.target.value }))}
                  placeholder="What does this plugin do?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-sm text-white placeholder-slate-500 focus:border-accent outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Version</label>
                  <input
                    value={newPlugin.version}
                    onChange={e => setNewPlugin(p => ({ ...p, version: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-sm text-white focus:border-accent outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Author</label>
                  <input
                    value={newPlugin.author}
                    onChange={e => setNewPlugin(p => ({ ...p, author: e.target.value }))}
                    placeholder="Your name"
                    className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-sm text-white placeholder-slate-500 focus:border-accent outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlugin}
                className="flex-1 px-3 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-medium transition-colors"
              >
                Create Plugin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
