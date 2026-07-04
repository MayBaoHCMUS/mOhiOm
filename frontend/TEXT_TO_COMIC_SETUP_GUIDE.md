# Text-to-Comic Generation Application Setup Guide

## Overview
A complete, modern React functional component for a "Text-to-Comic Generation" application with a 4-step workflow, built with Next.js and Tailwind CSS.

## Features

### 1. **Complete UI/UX**
- Modern gradient dark theme with slate and blue color scheme
- Split-screen layout: Sidebar for inputs + Main content area for workflow steps
- Responsive design using Tailwind CSS
- Smooth animations and transitions
- Loading states with visual feedback

### 2. **4-Step Workflow**
- **Step 1: Planning & Breakdown** - Character analysis and story structure
- **Step 2: Character Designs** - Character design guidelines and AI prompts
- **Step 3: Panel-by-Panel Scripts** - Detailed manga panel scripts
- **Step 4: Image Generation** - Generated manga panel images grid

### 3. **Input & Configuration Area**
- File upload for story files (.txt, .md, .pdf)
- Textarea for direct story text input
- Configurable parameters:
  - Main characters count
  - Number of chapters
  - Target total pages
  - Preferred manga genre & tone
  - Art style reference
  - Maximum panels per page

### 4. **State Management**
- Full React hooks implementation (useState)
- Mock asynchronous handlers for all 4 steps
- Loading states with 2-second processing simulation
- Sequential workflow progression

## Installation & Setup

### 1. Install Dependencies
```bash
cd F:\Thesis\frontend
npm install
```

This will install:
- React & React DOM (v18.2.0+)
- Next.js (v14.0.0+)
- Tailwind CSS (v3.3.0+)
- Autoprefixer (v10.4.14+)
- PostCSS (v8.4.24+)
- Axios (v1.6.0+)

### 2. Tailwind CSS Configuration
The following files have been created/configured:
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration
- `src/styles/globals.css` - Global styles with Tailwind directives

### 3. Component Files
- `src/components/TextToComicGenerator.tsx` - Main component (700+ lines)
- `src/app/page.tsx` - Home page using the component
- `src/app/layout.tsx` - Root layout with global styles

## Running the Application

### Development Mode
```bash
cd F:\Thesis\frontend
npm run dev
```
The application will be available at: `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

## Component Structure

### Props & State
- **Configuration State**: storyFile, storyText, mainCharacters, numChapters, targetPages, mangaGenre, artStyle, maxPanelsPerPage
- **Result State**: step1Result, step2Result, step3Result, step4Result
- **UI State**: loadingStep, activeStep

### Mock Data
Each step generates realistic mock data:
- Step 1: Character count, plot analysis, chapter division, scene breakdown
- Step 2: Global design guidelines, 5 main character sheets, AI image prompts
- Step 3: 2 example pages with detailed panel scripts
- Step 4: 12 placeholder images in a grid layout

## Features Breakdown

### Sidebar (Left Panel)
- **Header**: Logo and title
- **Story Input**: File upload and textarea
- **Configuration**: 6 customizable input fields
- **Styling**: Dark slate background with blue accents

### Main Content Area
- **Step Navigation**: Interactive stepper with visual progress indicators
- **Step Content**: Dynamic content that changes based on active step
- **Action Buttons**: "Run Step X" buttons with loading states
- **Results Display**: Formatted output for each step

### Responsive Design
- Clean grid layouts for character cards
- Flexible spacing and typography
- Hover effects and transitions
- Mobile-friendly panels

## Customization Options

### Colors
Edit `tailwind.config.js` theme section to change the color scheme.

### Step Content
Modify the mock data in `handleStep1`, `handleStep2`, `handleStep3`, and `handleStep4` functions.

### Component Layout
Adjust padding, spacing, and grid columns in the JSX.

### Input Fields
Add/remove input fields in the sidebar configuration section.

## API Integration (Future)

To connect to a real backend API:

1. Replace mock handlers with actual API calls:
```typescript
const handleStep1 = async () => {
  setLoadingStep(1);
  try {
    const response = await axios.post('/api/step1', {
      storyText,
      mainCharacters,
      numChapters,
      targetPages,
      mangaGenre,
      artStyle,
    });
    setStep1Result(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
  setLoadingStep(null);
};
```

2. Update file upload handler:
```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post('/api/upload', formData);
    setStoryFile(file);
    setStoryText(response.data.content);
  }
};
```

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Performance Considerations
- Component uses React.memo can be added for child components if needed
- Mock data generators are lightweight
- Lazy loading images in Step 4 output
- Efficient state updates with useState

## Accessibility
- Semantic HTML structure
- Proper button labeling
- Color contrast compliance
- Keyboard navigation support
- ARIA labels can be added for better screen reader support

## Troubleshooting

### Tailwind CSS not applying
1. Ensure `npm install` completed successfully
2. Check `src/styles/globals.css` is imported in `layout.tsx`
3. Verify `tailwind.config.js` content paths are correct

### Component not rendering
1. Check that TextToComicGenerator is exported correctly
2. Ensure 'use client' directive is at the top of the component file
3. Verify page.tsx imports are correct

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```

## File Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx (updated with global styles)
│   │   └── page.tsx (updated to use component)
│   ├── components/
│   │   └── TextToComicGenerator.tsx (main component - 700+ lines)
│   └── styles/
│       └── globals.css (Tailwind directives)
├── tailwind.config.js (new)
├── postcss.config.js (existing)
├── tsconfig.json
├── next.config.js
└── package.json (updated with Tailwind deps)
```

## Next Steps
1. Run `npm install` to install Tailwind CSS and dependencies
2. Start the dev server with `npm run dev`
3. Navigate to `http://localhost:3000`
4. Test all 4 steps of the workflow
5. Customize styling and content as needed
6. Integrate with backend API when ready

## Notes
- All 4 steps use mock data generators that simulate 2-second API calls
- The component is fully self-contained and ready to be integrated into a larger application
- Styling uses only Tailwind CSS utilities (no separate CSS files needed)
- Component is optimized for modern browsers and responsive design

