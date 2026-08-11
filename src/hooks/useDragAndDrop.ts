import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';

export interface DroppedFile {
  file: File;
  type: 'audio' | 'image' | 'json' | 'model' | 'unknown';
}

function detectFileType(file: File): DroppedFile['type'] {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/json' || file.name.endsWith('.json')) return 'json';
  if (file.name.match(/\.(obj|fbx|gltf|glb|stl|ply)$/i)) return 'model';
  return 'unknown';
}

export function useDragAndDrop(
  ref: RefObject<HTMLElement | null>,
  onDrop: (files: DroppedFile[]) => void,
  options?: { acceptedTypes?: DroppedFile['type'][]; disabled?: boolean }
) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (options?.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current > 0) setIsDragging(true);
  }, [options?.disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (options?.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  }, [options?.disabled]);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (options?.disabled) return;
    e.preventDefault();
    e.stopPropagation();
  }, [options?.disabled]);

  const handleDrop = useCallback((e: DragEvent) => {
    if (options?.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files: DroppedFile[] = [];
    if (e.dataTransfer?.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const type = detectFileType(file);
            if (!options?.acceptedTypes || options.acceptedTypes.includes(type)) {
              files.push({ file, type });
            }
          }
        }
      }
    } else if (e.dataTransfer?.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const type = detectFileType(file);
        if (!options?.acceptedTypes || options.acceptedTypes.includes(type)) {
          files.push({ file, type });
        }
      }
    }

    if (files.length > 0) {
      onDrop(files);
    }
  }, [onDrop, options?.disabled, options?.acceptedTypes]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('drop', handleDrop);
    };
  }, [ref, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragging };
}
