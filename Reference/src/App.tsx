/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import CharacterManager from './pages/CharacterManager';
import CharacterTuning from './pages/CharacterTuning';
import StorySetup from './pages/StorySetup';
import EditorWorkspace from './pages/EditorWorkspace';
import ExportStudio from './pages/ExportStudio';
import LandingPage from './pages/LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/characters" element={<CharacterManager />} />
          <Route path="/characters/:id" element={<CharacterTuning />} />
          <Route path="/stories/new" element={<StorySetup />} />
          <Route path="/editor/:id" element={<EditorWorkspace />} />
          <Route path="/export/:id" element={<ExportStudio />} />
          
          {/* Catch-all redirects */}
          <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
          <Route path="settings" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

