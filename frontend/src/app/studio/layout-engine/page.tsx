import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';

export default function LayoutEnginePage() {
  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen">
      <StudioSidebar />
      <StudioTopBar />
      <div className="min-h-screen flex items-center justify-center p-8 ml-[var(--studio-sidebar-width)] pt-24">
        <div className="bg-surface-container-lowest w-full max-w-sm rounded-xl p-6 shadow-[0_20px_40px_rgba(20,27,43,0.08)] flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-on-surface mb-1">Layout Engine</h3>
            <p className="text-sm text-on-surface-variant">Configure panel dynamics and pacing</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Story Pacing</label>
              <span className="text-sm font-medium text-primary">Medium</span>
            </div>
            <div className="relative w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-[45%] bg-gradient-to-r from-primary to-primary-container rounded-full"></div>
            </div>
            <div className="relative w-full h-0">
              <div className="absolute top-[-10px] left-[45%] w-5 h-5 bg-surface-container-lowest rounded-full shadow-[0_4px_12px_rgba(20,27,43,0.15)] flex items-center justify-center -ml-2.5 cursor-pointer">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant mt-2">
              <span>Slow</span>
              <span>Fast Action</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Grid Style</label>
            <div className="relative">
              <select className="appearance-none w-full bg-surface-container-low text-on-surface text-base font-medium rounded-lg px-4 py-3 border-none focus:ring-0 focus:bg-surface-container-lowest focus:shadow-[0_8px_24px_rgba(20,27,43,0.08)] transition-all cursor-pointer">
                <option>Dynamic</option>
                <option>Standard 4-panel</option>
                <option>Webtoon vertical</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined">forum</span>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-medium text-on-surface">Auto-position Speech Bubbles</span>
                <span className="text-sm text-on-surface-variant">(Face Detection)</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input defaultChecked className="sr-only peer" type="checkbox" />
              <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-br peer-checked:from-primary peer-checked:to-primary-container shadow-inner"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}