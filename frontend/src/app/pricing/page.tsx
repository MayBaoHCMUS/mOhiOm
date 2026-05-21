'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const pricingTiers = [
  {
    name: 'Free',
    label: 'For beginners',
    weeklyPrice: '$0',
    monthlyPrice: '$0',
    accent: 'text-on-surface',
    badge: 'FREE',
    cta: 'Current Plan',
    ctaStyle: 'bg-surface-container-high text-on-surface-variant cursor-default',
    features: ['10 pages/wk', 'Standard res', 'Basic NLP', 'Watermark'],
  },
  {
    name: 'Hobby',
    label: 'For creators',
    weeklyPrice: '$2',
    monthlyPrice: '$5',
    accent: 'text-blue-600',
    badge: 'HOBBY',
    highlight: true,
    cta: 'Upgrade to Hobby',
    ctaStyle: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200',
    features: ['100 pages/mo', 'Character Consistency', 'PDF/CBZ export', 'No watermark'],
  },
  {
    name: 'Pro',
    label: 'For professionals & educators',
    weeklyPrice: '$3',
    monthlyPrice: '$10',
    accent: 'text-on-surface',
    badge: 'PRO',
    cta: 'Upgrade to Pro',
    ctaStyle: 'border-2 border-primary text-primary hover:bg-primary/5',
    features: ['Unlimited pages', 'Priority API', 'Gemini 3 Pro access', '300 DPI export'],
  },
];

const billingHistory = [
  { date: 'May 12, 2024', amount: '$5.00', status: 'Paid' },
  { date: 'April 12, 2024', amount: '$5.00', status: 'Paid' },
  { date: 'March 12, 2024', amount: '$0.00', status: 'Free' },
];

export default function PricingPage() {
  const router = useRouter();
  const [billingCadence, setBillingCadence] = useState<'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 py-10 text-on-surface">
      <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-xl bg-surface">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-lowest text-on-surface transition-transform hover:scale-105"
          aria-label="Close pricing"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
        <div className="max-h-[88vh] overflow-y-auto px-6 pb-12 pt-10 md:px-10">
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-lowest p-1 text-xs font-semibold text-on-surface-variant">
              <button
                type="button"
                onClick={() => setBillingCadence('weekly')}
                className={`rounded-full px-4 py-2 transition-transform ${
                  billingCadence === 'weekly' ? 'bg-blue-600 text-white' : 'text-on-surface-variant hover:scale-105'
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setBillingCadence('monthly')}
                className={`rounded-full px-4 py-2 transition-transform ${
                  billingCadence === 'monthly' ? 'bg-blue-600 text-white' : 'text-on-surface-variant hover:scale-105'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="text-center mb-16 mt-10">
            <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-on-surface">
              Choose the perfect plan for your story.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-surface-container-lowest p-8 rounded-2xl flex flex-col transition-all duration-300 ${
                  tier.highlight
                    ? 'hover:scale-[1.05] neon-purple-glow relative border-2 border-blue-500/20'
                    : 'hover:scale-[1.02] hover:border-outline-variant/60 border border-transparent'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-tighter uppercase shadow-xl shadow-blue-200">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 inline-block ${
                      tier.highlight ? 'bg-blue-100 text-blue-700' : 'bg-surface-container'
                    }`}
                  >
                    {tier.badge}
                  </span>
                  <h3 className="text-2xl font-bold mb-2">{tier.label}</h3>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-extrabold ${tier.accent}`}>
                        {billingCadence === 'weekly' ? tier.weeklyPrice : tier.monthlyPrice}
                      </span>
                      <span className="text-on-surface-variant">
                        {billingCadence === 'weekly' ? '/week' : '/month'}
                      </span>
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {billingCadence === 'weekly'
                        ? `Monthly equivalent: ${tier.monthlyPrice}`
                        : `Weekly equivalent: ${tier.weeklyPrice}`}
                    </div>
                  </div>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {tier.features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-3 ${tier.highlight ? 'font-medium' : 'text-on-surface-variant'}`}>
                      <span className={`material-symbols-outlined ${tier.highlight ? 'text-blue-600' : 'text-primary'} text-xl`}>
                        check_circle
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-4 rounded-xl font-bold transition-all scale-100 active:scale-95 ${tier.ctaStyle}`}>
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>

          <section className="bg-surface-container-low rounded-2xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">Billing History</h2>
                <p className="text-on-surface-variant text-sm">Download your previous invoices and manage your receipts.</p>
              </div>
              <button className="bg-surface-container-lowest px-6 py-2.5 rounded-full text-sm font-semibold text-primary shadow-sm hover:shadow-md transition-all">
                Update Billing Info
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30">
                    <th className="pb-4 font-bold text-sm uppercase tracking-widest text-on-surface-variant">Date</th>
                    <th className="pb-4 font-bold text-sm uppercase tracking-widest text-on-surface-variant">Amount</th>
                    <th className="pb-4 font-bold text-sm uppercase tracking-widest text-on-surface-variant">Status</th>
                    <th className="pb-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {billingHistory.map((bill) => (
                    <tr key={bill.date}>
                      <td className="py-6 font-medium">{bill.date}</td>
                      <td className="py-6 font-medium">{bill.amount}</td>
                      <td className="py-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            bill.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-surface-container-highest text-on-surface-variant'
                          }`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-6 text-right">
                        <button className="text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

