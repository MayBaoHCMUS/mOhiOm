'use client'; // ← ADD THIS at the very top

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CharacterWordCounter from '@/components/story-setup/CharacterWordCounter';
import ErrorMessage from '@/components/story-setup/ErrorMessage';
import HelperText from '@/components/story-setup/HelperText';
import SaveIndicator from '@/components/story-setup/SaveIndicator';
import Tooltip from '@/components/story-setup/Tooltip';
import type { TextareaProps } from '@/components/story-setup/types';
import { useAutosave } from '@/hooks/useAutosave';
import { useDraftRecovery } from '@/hooks/useDraftRecovery';

interface EnhancedTextareaProps extends TextareaProps {
  id: string;
  label: string;
  saveKey: string;
  helperText?: string;
  tooltip?: string;
}

const MIN_HEIGHT = 100;
const INITIAL_HEIGHT = 200;
const MAX_HEIGHT = 500;
const MOBILE_MIN_HEIGHT = 320;

export default function EnhancedTextarea({
                                           id,
                                           label,
                                           value,
                                           onChange,
                                           maxLength = 10000,
                                           minLength = 100,
                                           placeholder,
                                           autosave = true,
                                           autoExpand = true,
                                           helperText,
                                           tooltip,
                                           saveKey,
                                         }: EnhancedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [pasteNotice, setPasteNotice] = useState('');

  // ✅ ADD THIS: prevents hydration mismatch for all client-only state
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { saveStatus, saveNow, hasUnsavedChanges, isOffline } = useAutosave(value, saveKey, autosave ? 30000 : 0);
  const { draft, restoreDraft, discardDraft } = useDraftRecovery(saveKey, value);

  const charCount = value.length;
  const isNearLimit = charCount >= maxLength * 0.9;
  const isAtLimit = charCount >= maxLength;
  const isUnderMin = charCount > 0 && charCount < minLength;

  const textareaError = useMemo(() => {
    if (isAtLimit) return 'Maximum character limit reached';
    if (isUnderMin) return 'Story must be at least 100 characters';
    return undefined;
  }, [isAtLimit, isUnderMin]);

  const textareaWarning = useMemo(() => {
    if (!isAtLimit && isNearLimit) return "You're approaching the character limit";
    return undefined;
  }, [isAtLimit, isNearLimit]);

  const resizeTextarea = useCallback(() => {
    if (!autoExpand || !textareaRef.current) return;
    const element = textareaRef.current;
    element.style.height = 'auto';
    const baseHeight = value ? Math.max(element.scrollHeight, MIN_HEIGHT) : INITIAL_HEIGHT;
    const nextHeight = Math.min(baseHeight, MAX_HEIGHT);
    element.style.height = `${nextHeight}px`;
  }, [autoExpand, value]);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, value]);

  const updateValue = (nextValue: string) => {
    const clipped = nextValue.slice(0, maxLength);
    onChange(clipped);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const plainText = event.clipboardData.getData('text/plain');
    const hadHtml = Boolean(event.clipboardData.getData('text/html'));
    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const nextValue = value.slice(0, selectionStart) + plainText + value.slice(selectionEnd);
    updateValue(nextValue);
    if (hadHtml) {
      setPasteNotice('Formatted text detected. Clean pasted text for a smoother read.');
    }
    if (nextValue.length > maxLength) {
      setPasteNotice('Pasted text exceeded the limit. Extra characters were removed.');
    }
  };

  const cleanPastedText = () => {
    const cleaned = value.replace(/[\t\f\r]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    updateValue(cleaned);
    setPasteNotice('');
  };

  const insertAtCursor = (prefix: string, suffix = prefix) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = value.slice(start, end);
    const nextValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    updateValue(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  };

  const insertList = (ordered: boolean) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = value.slice(start, end) || 'List item';
    const lines = selected.split('\n');
    const nextLines = lines.map((line, index) => (ordered ? `${index + 1}. ${line}` : `- ${line}`));
    const nextValue = value.slice(0, start) + nextLines.join('\n') + value.slice(end);
    updateValue(nextValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveNow();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const start = event.currentTarget.selectionStart;
      const end = event.currentTarget.selectionEnd;
      const nextValue = value.slice(0, start) + '    ' + value.slice(end);
      updateValue(nextValue);
      window.requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(start + 4, start + 4);
      });
    }
  };

  const wrapperClass = isFullscreen
      ? 'fixed inset-0 z-50 bg-white p-4 md:relative md:inset-auto md:z-auto md:bg-transparent md:p-0'
      : 'relative';

  const warningId = `${id}-warning`;
  const helpId = `${id}-help`;
  const counterId = `${id}-counter`;

  return (
      <div className={wrapperClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500">
            <span>{label}</span>
            <span className="text-red-500">*</span>
            {tooltip ? <Tooltip content={tooltip} /> : null}
          </div>
          <div className="flex items-center gap-3">
            {/* ✅ Only render SaveIndicator after mount — isOffline uses navigator.onLine */}
            {isMounted ? <SaveIndicator status={saveStatus} isOffline={isOffline} /> : null}
            <button
                type="button"
                onClick={() => setShowToolbar((prev) => !prev)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              {showToolbar ? 'Hide toolbar' : 'Show toolbar'}
            </button>
            <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="md:hidden text-xs font-semibold text-blue-600"
            >
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>

        {showToolbar ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertAtCursor('**')}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                B
              </button>
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertAtCursor('*')}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                I
              </button>
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertList(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                •
              </button>
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertList(true)}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                1.
              </button>
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => document.execCommand('undo')}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                ↶
              </button>
              <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => document.execCommand('redo')}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                ↷
              </button>
            </div>
        ) : null}

        {/* ✅ Guard with isMounted — draft comes from localStorage, null on server */}
        {isMounted && draft ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
              <p className="font-semibold">We found a saved draft from {new Date(draft.savedAt).toLocaleString()}.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => {
                      const restored = restoreDraft();
                      if (restored !== null) {
                        onChange(restored);
                      }
                    }}
                    className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Restore Draft
                </button>
                <button
                    type="button"
                    onClick={discardDraft}
                    className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700"
                >
                  Discard
                </button>
              </div>
            </div>
        ) : null}

        <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(event) => updateValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            className={`mt-4 w-full rounded-2xl border px-4 py-3 text-sm text-gray-900 transition-all focus:outline-none ${
                textareaError
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            } ${isFullscreen ? 'min-h-[60vh]' : 'min-h-[200px]'} ${autoExpand ? 'resize-none' : 'resize-y'}`}
            style={{ minHeight: isFullscreen ? MOBILE_MIN_HEIGHT : MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
            aria-label="Story text input"
            aria-invalid={Boolean(textareaError)}
            aria-describedby={`${counterId} ${warningId} ${helpId} ${id}-error`}
        />

        <div id={counterId}>
          <CharacterWordCounter value={value} maxLength={maxLength} minLength={minLength} />
        </div>

        {textareaWarning ? <HelperText id={warningId} text={textareaWarning} tone="warning" /> : null}
        {helperText ? <HelperText id={helpId} text={helperText} /> : null}
        <ErrorMessage id={`${id}-error`} message={textareaError} />

        {/* ✅ Guard with isMounted — pasteNotice is always '' on server anyway, but safe to guard */}
        {isMounted && pasteNotice ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>{pasteNotice}</span>
              <button
                  type="button"
                  onClick={cleanPastedText}
                  className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                Clean pasted text
              </button>
              <button
                  type="button"
                  onClick={() => setPasteNotice('')}
                  className="text-xs text-amber-700 underline"
              >
                Dismiss
              </button>
            </div>
        ) : null}

        <div className="mt-3 text-xs text-gray-500">💡 Tip: Press Ctrl+S / Cmd+S to save</div>
        {/* ✅ Guard with isMounted — hasUnsavedChanges is derived from localStorage state */}
        {isMounted && hasUnsavedChanges ? <div className="mt-1 text-xs text-amber-600">Unsaved changes</div> : null}
        <div className="sr-only" aria-live="polite">
          {isMounted && saveStatus.status === 'saved' ? 'Story saved successfully' : ''}
        </div>
      </div>
  );
}