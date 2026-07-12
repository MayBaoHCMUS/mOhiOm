import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  Map,
  Wand2,
  Users,
  FileText,
  ImagePlus,
  Download,
  LayoutGrid,
  Settings,
  Compass,
  Images,
} from 'lucide-react';

export type QuickReplyAction =
  | { type: 'navigate'; href: string }
  | { type: 'start-tour' }
  | { type: 'submenu'; menuId: string }
  | { type: 'page-tour' }
  | { type: 'highlight'; target: string; title: string; position?: 'top' | 'bottom' | 'left' | 'right' };

export interface QuickReply {
  id: string;
  label: string;
  response: string;
  icon?: LucideIcon;
  action?: QuickReplyAction;
}

export interface GuideMenu {
  id: string;
  greeting: string[];
  quickReplies: QuickReply[];
}

export const ROOT_MENU_ID = 'root';

export function pickRandom<T>(items: T[], exclude?: T): T {
  const pool = items.length > 1 ? items.filter((item) => item !== exclude) : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const IDLE_QUIPS: string[] = [
  'Need a hand? Click me any time 👋',
  "Psst — I can give you a guided tour if you're stuck.",
  'Curious what mOhiOm can do? Just ask.',
  "Stuck on a step? I've probably got a quick answer.",
  'Want to see example comics? I can take you to the Gallery.',
];

export const GUIDE_MENUS: Record<string, GuideMenu> = {
  [ROOT_MENU_ID]: {
    id: ROOT_MENU_ID,
    greeting: [
      "Hi, I'm Mo — your mOhiOm guide. What do you need help with?",
      "Hey there! I'm Mo. Need a hand finding something?",
    ],
    quickReplies: [
      {
        id: 'what-is-mohiom',
        label: 'What is mOhiOm?',
        icon: Sparkles,
        response:
          'mOhiOm turns a story you write (or paste) into a fully illustrated comic — it analyzes the plot, designs your characters, writes a panel-by-panel script, then generates the artwork.',
      },
      {
        id: 'guided-tour',
        label: 'Take the guided tour',
        icon: Map,
        response: "Let's walk through the studio together — taking you to the dashboard to start the tour.",
        action: { type: 'start-tour' },
      },
      {
        id: 'go-studio',
        label: 'Start a new comic',
        icon: Wand2,
        response: 'Heading to the studio — that\'s where the whole comic pipeline lives.',
        action: { type: 'navigate', href: '/studio' },
      },
    ],
  },
  landing: {
    id: 'landing',
    greeting: [
      'Welcome to mOhiOm! Curious what this app can do for you?',
      "Hi! I'm Mo — want the quick rundown of mOhiOm?",
    ],
    quickReplies: [
      {
        id: 'landing-what-is',
        label: 'What is mOhiOm?',
        icon: Sparkles,
        response:
          'mOhiOm is an AI comic studio: write your story, and it handles story analysis, character design, scripting, and panel art generation for you.',
      },
      {
        id: 'landing-get-started',
        label: 'How do I get started?',
        icon: Wand2,
        response: 'Create an account, then open the Studio — the first screen walks you through pasting in your story.',
        action: { type: 'navigate', href: '/studio' },
      },
      {
        id: 'landing-gallery',
        label: 'See example comics',
        icon: Images,
        response: 'The Gallery has comics other users have published — good for inspiration before you start your own.',
        action: { type: 'navigate', href: '/gallery' },
      },
    ],
  },
  gallery: {
    id: 'gallery',
    greeting: [
      'This is the Gallery — browse comics the community has published.',
      'Welcome to the Gallery! Plenty of comics here for inspiration.',
    ],
    quickReplies: [
      {
        id: 'gallery-how-publish',
        label: 'How do I publish my own?',
        icon: Download,
        response:
          'Finish your comic in the Studio, then use the Export step\'s "Finish & Go to Publish" button — it gets a shareable web-reader link.',
        action: { type: 'navigate', href: '/studio/publish' },
      },
      {
        id: 'gallery-browse',
        label: 'How do I read a comic here?',
        response: 'Click any cover to open it in the reader. Use filters at the top to narrow by genre or style.',
      },
    ],
  },
  settings: {
    id: 'settings',
    greeting: [
      'Settings — manage your account and generation preferences here.',
      "You're in Settings. Anything I can explain here?",
    ],
    quickReplies: [
      {
        id: 'settings-text-provider',
        label: 'What is a text-gen provider?',
        icon: Settings,
        response:
          'It\'s the AI model that writes your story analysis, character bios, and script drafts. mOhiOm defaults to Gemini, but you can plug in your own provider/API key here.',
      },
      {
        id: 'settings-account',
        label: 'Where do I update my account?',
        response: 'Your profile, email, and password options are in the Account section of this page.',
      },
    ],
  },
  'studio-dashboard': {
    id: 'studio-dashboard',
    greeting: [
      'This is your Studio dashboard — your home base for every project.',
      'Welcome back to the dashboard! Ready to start or resume a comic?',
    ],
    quickReplies: [
      {
        id: 'dash-start-new',
        label: 'How do I start a new comic?',
        icon: Wand2,
        response: 'Use "Start with my story" to paste in text, or "Import JSON" to resume a saved project file.',
        action: { type: 'navigate', href: '/studio/story-setup' },
      },
      {
        id: 'dash-recent',
        label: 'What are "Recent Projects"?',
        response: 'Every project you\'ve worked on, with a badge showing which pipeline step it last reached. Click one to jump back in.',
      },
      {
        id: 'dash-sidebar',
        label: 'What do the sidebar sections mean?',
        icon: Compass,
        response:
          'Pre-Production (Story Setup, Character Manager) happens before art generation; Post-Production (Comic Editor, Publish) happens after. Library holds your drafts, gallery uploads, and analytics.',
      },
      {
        id: 'dash-tour',
        label: 'Show me around this page',
        icon: Map,
        response: "Let's walk through the dashboard together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-story-setup': {
    id: 'studio-story-setup',
    greeting: [
      'Story Setup — this is where you shape the raw story before it enters the pipeline.',
      "Let's set up your story — paste your text and pick a style here.",
    ],
    quickReplies: [
      {
        id: 'story-setup-fields',
        label: 'What should I fill in here?',
        icon: FileText,
        response: 'Paste your story text, give the project a name/tags, and describe an art style — those unlock the next step.',
      },
    ],
  },
  'studio-character-manager': {
    id: 'studio-character-manager',
    greeting: [
      'Character Manager — review and reuse character designs across projects.',
      "Here's your character library — reuse designs whenever you like.",
    ],
    quickReplies: [
      {
        id: 'char-manager-reuse',
        label: 'Can I reuse a character in a new comic?',
        icon: Users,
        response: 'Yes — approved characters here can be injected into a new project so you don\'t have to redesign them from scratch.',
      },
    ],
  },
  'studio-editor': {
    id: 'studio-editor',
    greeting: [
      'Comic Editor — fine-tune panels, dialogue, and layout after generation.',
      'In the Comic Editor now — want tips on adjusting a panel?',
    ],
    quickReplies: [
      {
        id: 'editor-dialogue',
        label: 'How do I add speech bubbles?',
        response: 'Select a panel, then use the dialogue tool to place and edit speech/thought bubbles directly on the art.',
      },
    ],
  },
  'studio-publish': {
    id: 'studio-publish',
    greeting: [
      'Publish — share your finished comic with a public link.',
      'Ready to publish? I can walk you through what happens next.',
    ],
    quickReplies: [
      {
        id: 'publish-how',
        label: 'What happens when I publish?',
        icon: Download,
        response: 'Your comic gets a shareable web-reader link and can optionally appear in the public Gallery.',
      },
    ],
  },
  'studio-publish-history': {
    id: 'studio-publish-history',
    greeting: [
      "Publish History — every comic you've shared to the public reader, with live read counts.",
      "This is your publish log — see how many reads each published comic has gotten.",
    ],
    quickReplies: [
      {
        id: 'publish-history-reads',
        label: 'What does "reads" mean?',
        response: 'How many times someone has opened that comic in the public web reader, refreshed live from the server.',
      },
      {
        id: 'publish-history-remove',
        label: 'What does "Remove" do?',
        response: "It only clears the entry from this local log on your device — it doesn't unpublish the comic. Unpublish from the Publish page instead.",
      },
      {
        id: 'publish-history-tour',
        label: 'Show me around this page',
        icon: Map,
        response: "Let's walk through it together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-my-stories': {
    id: 'studio-my-stories',
    greeting: [
      'Story Drafts — every story you\'ve started, saved here automatically.',
      "Here are your saved drafts — pick one up right where you left off.",
    ],
    quickReplies: [
      {
        id: 'drafts-resume',
        label: 'How do I resume a draft?',
        response: 'Click any draft card to reopen it exactly where you left off in the pipeline.',
      },
    ],
  },
  'studio-analytics': {
    id: 'studio-analytics',
    greeting: [
      'Analytics — see how your published comics are performing.',
      "Checking your comic's performance? Here's what these numbers mean.",
    ],
    quickReplies: [
      {
        id: 'analytics-metrics',
        label: 'What do these numbers mean?',
        response: 'Views, reads, and engagement on each comic you\'ve published to the Gallery.',
      },
    ],
  },
  'studio-evaluation': {
    id: 'studio-evaluation',
    greeting: [
      "Evaluation — this is a separate research tool for testing generation settings, not part of the normal comic pipeline.",
      "You're on the Evaluation page — it's used to measure how well different settings keep a character consistent.",
    ],
    quickReplies: [
      {
        id: 'eval-what-is',
        label: 'What is this page for?',
        response: 'It runs controlled tests: Ablation compares character-consistency strength settings, CLIP Score measures how well an image matches its prompt.',
      },
      {
        id: 'eval-ablation',
        label: 'How does the Ablation test work?',
        icon: ImagePlus,
        response: 'Upload a reference image and describe a scene — it generates that same panel at 4 different consistency-strength settings so you can compare which works best.',
        action: { type: 'highlight', target: '[data-tour="eval-run-form"]', title: 'Run Ablation Test' },
      },
      {
        id: 'eval-tour',
        label: 'Show me around this page',
        icon: Map,
        response: "Let's walk through it together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-0': {
    id: 'studio-step-0',
    greeting: [
      'Step 1 of 6 — Setup. Paste your story and set a project name/art style before analysis.',
      "Step 1 of 6 — let's get your story and art style set up.",
    ],
    quickReplies: [
      {
        id: 'step0-required',
        label: 'What do I need to fill in here?',
        icon: FileText,
        response:
          'A project name, your story text, and an art style description (e.g. "Japanese manga style, detailed, black and white") — all three unlock "Generate analysis".',
        action: { type: 'highlight', target: '[data-tour="step0-project-id"]', title: 'Start here' },
      },
      {
        id: 'step0-special',
        label: 'What are "special requests"?',
        response: 'Optional constraints for generation, like "No gore, soft lighting" — they apply across every step of this project.',
        action: { type: 'highlight', target: '[data-tour="step0-special-requests"]', title: 'Special Requests' },
      },
      {
        id: 'step0-tour',
        label: 'Show me around this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-1': {
    id: 'studio-step-1',
    greeting: [
      'Step 2 of 6 — Analysis. Review how your story was broken into structure and character arcs.',
      'Step 2 of 6 — here\'s how the AI broke down your story.',
    ],
    quickReplies: [
      {
        id: 'step1-what-to-do',
        label: 'What do I do on this page?',
        response: 'Read the AI-generated breakdown. If it looks right, approve it to continue; if not, regenerate or retry.',
      },
      {
        id: 'step1-regenerate',
        label: 'What does "Regenerate" do?',
        response: 'Re-runs the analysis from scratch. There\'s a short cooldown between regenerations to avoid runaway requests.',
        action: { type: 'highlight', target: '[data-tour="step1-regenerate"]', title: 'Regenerate' },
      },
      {
        id: 'step1-tour',
        label: 'Show me around this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-2': {
    id: 'studio-step-2',
    greeting: [
      'Step 3 of 6 — Characters. Confirm designs and reference images for your cast.',
      "Step 3 of 6 — let's lock in how your characters look.",
    ],
    quickReplies: [
      {
        id: 'step2-feedback',
        label: 'How do I change a character\'s design?',
        icon: Users,
        response:
          'Use the feedback box under a character (e.g. "make the armor more ornate, darker skin tone") and hit regenerate for that character.',
      },
      {
        id: 'step2-approve',
        label: 'What happens when I approve?',
        response: 'Once every character is approved, this locks in their designs as the reference images used for every panel later on.',
        action: { type: 'highlight', target: '[data-tour="step2-approve-btn"]', title: 'Approve & Continue' },
      },
      {
        id: 'step2-tour',
        label: 'Show me around this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-3': {
    id: 'studio-step-3',
    greeting: [
      'Step 4 of 6 — Script. Review the panel-by-panel breakdown of chapters and pages.',
      'Step 4 of 6 — time to review the panel-by-panel script.',
    ],
    quickReplies: [
      {
        id: 'step3-what-is',
        label: 'What is this script exactly?',
        icon: FileText,
        response: 'Every page is split into panels with a description and dialogue — this is the blueprint image generation will follow.',
      },
      {
        id: 'step3-regenerate',
        label: 'Can I regenerate just one panel?',
        response: 'Not yet — regeneration currently re-runs the whole script. Use feedback in your request to steer it before regenerating.',
      },
      {
        id: 'step3-tour',
        label: 'Show me around this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-4': {
    id: 'studio-step-4',
    greeting: [
      'Step 5 of 6 — Generate. This renders your panels as images — it can take a few minutes.',
      'Step 5 of 6 — generating art now. Grab a coffee, this can take a bit.',
    ],
    quickReplies: [
      {
        id: 'step4-layout',
        label: 'What does the layout picker do?',
        icon: LayoutGrid,
        response: 'It chooses how panels are arranged on each page — pick a template before generating, or let AI suggest one.',
        action: { type: 'highlight', target: '[data-tour="step4-layout-picker"]', title: 'Layout picker' },
      },
      {
        id: 'step4-regen-feedback',
        label: 'How do I fix one panel I don\'t like?',
        icon: ImagePlus,
        response: 'Type feedback like "make the character look angrier, change to night time" next to that panel, then regenerate just it.',
      },
      {
        id: 'step4-tour',
        label: 'Point out the buttons on this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
  'studio-step-5': {
    id: 'studio-step-5',
    greeting: [
      'Step 6 of 6 — Export. Download your comic or publish it to the Gallery.',
      'Step 6 of 6 — last step! Export or publish your finished comic.',
    ],
    quickReplies: [
      {
        id: 'step5-export-options',
        label: 'What can I export to?',
        icon: Download,
        response: 'PDF, print-ready PDF, EPUB, or a ZIP of images — plus "Save to Cloud" to keep the project itself.',
        action: { type: 'highlight', target: '[data-tour="step5-export-options-group"]', title: 'Download formats' },
      },
      {
        id: 'step5-publish',
        label: 'Take me to Publish',
        response: 'On it!',
        action: { type: 'navigate', href: '/studio/publish' },
      },
      {
        id: 'step5-tour',
        label: 'Show me around this step',
        icon: Map,
        response: "Let's walk through this step together.",
        action: { type: 'page-tour' },
      },
    ],
  },
};

const ROUTE_MENU_TABLE: { prefix: string; menuId: string }[] = [
  { prefix: '/studio/dashboard', menuId: 'studio-dashboard' },
  { prefix: '/studio/story-setup', menuId: 'studio-story-setup' },
  { prefix: '/studio/character-manager', menuId: 'studio-character-manager' },
  { prefix: '/studio/editor', menuId: 'studio-editor' },
  // Must come before '/studio/publish' below — '/studio/publish-history'.startsWith('/studio/publish')
  // is true, so a more specific prefix has to be checked first or it never gets reached.
  { prefix: '/studio/publish-history', menuId: 'studio-publish-history' },
  { prefix: '/studio/publish', menuId: 'studio-publish' },
  { prefix: '/studio/my-stories', menuId: 'studio-my-stories' },
  { prefix: '/studio/analytics', menuId: 'studio-analytics' },
  { prefix: '/studio/evaluation', menuId: 'studio-evaluation' },
  { prefix: '/gallery', menuId: 'gallery' },
  { prefix: '/settings', menuId: 'settings' },
];

export function resolveMenuId(pathname: string, wizardStep: number | null): string {
  if (pathname === '/studio') {
    const step = wizardStep ?? 0;
    const menuId = `studio-step-${step}`;
    return GUIDE_MENUS[menuId] ? menuId : ROOT_MENU_ID;
  }

  for (const entry of ROUTE_MENU_TABLE) {
    if (pathname.startsWith(entry.prefix)) return entry.menuId;
  }

  if (pathname === '/') return 'landing';

  return ROOT_MENU_ID;
}
