import Link from 'next/link';
import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer, aside }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed top-0 right-0 left-0 h-16 z-50 glass-nav flex items-center justify-between px-8 w-full shadow-sm">
        <Link href="/" className="flex items-center gap-2 text-on-surface hover:text-primary transition-colors">
          <span className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Sparkles className="text-on-primary" size={20} strokeWidth={2.5} fill="currentColor" />
          </span>
          <span className="text-lg font-black tracking-tighter">ComicGen AI</span>
        </Link>
      </header>

      <main className="flex min-h-screen w-full flex-col md:flex-row pt-16">
        {aside && (
          <section className="hidden md:flex md:w-1/2 relative overflow-hidden items-end p-12">
            {aside}
          </section>
        )}
        <section className="flex-1 flex flex-col items-center justify-center p-8 md:p-20">
          <div className="w-full max-w-[460px] space-y-8">
            <header className="space-y-3">
              <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/70">ComicGen AI</p>
              <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
              <p className="text-on-surface-variant text-base leading-relaxed">{subtitle}</p>
            </header>

            <div className="rounded-[2rem] border border-outline-variant/30 bg-surface-container-lowest p-8 premium-shadow">
              {children}
            </div>

            {footer && <div className="text-sm text-on-surface-variant">{footer}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
