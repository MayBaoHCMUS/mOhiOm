const ACCEPTED_EXTENSIONS = ['.txt', '.md'];
const ACCEPTED_MIME_TYPES = ['text/plain', 'text/markdown'];
const MAX_FILE_SIZE_MB = 10;

const getExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
};

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const extension = getExtension(file.name);
  const isExtensionAllowed = ACCEPTED_EXTENSIONS.includes(extension);
  const isMimeAllowed = !file.type || ACCEPTED_MIME_TYPES.includes(file.type);
  const isTypeValid = isExtensionAllowed && isMimeAllowed;

  if (!isTypeValid) {
    return { valid: false, error: 'File type not supported. Please upload .txt or .md' };
  }

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: 'File too large. Maximum size is 10MB' };
  }

  return { valid: true };
};

export const fileValidationConfig = {
  acceptedExtensions: ACCEPTED_EXTENSIONS,
  acceptedMimeTypes: ACCEPTED_MIME_TYPES,
  maxFileSizeMb: MAX_FILE_SIZE_MB,
};
