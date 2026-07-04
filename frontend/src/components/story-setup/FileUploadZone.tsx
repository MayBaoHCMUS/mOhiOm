import React from 'react';
import type { UploadState } from '@/components/story-setup/types';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileUploadZoneProps {
  file: File | null;
  storyText: string;
  disabled?: boolean;
  onFileReady: (file: File, content: string) => void;
  onFileCleared: () => void;
}

const formatPercent = (value: number) => `${Math.min(100, Math.max(0, value))}%`;

export default function FileUploadZone({ file, storyText, disabled, onFileReady, onFileCleared }: FileUploadZoneProps) {
  const {
    inputRef,
    uploadState,
    previewText,
    isDragging,
    statusMessage,
    timeRemaining,
    formatBytes,
    fileValidationConfig,
    openFileDialog,
    handleFiles,
    handleReplace,
    clearFile,
    dropHandlers,
  } = useFileUpload({ currentText: storyText, existingFile: file, onContentReady: onFileReady, onFileCleared });

  const isDisabled = disabled || uploadState.status === 'uploading';

  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center gap-3 text-center text-gray-500">
      <span className="material-symbols-outlined text-4xl">cloud_upload</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{isDragging ? 'Drop file here' : 'Drag & drop your story file here'}</p>
        <p className="text-xs">or click to browse</p>
      </div>
      <div className="text-xs">
        <p>Supports {fileValidationConfig.acceptedExtensions.join(', ')} files</p>
        <p>Maximum size: {fileValidationConfig.maxFileSizeMb}MB</p>
      </div>
    </div>
  );

  const renderUploading = (state: UploadState) => (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm text-blue-600">
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">sync</span>
          {statusMessage || 'Uploading...'}
        </span>
        <span>{formatPercent(state.progress)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-blue-100">
        <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: formatPercent(state.progress) }} />
      </div>
      {timeRemaining ? <p className="text-xs text-blue-600">{timeRemaining}</p> : null}
    </div>
  );

  const renderSuccess = (state: UploadState) => (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-emerald-600">description</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{state.file?.name}</p>
            <p className="text-xs text-gray-500">{state.file ? formatBytes(state.file.size) : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <button
            type="button"
            onClick={clearFile}
            className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-red-400 hover:text-red-500"
            aria-label="Remove file"
            disabled={disabled}
          >
            ×
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-semibold text-gray-500 mb-2">Preview (first 500 characters)</p>
        <p className="whitespace-pre-wrap line-clamp-6">{previewText || 'No preview available.'}</p>
      </div>
      <button
        type="button"
        onClick={openFileDialog}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        disabled={disabled}
      >
        Replace file
      </button>
    </div>
  );

  const renderError = (state: UploadState) => (
    <div className="flex flex-col items-center gap-3 text-center text-red-600">
      <span className="material-symbols-outlined text-3xl">error</span>
      <p className="text-sm font-semibold">{state.error || 'Upload failed'}</p>
      <button
        type="button"
        onClick={openFileDialog}
        className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:border-red-400"
      >
        Try again
      </button>
    </div>
  );

  const baseClass = [
    'rounded-2xl border-2 border-dashed p-6 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
    isDisabled
      ? 'cursor-not-allowed bg-gray-50 border-gray-200 text-gray-300'
      : 'cursor-pointer hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600',
    isDragging ? 'scale-[1.02] border-blue-500 bg-blue-100/20 text-blue-600' : 'border-gray-300 text-gray-500',
  ].join(' ');

  const zoneContent = () => {
    if (uploadState.status === 'uploading') return renderUploading(uploadState);
    if (uploadState.status === 'success') return renderSuccess(uploadState);
    if (uploadState.status === 'error') return renderError(uploadState);
    return renderIdle();
  };

  return (
    <div className="space-y-3">
      <div
        className={baseClass}
        role="button"
        tabIndex={0}
        onClick={() => !isDisabled && openFileDialog()}
        onKeyDown={(event) => {
          if (isDisabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFileDialog();
          }
        }}
        aria-label="Upload story file. Drag and drop or click to browse"
        aria-disabled={isDisabled}
        {...dropHandlers}
      >
        {zoneContent()}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={fileValidationConfig.acceptedExtensions.join(',')}
        className="hidden"
        onChange={(event) =>
          uploadState.status === 'success' ? handleReplace(event.target.files) : handleFiles(event.target.files)
        }
        disabled={isDisabled}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </div>

      {uploadState.status === 'success' ? (
        <div className="text-xs text-gray-500">
          Tip: Paste a file from your clipboard (Ctrl+V / Cmd+V) to replace quickly.
        </div>
      ) : null}
    </div>
  );
}
