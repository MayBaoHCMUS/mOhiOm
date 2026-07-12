import Link from 'next/link';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  Rocket,
  PenLine,
  Users,
  FileText,
  ImagePlus,
  MessageSquare,
  Share2,
  FolderKanban,
  Settings,
  Globe,
  Bot,
} from 'lucide-react';

export const metadata = {
  title: 'Documentation',
};

const TOC = [
  { href: '#getting-started', label: 'Getting started' },
  { href: '#story-setup', label: '1. Story Setup' },
  { href: '#character-design', label: '2. Character Design' },
  { href: '#panel-script', label: '3. Panel Script' },
  { href: '#image-generation', label: '4. Image Generation & Dialogue' },
  { href: '#export-publish', label: '5. Export & Publish' },
  { href: '#character-manager', label: 'Character Manager' },
  { href: '#settings', label: 'Settings (BYOK)' },
  { href: '#gallery', label: 'Gallery & Publish History' },
  { href: '#help', label: 'Getting help' },
];

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} />
        </span>
        <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 pl-12 text-on-surface-variant">{children}</div>
    </section>
  );
}

export default function DocsPage() {
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

      <div className="mx-auto max-w-5xl px-6 py-16 md:px-12">
        <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant">Documentation</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">How mOhiOm works</h1>
        <p className="mt-3 max-w-2xl text-on-surface-variant">
          A guide to turning a written story into a finished comic — from the first paste of text to a published,
          shareable link.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-[200px_1fr]">
          <nav aria-label="Table of contents" className="hidden md:block">
            <ul className="sticky top-16 space-y-2 border-l border-outline-variant/30 pl-4 text-sm">
              {TOC.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className="text-on-surface-variant transition-colors hover:text-primary">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-14">
            <Section id="getting-started" icon={Rocket} title="Getting started">
              <p>
                Create a free account, then head to your <strong className="text-on-surface">Studio dashboard</strong> —
                that&apos;s home base for every project. From there you can start a new comic, resume a saved draft, or
                import a project you exported earlier as JSON.
              </p>
              <p>
                Every comic goes through the same 6-step pipeline: Story Setup → Character Design → Panel Script →
                Image Generation → Dialogue → Export &amp; Publish. You can leave and come back to any project at any
                point — just click <strong className="text-on-surface">Save to Cloud</strong> before you go.
              </p>
            </Section>

            <Section id="story-setup" icon={PenLine} title="1. Story Setup">
              <p>
                Paste or write your story text, then set a project ID and describe the visual style you want (e.g.
                &ldquo;Japanese manga style, detailed, black and white&rdquo;). You can also add special requests —
                constraints like &ldquo;no gore, soft lighting&rdquo; — that apply to every later step.
              </p>
              <p>AI analyzes the story to estimate characters, scene beats, and panel count before you continue.</p>
            </Section>

            <Section id="character-design" icon={Users} title="2. Character Design">
              <p>
                AI generates a design sheet and reference image candidates for each character in your story. Rate,
                regenerate, or approve each one — the approved reference image is what keeps that character looking
                consistent across every panel they appear in later.
              </p>
            </Section>

            <Section id="panel-script" icon={FileText} title="3. Panel Script">
              <p>
                Your story is broken into pages and panels, each with a shot type, dialogue/SFX, and an image prompt.
                Switch between Script, Prompts, Dialogue, or a Compact view, and edit anything before generating
                images — this becomes the blueprint the next step follows.
              </p>
            </Section>

            <Section id="image-generation" icon={ImagePlus} title="4. Image Generation & Dialogue">
              <p>
                Pick a layout template (or let AI suggest one) and generate every panel as an image. Once panels have
                images, switch to the <strong className="text-on-surface">Dialogue</strong> tab to place speech and
                thought bubbles — drag a bubble type onto a panel, or use{' '}
                <MessageSquare size={14} className="inline text-primary" aria-hidden /> Auto-import to pull dialogue
                straight from your panel script.
              </p>
            </Section>

            <Section id="export-publish" icon={Share2} title="5. Export & Publish">
              <p>
                Download your finished comic as a PDF, print-ready PDF, an image ZIP, or an EPUB. Use{' '}
                <strong className="text-on-surface">Save to Cloud</strong> to keep the project itself (not just the
                exported file) so you can reopen and keep editing later.
              </p>
              <p>
                Publishing gives your comic a shareable web-reader link and can optionally list it in the public{' '}
                <Link href="/gallery" className="font-semibold text-primary underline">
                  Gallery
                </Link>
                .
              </p>
            </Section>

            <Section id="character-manager" icon={FolderKanban} title="Character Manager">
              <p>
                Every character you&apos;ve designed is saved to your library, independent of any single project —
                reuse a character across multiple comics, or preview and manage them all in one place from the
                sidebar.
              </p>
            </Section>

            <Section id="settings" icon={Settings} title="Settings — bring your own API key">
              <p>
                By default, text and image generation run on mOhiOm&apos;s built-in models. In{' '}
                <Link href="/settings" className="font-semibold text-primary underline">
                  Settings
                </Link>
                , you can switch either one to your own API key (Gemini or OpenAI) if you&apos;d rather use your own
                provider account and quota.
              </p>
            </Section>

            <Section id="gallery" icon={Globe} title="Gallery & Publish History">
              <p>
                The public Gallery showcases comics the community has chosen to share. Your own{' '}
                <strong className="text-on-surface">Publish History</strong> (linked from Analytics) keeps a log of
                everything you&apos;ve published, with live read counts for each one.
              </p>
            </Section>

            <Section id="help" icon={Bot} title="Getting help">
              <p>
                Every page has a guide bot in the bottom-right corner — click it for page-specific tips, or ask it to
                &ldquo;show me around&rdquo; for a quick walkthrough of what&apos;s on screen.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
