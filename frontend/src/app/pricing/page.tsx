import Link from 'next/link';

const pricingTiers = [
  {
    name: 'Free',
    label: 'For beginners',
    price: '$0',
    accent: 'text-on-surface',
    badge: 'FREE',
    cta: 'Current Plan',
    ctaStyle: 'bg-surface-container-high text-on-surface-variant cursor-default',
    features: ['10 pages/mo', 'Standard res', 'Basic NLP', 'Watermark'],
  },
  {
    name: 'Hobby',
    label: 'For creators',
    price: '$5',
    accent: 'text-purple-600',
    badge: 'HOBBY',
    highlight: true,
    cta: 'Upgrade to Hobby',
    ctaStyle: 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200',
    features: ['100 pages/mo', 'Character Consistency', 'PDF/CBZ export', 'No watermark'],
  },
  {
    name: 'Pro',
    label: 'For professionals & educators',
    price: '$10',
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
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50">
        <div className="flex justify-between items-center px-6 md:px-8 h-20 max-w-7xl mx-auto">
          <Link className="text-xl font-bold tracking-tighter" href="/">
            ComicGen AI
          </Link>
          <div className="hidden md:flex gap-8 items-center">
            <Link className="text-on-surface-variant hover:text-primary transition-colors duration-200" href="/studio">
              Platform
            </Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors duration-200" href="/gallery">
              Features
            </Link>
            <Link className="text-primary font-semibold hover:text-primary transition-colors duration-200" href="/pricing">
              Pricing
            </Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors duration-200" href="/settings">
              Enterprise
            </Link>
          </div>
          <div className="flex gap-3 items-center">
            <Link className="text-on-surface-variant hover:text-on-surface font-medium px-4 py-2 transition-transform scale-95 active:scale-90" href="/login">
              Sign In
            </Link>
            <Link className="bg-primary-container text-on-primary px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-primary/20 transition-transform scale-95 active:scale-90" href="/register">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-on-surface">
              Choose the perfect plan for your story.
            </h1>
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-semibold text-on-surface-variant">Monthly</span>
              <button className="w-14 h-8 bg-surface-container-highest rounded-full p-1 flex items-center transition-colors" type="button">
                <div className="w-6 h-6 bg-primary rounded-full shadow-md"></div>
              </button>
              <span className="text-sm font-semibold text-on-surface-variant">
                Yearly <span className="text-primary ml-1 font-bold">(-20%)</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-surface-container-lowest p-8 rounded-3xl flex flex-col transition-all duration-300 ${
                  tier.highlight
                    ? 'hover:scale-[1.05] neon-purple-glow relative border-2 border-purple-500/20'
                    : 'hover:scale-[1.02]'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-tighter uppercase shadow-xl shadow-purple-200">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 inline-block ${
                      tier.highlight ? 'bg-purple-100 text-purple-700' : 'bg-surface-container'
                    }`}
                  >
                    {tier.badge}
                  </span>
                  <h3 className="text-2xl font-bold mb-2">{tier.label}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${tier.accent}`}>{tier.price}</span>
                    <span className="text-on-surface-variant">/mo</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-10 flex-grow">
                  {tier.features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-3 ${tier.highlight ? 'font-medium' : 'text-on-surface-variant'}`}>
                      <span className={`material-symbols-outlined ${tier.highlight ? 'text-purple-600' : 'text-primary'} text-xl`}>
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

          <section className="bg-surface-container-low rounded-[2rem] p-8 md:p-12">
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
      </main>

      <footer className="w-full py-12 mt-auto bg-surface-container-low">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto w-full border-t border-outline-variant/30 pt-8 text-sm">
          <div className="mb-6 md:mb-0">
            <div className="text-lg font-bold mb-2">ComicGen AI</div>
            <div className="text-on-surface-variant">© 2024 ComicGen AI Technologies. All rights reserved.</div>
          </div>
          <div className="flex gap-6 items-center">
            <Link className="text-on-surface-variant hover:text-on-surface transition-colors" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-on-surface-variant hover:text-on-surface transition-colors" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-on-surface-variant hover:text-on-surface transition-colors" href="/cookies">
              Cookie Policy
            </Link>
            <Link className="text-on-surface-variant hover:text-on-surface transition-colors" href="/security">
              Security
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

