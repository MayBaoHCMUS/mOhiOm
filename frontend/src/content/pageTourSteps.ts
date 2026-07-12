import {
  Wand2,
  FileText,
  FolderOpen,
  UploadCloud,
  Clock,
  Users2,
  Palette,
  MessageSquareWarning,
  RefreshCcw,
  CheckCircle2,
  LayoutGrid,
  ArrowRightCircle,
  CloudUpload,
  Download,
  Images,
  SlidersHorizontal,
  MessageSquare,
  Zap,
  FlaskConical,
  ImagePlus,
  BarChart3,
} from 'lucide-react';
import type { TourStep } from '@/components/onboarding/SpotlightTour';

// Keyed the same way as GUIDE_MENUS in guideBotScript.ts, so lookup is
// PAGE_TOUR_STEPS[currentMenuId]. Every selector below must resolve to an
// element that's actually mounted for that page/step's default state —
// see the per-step notes for assumptions (e.g. step 0 assumes a story has
// already been imported; step 4 only covers the layout tab, since dialogue-
// tab elements aren't mounted until the user switches tabs).
export const PAGE_TOUR_STEPS: Record<string, TourStep[]> = {
  'studio-dashboard': [
    {
      selector: '[data-tour="dashboard-hero-cta"]',
      title: 'Resume or start fresh',
      body: 'Jumps straight back into your most recent project, or starts a brand-new one if you don\'t have any yet.',
      icon: Wand2,
    },
    {
      selector: '[data-tour="dashboard-entry-story"]',
      title: 'Start with my story',
      body: 'The main path: write or paste your story text and let AI build the comic from it.',
      icon: FileText,
    },
    {
      selector: '[data-tour="dashboard-entry-open"]',
      title: 'Open existing project',
      body: 'Browse and reopen any project you\'ve saved to the cloud.',
      icon: FolderOpen,
    },
    {
      selector: '[data-tour="dashboard-entry-import"]',
      title: 'Import JSON',
      body: 'Restore a project you previously exported as a JSON file.',
      icon: UploadCloud,
    },
    {
      selector: '[data-tour="dashboard-recent-projects"]',
      title: 'Recent Projects',
      body: 'Every project you\'ve worked on, with badges showing which pipeline step it last reached — click a card to jump back in.',
      icon: Clock,
    },
    {
      selector: '[data-tour="dashboard-recent-characters"]',
      title: 'Recent Characters',
      body: 'Characters generated across every project, kept here so you can reuse or preview them later.',
      icon: Users2,
    },
  ],

  // Assumes a story has already been imported (these fields only mount in
  // Step1.tsx's "imported" branch).
  'studio-step-0': [
    {
      selector: '[data-tour="step0-project-id"]',
      title: 'Project ID',
      body: 'A short unique name for this project — used in file names and URLs. Required before you can continue.',
      icon: FileText,
    },
    {
      selector: '[data-tour="step0-art-style"]',
      title: 'Art Style Reference',
      body: 'Describe the visual style you want, e.g. "Japanese manga style, detailed, black and white" — also required.',
      icon: Palette,
    },
    {
      selector: '[data-tour="step0-special-requests"]',
      title: 'Special Requests',
      body: 'Optional constraints like "No gore, soft lighting" that apply across every later step of this project.',
      icon: MessageSquareWarning,
    },
  ],

  // Only covers elements mounted once analysis has finished streaming
  // (Step1Analysis.tsx's "post-stream" branch) — Revoke/Retry are
  // conditional on approval/error state and aren't included here.
  'studio-step-1': [
    {
      selector: '[data-tour="step1-regenerate"]',
      title: 'Regenerate',
      body: 'Not happy with the breakdown? Re-run the analysis from scratch (a short cooldown applies between regenerations).',
      icon: RefreshCcw,
    },
    {
      selector: '[data-tour="step1-approve-continue"]',
      title: 'Approve & Continue',
      body: 'Locks in this analysis as the foundation for character design and scripting in the next steps.',
      icon: CheckCircle2,
    },
  ],

  // Points at the always-visible tab switcher and footer controls rather
  // than any individual character card's action row or tab-specific
  // toolbar, since character cards are collapsible and which tab
  // ("Design Sheets" vs "Reference Images") is active by default varies.
  'studio-step-2': [
    {
      selector: '[data-tour="step2-view-references-tab"]',
      title: 'Reference Images',
      body: 'Switch here to see each character\'s generated design candidates, rate them, and regenerate or approve individually.',
      icon: Images,
    },
    {
      selector: '[data-tour="step2-approve-btn"]',
      title: 'Approve & Continue',
      body: 'Once every character is approved, this locks in their designs as reference images and moves you to the script step.',
      icon: CheckCircle2,
    },
  ],

  // Uses the toolbar (always mounted whenever a script exists) rather than
  // the Regenerate button, which unmounts entirely once every page is
  // approved and there's nothing pending to regenerate.
  'studio-step-3': [
    {
      selector: '[data-tour="step3-view-toolbar"]',
      title: 'View & organize',
      body: 'Switch between Script, Prompts, Dialogue, or a Compact view, and collapse/expand everything at once.',
      icon: SlidersHorizontal,
    },
    {
      selector: '[data-tour="step3-approve-continue"]',
      title: 'Approve & Continue',
      body: 'Confirms the script is ready — this becomes the blueprint that image generation follows next.',
      icon: CheckCircle2,
    },
  ],

  // Covers both the Layout and Dialogue tabs of this step. Several targets
  // below only exist while their tab is active — SpotlightTour auto-skips
  // any step whose selector never mounts, so whichever tab the user is on
  // when the tour starts, only the steps relevant to that tab actually
  // display; the other tab's steps just skip past quickly. The tab-switcher
  // button and the bottom "next" button are outside both tabs' content, so
  // they're always mounted and always show regardless of which tab is active.
  // The Generate All Panels button is deliberately excluded — it unmounts
  // entirely once generation is complete, in progress, or paused (replaced
  // by a status message or Pause/Resume button).
  'studio-step-4': [
    {
      selector: '[data-tour="step4-layout-picker"]',
      title: 'Layout Template',
      body: 'Choose how panels are arranged on the page, or let AI suggest a layout for you.',
      icon: LayoutGrid,
    },
    {
      selector: '[data-tour="step4-dialogue-tab"]',
      title: 'Dialogue tab',
      body: 'Switch here once panels have images — add speech and thought bubbles directly on the art.',
      icon: MessageSquare,
    },
    {
      selector: '[data-tour="dialogue-palette"]',
      title: 'Drag to add a bubble',
      body: 'Drag any bubble type onto a panel to place it, then edit the text and styling on the right.',
      icon: MessageSquare,
    },
    {
      selector: '[data-tour="auto-import-btn"]',
      title: 'Auto-import from script',
      body: 'Pulls dialogue straight from your panel script into speech bubbles, so you don\'t have to retype it.',
      icon: Zap,
    },
    {
      selector: '[data-tour="step4-next-btn"]',
      title: 'Go to Dialogue / Continue to Export',
      body: 'Once panels are generated, this moves you to adding dialogue, then on to export.',
      icon: ArrowRightCircle,
    },
  ],

  'studio-step-5': [
    {
      selector: '[data-tour="step5-export-options-group"]',
      title: 'Download formats',
      body: 'Export your comic as a PDF, print-ready PDF, an image ZIP, or an EPUB — pick whichever fits how you\'ll share it.',
      icon: Download,
    },
    {
      selector: '[data-tour="step5-save-cloud"]',
      title: 'Save to Cloud',
      body: 'Keeps the project itself (not just the exported files) so you can reopen and keep editing later.',
      icon: CloudUpload,
    },
    {
      selector: '[data-tour="step5-finish-publish"]',
      title: 'Finish & Go to Publish',
      body: 'Wraps up this step and takes you to Publish, where you can share your comic with a public link.',
      icon: CheckCircle2,
    },
  ],

  // A separate research tool, not part of the wizard — all 4 targets are
  // unconditionally mounted regardless of which tab or data state the page
  // is in (default tab is Ablation; the results card shows a placeholder
  // rather than unmounting when there are no runs yet), so no auto-skip
  // caveats apply here.
  'studio-evaluation': [
    {
      selector: '[data-tour="eval-header"]',
      title: 'Research evaluation tool',
      body: 'A separate tool for testing generation settings with measurable data — not part of the normal comic-creation pipeline.',
      icon: FlaskConical,
    },
    {
      selector: '[data-tour="eval-tab-switcher"]',
      title: 'Ablation vs. CLIP Score',
      body: 'Switch between testing character-consistency strength (Ablation) and prompt-match accuracy (CLIP Score).',
      icon: SlidersHorizontal,
    },
    {
      selector: '[data-tour="eval-run-form"]',
      title: 'Run a test',
      body: 'Upload a reference image and a scene prompt, then run it — it generates the same panel at multiple settings automatically.',
      icon: ImagePlus,
    },
    {
      selector: '[data-tour="eval-results-table"]',
      title: 'Compare results',
      body: 'Every run is logged here with similarity scores, so you can see which setting performs best across multiple tests.',
      icon: BarChart3,
    },
  ],

  // Two targets (title, back button) are always mounted; the summary bar and
  // refresh button only exist once the user has published at least one comic
  // (history.length > 0) — for a brand-new account with no publish history,
  // SpotlightTour's auto-skip fallback silently passes over those two steps.
  'studio-publish-history': [
    {
      selector: '[data-tour="publish-history-title"]',
      title: 'Your publish log',
      body: 'Every comic you\'ve published to the web reader, kept here even after you close the tab.',
      icon: FileText,
    },
    {
      selector: '[data-tour="publish-history-summary"]',
      title: 'Totals at a glance',
      body: 'Total comics published and total reads across all of them, updated live from the server.',
      icon: BarChart3,
    },
    {
      selector: '[data-tour="publish-history-refresh"]',
      title: 'Refresh read counts',
      body: 'Read counts update automatically, but click here anytime to pull the latest numbers on demand.',
      icon: RefreshCcw,
    },
    {
      selector: '[data-tour="publish-history-back"]',
      title: 'Back to Analytics',
      body: 'Jumps back to the Analytics page, which also links here.',
      icon: ArrowRightCircle,
    },
  ],
};
