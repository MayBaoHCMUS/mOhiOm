'use client';

import Link from 'next/link';

type StudioTopBarProps = {
  leftOffset?: boolean;
};

export default function StudioTopBar({ leftOffset = true }: StudioTopBarProps) {
  return (
    <header
      className={`fixed top-0 right-0 ${
        leftOffset ? 'left-[var(--studio-sidebar-width)]' : 'left-0'
      } z-50 glass-nav flex items-center justify-between px-8 h-16 text-on-surface shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}
    >
      <div className="flex-1 max-w-2xl">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-outline">search</span>
          <input
            className="w-full pl-12 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
            placeholder="Search comics, characters, or assets..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link className="text-primary font-semibold text-sm" href="/pricing">
          Pricing
        </Link>
        <div className="h-6 w-px bg-outline-variant/40"></div>
        <button className="hover:opacity-80 transition-opacity" aria-label="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <Link className="hover:opacity-80 transition-opacity" href="/settings" aria-label="Open profile">
          <img
            alt="User avatar"
            className="w-9 h-9 rounded-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1K3JyojfDa09ZT0Jo9CtSiAFvzzeO0elWMvXORRnyXKaiFcpkE-vcHL31HRjVeeRjaVxf_xuui3wHmvTYPVw41Ldbgs-PLn3GDQP7tcj59xvMojLBSTwYtS4qFtt4lxRXnUh5NKbS1G-emVds5iXZoFSQxR0DBV0QsEDmZft4FmvVqWn9Ox6UwpO4Dz-JAZk445jdxSwkFtnr20GE_FfqaQv5dfPl0gs9dxi7TujN5HRuyzabr7Fg6VDLG0RAY6Btoe58s-Nhfcw"
          />
        </Link>
      </div>
    </header>
  );
}