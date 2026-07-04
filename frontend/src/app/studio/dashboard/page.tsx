'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { projectsApi } from '@/services/api';
import type { CloudProjectListItem, CharacterSummary } from '@/services/api';

// Deterministic gradient per project based on its ID string.
const PROJECT_GRADIENTS = [
  'from-violet-900 via-purple-800 to-indigo-900',
  'from-slate-900 via-blue-900 to-cyan-900',
  'from-rose-900 via-pink-800 to-fuchsia-900',
  'from-amber-900 via-orange-800 to-red-900',
  'from-emerald-900 via-teal-800 to-cyan-900',
  'from-indigo-900 via-violet-800 to-purple-900',
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_GRADIENTS[hash % PROJECT_GRADIENTS.length];
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

function StepBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
      active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'
    }`}>
      {label}
    </span>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden bg-surface-container-lowest animate-pulse">
      <div className="aspect-[16/10] bg-surface-container-high" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-surface-container-high rounded-full w-3/4" />
        <div className="h-3 bg-surface-container-high rounded-full w-1/2" />
      </div>
    </div>
  );
}

function CharacterSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 animate-pulse">
      <div className="w-24 h-24 rounded-full bg-surface-container-high" />
      <div className="h-3 bg-surface-container-high rounded-full w-16" />
    </div>
  );
}

function EmptyProjects() {
  const router = useRouter();
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed border-outline-variant/30">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-4">auto_stories</span>
      <p className="text-on-surface font-semibold text-lg">No saved projects yet</p>
      <p className="text-on-surface-variant text-sm mt-1 mb-6">Complete the pipeline and click &ldquo;Save to Cloud&rdquo; to see them here.</p>
      <button
        onClick={() => router.push('/studio')}
        className="px-6 py-3 bg-primary text-on-primary font-bold rounded-full hover:opacity-90 transition-opacity"
      >
        Start a project
      </button>
    </div>
  );
}

function EmptyCharacters() {
  return (
    <div className="flex flex-col items-center justify-center py-12 w-full rounded-3xl border-2 border-dashed border-outline-variant/30">
      <span className="material-symbols-outlined text-4xl text-outline-variant mb-3">person_off</span>
      <p className="text-on-surface-variant text-sm">No characters yet — save a project with step 2 images to see them here.</p>
    </div>
  );
}

export default function StudioDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingChars, setLoadingChars] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    projectsApi.list()
      .then((r) => setProjects(r.data))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));

    projectsApi.characters()
      .then((r) => setCharacters(r.data))
      .catch(() => {})
      .finally(() => setLoadingChars(false));
  }, []);

  const handleLoadProject = (projectId: string) => {
    router.push(`/studio?project=${encodeURIComponent(projectId)}`);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        JSON.parse(ev.target?.result as string); // validate JSON
        // Store file for studio to pick up, then navigate
        window.localStorage.setItem('mohiom-import-json', ev.target?.result as string);
        router.push('/studio');
      } catch {
        setImportError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const mostRecent = projects[0] ?? null;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />
      <main className="ml-[var(--studio-sidebar-width)] pt-24 px-8 pb-12 min-h-screen">

        {/* Hero banner */}
        <section className="mb-12">
          <div className="bg-surface-container-low rounded-[2rem] p-10 relative overflow-hidden flex items-center">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-4xl font-extrabold text-on-surface mb-4 leading-tight">Welcome back, Storyteller.</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-6">
                {mostRecent
                  ? `Your project "${mostRecent.project_id}" is waiting. Pick up where you left off.`
                  : 'Your latest masterpiece is waiting. Use AI to blend cinematic landscapes with deep character emotions.'}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => mostRecent ? handleLoadProject(mostRecent.project_id) : router.push('/studio')}
                  className="px-6 py-3 bg-white text-primary font-bold rounded-full premium-shadow hover:bg-surface-container-lowest transition-colors"
                >
                  {mostRecent ? 'Resume Last Project' : 'Start a Project'}
                </button>
              </div>
            </div>
            <div className="absolute right-[-10%] top-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute right-[10%] bottom-[-20%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-2xl" />
          </div>
        </section>

        {/* Entry points — 3 clear paths */}
        <section className="mb-12">
          <h3 className="text-lg font-bold text-on-surface mb-4">Start something new</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/studio/story-setup"
              className="group flex flex-col gap-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 p-6 hover:border-primary/30 hover:bg-surface-container-low transition-all ambient-lift"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
              </div>
              <div>
                <p className="font-bold text-on-surface mb-1">Start with my story</p>
                <p className="text-sm text-on-surface-variant leading-snug">Write or paste your narrative and let AI build your comic.</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-primary mt-auto">
                Go to Story Setup
                <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">chevron_right</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => router.push('/studio')}
              className="group flex flex-col gap-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 p-6 hover:border-primary/30 hover:bg-surface-container-low transition-all ambient-lift text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center group-hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">folder_open</span>
              </div>
              <div>
                <p className="font-bold text-on-surface mb-1">Open existing project</p>
                <p className="text-sm text-on-surface-variant leading-snug">Pick up where you left off from your saved cloud projects.</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-on-surface-variant mt-auto group-hover:text-primary transition-colors">
                Browse projects
                <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">chevron_right</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="group flex flex-col gap-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 p-6 hover:border-primary/30 hover:bg-surface-container-low transition-all ambient-lift text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center group-hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">upload_file</span>
              </div>
              <div>
                <p className="font-bold text-on-surface mb-1">Import JSON</p>
                <p className="text-sm text-on-surface-variant leading-snug">Restore a previously exported project from a JSON file.</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-on-surface-variant mt-auto group-hover:text-primary transition-colors">
                Choose file
                <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">chevron_right</span>
              </div>
            </button>
          </div>
          <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />
          {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        </section>

        {/* Recent Projects */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Recent Projects</h3>
              <p className="text-on-surface-variant text-sm mt-1">Pick up where you left off</p>
            </div>
            <button
              onClick={() => router.push('/studio')}
              className="text-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all"
            >
              New project <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingProjects ? (
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            ) : projects.length === 0 ? (
              <EmptyProjects />
            ) : (
              projects.slice(0, 6).map((project) => (
                <div
                  key={project.project_id}
                  className="group bg-surface-container-lowest rounded-3xl overflow-hidden ambient-lift transition-all hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleLoadProject(project.project_id)}
                >
                  {/* Cover — gradient with step badges */}
                  <div className={`aspect-[16/10] relative bg-gradient-to-br ${gradientFor(project.project_id)} flex flex-col justify-between p-5`}>
                    <div className="flex items-center justify-between">
                      {project.genre ? (
                        <span className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                          {project.genre.split('/')[0].split(',')[0].trim()}
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="flex gap-1">
                        <StepBadge label="S1" active={project.has_step1} />
                        <StepBadge label="S2" active={project.has_step2} />
                        <StepBadge label="Img" active={project.has_step2_images} />
                        <StepBadge label="S3" active={project.has_step3} />
                        <StepBadge label="S4" active={project.has_step4} />
                      </div>
                    </div>
                    <p className="text-white/40 text-xs font-mono truncate">{project.project_id}</p>
                  </div>

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-base font-bold truncate pr-2">
                        {project.project_id.replace(/_/g, ' ')}
                      </h4>
                      <span className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors flex-shrink-0">
                        open_in_new
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Last saved {timeAgo(project.saved_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Characters */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Recent Characters</h3>
              <p className="text-on-surface-variant text-sm mt-1">Maintain consistency across panels</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-10">
            {loadingChars ? (
              <>
                <CharacterSkeleton />
                <CharacterSkeleton />
                <CharacterSkeleton />
              </>
            ) : characters.length === 0 ? (
              <EmptyCharacters />
            ) : (
              characters.slice(0, 12).map((char) => (
                <div
                  key={char.character_id}
                  className="flex flex-col items-center group cursor-pointer"
                  title={char.project_id ? `From project: ${char.project_id}` : 'My Library'}
                  onClick={() => char.project_id ? handleLoadProject(char.project_id) : undefined}
                  style={{ cursor: char.project_id ? 'pointer' : 'default' }}
                >
                  <div className="relative mb-3">
                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-primary to-primary-container transition-transform group-hover:rotate-6">
                      {char.selected_image_url ? (
                        <img
                          alt={char.name}
                          src={char.selected_image_url}
                          className="w-full h-full rounded-full object-cover border-2 border-white"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-on-surface text-sm">{char.name}</span>
                  <span className="text-[10px] font-mono text-on-surface-variant/70 mt-1 uppercase tracking-tighter truncate max-w-[96px]">
                    {char.project_id ?? 'My Library'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
