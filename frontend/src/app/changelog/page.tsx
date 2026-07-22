import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Changelog',
};

interface Entry {
  date: string;
  title: string;
  notes: string[];
}

// Real, dated entries drawn from the project's own commit history — this is
// a running log of what shipped, not marketing copy. Update it as features land.
const ENTRIES: Entry[] = [
  {
    date: 'July 14, 2026',
    title: 'Multi-character "Omni" model, model health checks & notifications',
    notes: [
      'New "Omni" image model for panels with two or more characters — it conditions on several reference images at once, so each character keeps their own look. Pick it in Settings or Story Setup; single-character panels still use the default model.',
      'Model options now show an Online / Offline status, so you can\'t accidentally pick an image server that\'s down and only find out after generating.',
      'Speech and thought bubble tails can now auto-point at the character\'s face — using a face detector tuned for manga/anime art.',
      'Regenerating a single panel now lets you tick exactly which characters are in it, for when auto-detection misses one.',
      'Redesigned the notifications panel: cleaner layout, a "Clear all" that asks for confirmation, and new per-type preferences so you choose which notifications you get (completed actions, warnings, errors).',
    ],
  },
  {
    date: 'July 13, 2026',
    title: 'Character builder redesign & guide bot streaming',
    notes: [
      'Character creation now uses quick-pick pills (gender, style, age, body, hair, eyes, face, skin) instead of long dropdown lists.',
      'The guide bot streams its replies in as it "types", and shares occasional pro-tips plus a dedicated welcome message on the homepage.',
      'Story Setup now opens in Full Setup by default, with a clearer collapsible Creative Direction and Advanced Setup.',
      'Refreshed the sign-in/sign-up pages, fixed broken Privacy Policy/Terms links, and updated both to reflect BYOK and reference-image support.',
    ],
  },
  {
    date: 'July 11, 2026',
    title: 'Guide bot gets more personality',
    notes: [
      'Added a sparkle-burst animation and occasional idle quips to the guide bot launcher.',
      'Improved contextual tip positioning and visibility across studio pages.',
    ],
  },
  {
    date: 'July 7, 2026',
    title: 'Rebrand to mOhiOm',
    notes: [
      'Updated branding across the app.',
      'Improved gallery content loading and character preview.',
      'Cleaned up sidebar labels.',
    ],
  },
  {
    date: 'July 5, 2026',
    title: 'Landing page overhaul',
    notes: [
      'Smooth scrolling, an FAQ accordion, and new About, Services, and Showcase sections.',
    ],
  },
  {
    date: 'July 4, 2026',
    title: 'Faster, more reliable image storage',
    notes: [
      'Migrated generated images to Cloudflare R2 storage.',
      'Added auto-retry for panel generation, with user feedback and the ability to cancel.',
      'Character images now generate sequentially with clearer loading state.',
      'Panels now generate one at a time for steadier reliability on the image server.',
      'Pause now truly stops generation (and Resume picks up where it left off), instead of just changing the label.',
      'Fixed an issue where saving to cloud could remove panels saved in an earlier session.',
    ],
  },
  {
    date: 'July 1–2, 2026',
    title: 'Reference images & provider settings',
    notes: [
      'Added reference-image support to character design.',
      'Project ID is now reflected in the URL, so reloading keeps your place.',
      'Added configurable text-generation provider settings.',
    ],
  },
  {
    date: 'June 29–30, 2026',
    title: 'Print-ready exports & sharing',
    notes: [
      'Added print-ready PDF export with bleed and crop marks.',
      'Added QR code and social-media sharing packs.',
      'Introduced publish history tracking with live read stats.',
      'Fixed speech-bubble positions drifting between the editor and the exported file.',
      'Fixed occasional export failures caused by image caching.',
    ],
  },
  {
    date: 'June 25–26, 2026',
    title: 'EPUB export & analytics',
    notes: [
      'Added EPUB export (replacing jsPDF with pdf-lib for PDF generation).',
      'New rectangular layout templates.',
      'Introduced a client-side analytics dashboard with event tracking.',
    ],
  },
  {
    date: 'June 20–23, 2026',
    title: 'Dialogue editor & smarter layouts',
    notes: [
      'Shipped the dialogue editor for placing speech and thought bubbles on panels.',
      'Added AI layout suggestions and zoom/pan in the canvas editor.',
    ],
  },
  {
    date: 'June 12–17, 2026',
    title: 'Community Gallery',
    notes: [
      'Comics can now be published and read by others via the Community Gallery and a comic reader modal.',
      'Added character and comic ratings.',
      'Added smart auto-layout for panel composition.',
    ],
  },
  {
    date: 'March 24, 2026',
    title: 'Project kickoff',
    notes: ['First commit — FastAPI backend and Next.js frontend scaffold.'],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <nav className="flex items-center justify-between border-b border-on-surface/5 px-6 py-5 md:px-12">
        <Link href="/">
          <Image src="/images/landing/logo-nav.png" alt="mOhiOm" width={160} height={30} className="h-7 w-auto md:h-8" />
        </Link>
        <Link href="/" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface">
          ← Back to home
        </Link>
      </nav>

      <article className="mx-auto max-w-2xl px-6 py-16 md:px-12">
        <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant">Dev blog</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Changelog</h1>
        <p className="mt-3 text-on-surface-variant">
          What&apos;s shipped, fixed, and changed — in the order it happened.
        </p>

        <ol className="mt-12 space-y-10 border-l border-outline-variant/30 pl-6">
          {ENTRIES.map((entry) => (
            <li key={entry.title} className="relative">
              <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">{entry.date}</p>
              <h2 className="mt-1 text-lg font-bold text-on-surface">{entry.title}</h2>
              <ul className="mt-2 space-y-1.5">
                {entry.notes.map((note) => (
                  <li key={note} className="flex gap-2 text-sm text-on-surface-variant">
                    <span className="mt-2 h-1 w-1 flex-none rounded-full bg-on-surface-variant/50" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>
    </main>
  );
}
