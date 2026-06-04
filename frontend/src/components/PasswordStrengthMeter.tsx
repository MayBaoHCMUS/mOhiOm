interface Props {
  password: string;
}

interface Check {
  label: string;
  met: boolean;
}

function getChecks(pw: string): Check[] {
  return [
    { label: 'At least 8 characters',        met: pw.length >= 8 },
    { label: 'Uppercase letter (A–Z)',         met: /[A-Z]/.test(pw) },
    { label: 'Number (0–9)',                   met: /[0-9]/.test(pw) },
    { label: 'Special character (!@#$…)',      met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function getScore(pw: string): number {
  if (pw.length === 0) return 0;
  const checks = getChecks(pw);
  if (!checks[0].met) return 0; // length gate
  return checks.filter((c) => c.met).length; // 1–4
}

const LEVELS = [
  { label: '',        bar: 'bg-outline-variant/40', text: '' },
  { label: 'Weak',   bar: 'bg-red-500',             text: 'text-red-600' },
  { label: 'Fair',   bar: 'bg-orange-400',           text: 'text-orange-500' },
  { label: 'Good',   bar: 'bg-yellow-400',           text: 'text-yellow-600' },
  { label: 'Strong', bar: 'bg-green-500',            text: 'text-green-600' },
];

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const score = getScore(password);
  const checks = getChecks(password);
  const level = LEVELS[score];

  return (
    <div className="space-y-2 pt-1">
      {/* Strength bars */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                score >= i ? level.bar : 'bg-outline-variant/30'
              }`}
            />
          ))}
        </div>
        {level.label && (
          <span className={`text-xs font-bold ${level.text} w-12 text-right`}>
            {level.label}
          </span>
        )}
      </div>

      {/* Checklist */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 text-[11px] transition-colors ${c.met ? 'text-green-600' : 'text-on-surface-variant/60'}`}>
            <span className="material-symbols-outlined text-xs" style={{ fontSize: 13 }}>
              {c.met ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}