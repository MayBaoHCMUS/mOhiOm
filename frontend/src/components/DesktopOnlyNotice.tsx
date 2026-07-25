import { Monitor } from 'lucide-react';

export default function DesktopOnlyNotice({
  title = 'Switch to a larger screen',
  body = 'This editor needs more room to work with — panels, layers, and tools are easiest to use on a tablet or desktop.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="md:hidden flex flex-col items-center justify-center text-center px-6 py-16 min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Monitor size={28} className="text-primary" />
      </div>
      <h2 className="text-lg font-bold text-on-surface mb-2">{title}</h2>
      <p className="text-sm text-on-surface-variant max-w-xs">{body}</p>
    </div>
  );
}
