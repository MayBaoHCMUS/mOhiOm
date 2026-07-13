import Link from 'next/link';
import Image from 'next/image';
import BackButton from '@/components/BackButton';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <nav className="flex items-center justify-between border-b border-on-surface/5 px-6 py-5 md:px-12">
        <Link href="/">
          <Image src="/images/landing/logo-nav.png" alt="mOhiOm" width={160} height={30} className="h-7 w-auto md:h-8" />
        </Link>
        <BackButton />
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Last updated: July 2026</p>

        <div className="prose-content mt-10 space-y-8 text-on-surface-variant">
          <section>
            <h2 className="text-lg font-bold text-on-surface">1. Using mOhiOm</h2>
            <p className="mt-3">
              mOhiOm is an AI-powered tool for turning written stories into comics. By creating an account, you agree
              to these terms. You&apos;re responsible for keeping your account credentials secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">2. Your content</h2>
            <p className="mt-3">
              You own the story text you write and the comics generated from it. We only store and process it to
              run the service on your behalf — we don&apos;t claim ownership over your creations. If you publish a
              comic or character to the public Gallery, it becomes visible to other users and visitors until you
              unpublish it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">3. Acceptable use</h2>
            <p className="mt-3">Don&apos;t use mOhiOm to generate content that is illegal, infringes on others&apos; rights, or is intended to harass or harm others.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">4. AI-generated content</h2>
            <p className="mt-3">
              Comic scripts and images are generated using third-party AI models (Google Gemini by default for
              text, plus an image-generation service). Generated output can occasionally be inaccurate or
              inconsistent, and remains subject to the underlying model provider&apos;s own usage policies. If you
              configure your own AI provider and API key (BYOK) in Settings, you&apos;re responsible for that
              provider&apos;s terms, usage limits, and any costs you incur — we&apos;re not a party to that
              relationship.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">5. Availability</h2>
            <p className="mt-3">
              mOhiOm is provided as-is, without uptime guarantees. Features and availability may change as the
              project evolves.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">6. Changes to these terms</h2>
            <p className="mt-3">We may update these terms from time to time. Continued use of mOhiOm after a change means you accept the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-on-surface">7. Contact</h2>
            <p className="mt-3">
              Questions about these terms? Reach out at{' '}
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
