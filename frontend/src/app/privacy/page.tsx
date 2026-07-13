import Link from 'next/link';
import Image from 'next/image';
import BackButton from '@/components/BackButton';

export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <nav className="flex items-center justify-between border-b border-on-surface/5 px-6 py-5 md:px-12">
        <Link href="/">
          <Image src="/images/landing/logo-nav.png" alt="mOhiOm" width={160} height={30} className="h-7 w-auto md:h-8" />
        </Link>
        <BackButton />
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Last updated: July 2026</p>

        <div className="prose-content mt-10 space-y-8 text-on-surface-variant">
          <section>
            <h2 className="text-lg font-bold text-on-surface">What we collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Account info: email address, name, and password hash if you sign up directly, or your profile info (name, email, avatar) if you sign in with Google or GitHub.</li>
              <li>Content you create: story text, character descriptions, and the comic pages/images generated from them.</li>
              <li>Reference images you choose to upload (e.g. a portrait photo) to guide character-consistent art generation.</li>
              <li>If you enable &quot;Bring Your Own Key&quot; (BYOK) in Settings: the third-party API key you provide, stored encrypted.</li>
              <li>A session cookie used to keep you signed in.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">How we use it</h2>
            <p className="mt-3">
              By default, your story text and prompts are sent to Google&apos;s Gemini API to generate comic scripts,
              and to our image-generation server to produce artwork (including any reference image you upload, used
              only to guide that generation). If you configure your own provider and API key (BYOK) in Settings —
              for text and/or image generation — your content is sent to that third-party provider instead, using
              your own credentials. Generated images are stored on Cloudflare R2 storage; account and project data
              is stored in our database. We use this data only to run the service — to generate, save, and let you
              retrieve your comics.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">Third parties</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><span className="font-semibold text-on-surface">Google Gemini API</span> — processes your story text/prompts to generate scripts and images under our default configuration.</li>
              <li><span className="font-semibold text-on-surface">NineRouter</span> — an LLM routing service we may use in place of Gemini at the infrastructure level; it receives the same story text/prompts a language model needs to respond.</li>
              <li><span className="font-semibold text-on-surface">Your own AI provider (optional)</span> — if you enable BYOK in Settings, your story text and/or image prompts are sent directly to the provider and API key you configure, instead of our defaults.</li>
              <li><span className="font-semibold text-on-surface">Google / GitHub OAuth</span> — used only if you choose to sign in with those providers.</li>
              <li><span className="font-semibold text-on-surface">Resend</span> — sends password-reset emails.</li>
              <li><span className="font-semibold text-on-surface">Cloudflare R2</span> — stores your generated comic images.</li>
            </ul>
            <p className="mt-3">We do not sell your data to anyone.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">Your choices</h2>
            <p className="mt-3">
              You can delete individual projects/comics from within the app. Publishing a comic or character to the
              public Gallery makes it visible to other users and visitors; you can unpublish it at any time from
              within the app. To request full account deletion or a copy of your data, email{' '}
              <a href="mailto:hello@mohiom.me" className="font-semibold text-primary underline">
                hello@mohiom.me
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">Contact</h2>
            <p className="mt-3">
              Questions about this policy? Reach out at{' '}
              <a href="mailto:hello@mohiom.me" className="font-semibold text-primary underline">
                hello@mohiom.me
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
