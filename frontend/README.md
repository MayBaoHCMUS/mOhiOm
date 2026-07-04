# Frontend - React + Next.js

This is the frontend application built with React and Next.js.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── public/              # Static files
├── src/
│   ├── app/            # App router and layouts
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components (if using pages router)
│   ├── styles/         # Global styles
│   ├── utils/          # Utility functions
│   └── services/       # API services
├── package.json
├── tsconfig.json
├── next.config.js
└── .gitignore
```

## Configuration

Create a `.env.local` file for environment variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

