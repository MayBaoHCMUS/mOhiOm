# Story Setup Components

This folder contains the Step 1 (Project Configuration) overhaul for the Text-to-Comic Pipeline wizard.

## Usage

```tsx
import Step1 from '@/components/story-setup/Step1';

export default function Step0Setup() {
  return <Step1 />;
}
```

## Included

- `Step1` full Step 1 layout
- `FormField`, `NumberInput`, `FileUploadZone`, `EnhancedTextarea`
- `useFormValidation`, `useFileUpload`, `useAutosave`, `useDraftRecovery`
- `fileValidation` + `draftStorage` utilities

## Testing Scenarios

- Upload valid `.txt` and `.md` files
- Reject `.pdf` and files > 10MB
- Drag-and-drop and paste from clipboard
- Remove and replace file (with confirm on modified text)
- Autosave and restore draft flow
- Hit the character limit and verify warnings

