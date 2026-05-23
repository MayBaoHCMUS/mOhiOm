import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { UploadState } from '@/components/story-setup/types';
import { fileValidationConfig, formatBytes, validateFile } from '@/utils/fileValidation';

interface UseFileUploadOptions {
  currentText: string;
  existingFile: File | null;
  onContentReady: (file: File, content: string) => void;
  onFileCleared: () => void;
}

export const useFileUpload = ({ currentText, existingFile, onContentReady, onFileCleared }: UseFileUploadOptions) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: existingFile,
    status: existingFile ? 'success' : 'idle',
    progress: existingFile ? 100 : 0,
  });
  const [previewText, setPreviewText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [lastUploadedContent, setLastUploadedContent] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastProgressRef = useRef<{ time: number; loaded: number }>({ time: 0, loaded: 0 });

  useEffect(() => {
    if (existingFile && uploadState.status === 'idle') {
      setUploadState({ file: existingFile, status: 'success', progress: 100 });
    }
  }, [existingFile, uploadState.status]);

  const hasModifiedText = useMemo(() => {
    if (!lastUploadedContent) return false;
    return currentText.trim() !== lastUploadedContent.trim();
  }, [currentText, lastUploadedContent]);

  const readFile = useCallback(
    (file: File) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadState({ file: null, status: 'error', progress: 0, error: validation.error });
        setStatusMessage(validation.error || 'File validation failed.');
        return;
      }

      setUploadState({ file, status: 'uploading', progress: 0 });
      setStatusMessage('Uploading... 0%');
      setTimeRemaining(null);
      lastProgressRef.current = { time: Date.now(), loaded: 0 };

      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadState((prev) => ({ ...prev, status: 'uploading', progress }));
        setStatusMessage(`Uploading... ${progress}%`);

        const now = Date.now();
        const elapsedMs = now - lastProgressRef.current.time;
        if (elapsedMs > 0) {
          const bytesPerMs = (event.loaded - lastProgressRef.current.loaded) / elapsedMs;
          if (bytesPerMs > 0 && event.total > 5 * 1024 * 1024) {
            const remainingMs = (event.total - event.loaded) / bytesPerMs;
            setTimeRemaining(`${Math.ceil(remainingMs / 1000)}s remaining`);
          }
          lastProgressRef.current = { time: now, loaded: event.loaded };
        }
      };

      reader.onerror = () => {
        setUploadState({ file: null, status: 'error', progress: 0, error: 'Failed to upload file. Please try again' });
        setStatusMessage('Failed to upload file. Please try again');
        setTimeRemaining(null);
      };

      reader.onload = (event) => {
        const content = String(event.target?.result || '');
        setPreviewText(content.slice(0, 500));
        setLastUploadedContent(content);
        setUploadState({ file, status: 'success', progress: 100 });
        setStatusMessage('Upload complete');
        setTimeRemaining(null);
        onContentReady(file, content);
      };

      reader.readAsText(file);
    },
    [onContentReady]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      readFile(files[0]);
    },
    [readFile]
  );

  const handleReplace = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (hasModifiedText) {
        const shouldReplace = window.confirm(
          'You have edited the story text since the last upload. Replace the file and overwrite the text?'
        );
        if (!shouldReplace) return;
      }
      readFile(files[0]);
    },
    [hasModifiedText, readFile]
  );

  const clearFile = useCallback(() => {
    setUploadState({ file: null, status: 'idle', progress: 0 });
    setPreviewText('');
    setLastUploadedContent('');
    setStatusMessage('');
    setTimeRemaining(null);
    onFileCleared();
  }, [onFileCleared]);

  const openFileDialog = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.click();
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  useEffect(() => {
    const target = inputRef.current?.parentElement;
    if (!target) return undefined;
    const listener = (event: ClipboardEvent) => handlePaste(event);
    target.addEventListener('paste', listener);
    return () => target.removeEventListener('paste', listener);
  }, [handlePaste]);

  const dropHandlers = useMemo(
    () => ({
      onDragEnter: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      },
      onDragOver: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      },
      onDragLeave: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      },
    }),
    [handleFiles]
  );

  return {
    inputRef,
    uploadState,
    previewText,
    isDragging,
    statusMessage,
    timeRemaining,
    formatBytes,
    hasModifiedText,
    fileValidationConfig,
    openFileDialog,
    handleFiles,
    handleReplace,
    clearFile,
    dropHandlers,
  };
};
