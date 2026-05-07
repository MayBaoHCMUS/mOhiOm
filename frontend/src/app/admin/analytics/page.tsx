import Link from 'next/link';

const metrics = [
	{
		title: 'Total API Calls Today',
		value: '124,582',
		badge: '+12%',
		icon: 'call',
		iconClass: 'bg-primary/10 text-primary',
	},
	{
		title: 'Token Usage (Gemini)',
		value: '42.8M',
		helper: '/ 60M limit',
		badge: '75% Capacity',
		icon: 'token',
		iconClass: 'bg-primary/10 text-primary',
		progress: 75,
	},
	{
		title: 'Estimated Cost ($)',
		value: '$842.50',
		helper: 'Projection: $1,240.00',
		icon: 'payments',
		iconClass: 'bg-surface-container-high text-primary',
	},
	{
		title: 'Active Users',
		value: '15,203',
		icon: 'person',
		iconClass: 'bg-primary/10 text-primary',
	},
];

const systemHealth = [
	{ name: 'Gemini API', detail: 'Operational • 42ms lat' },
	{ name: 'Database', detail: 'Operational • 0% packet loss' },
	{ name: 'Image Gen Worker', detail: 'Operational • 12 active nodes' },
	{ name: 'Payment Gateway', detail: 'Operational • Stripe Connected' },
];

const alerts = [
	{
		title: 'Critical: Rate limit reached for Tier 3',
		time: '2 mins ago • Infrastructure Alert',
		icon: 'error',
		className: 'bg-red-50 border-l-4 border-red-500',
		iconClass: 'text-red-600',
	},
	{
		title: 'Warning: High API usage detected from User ID #1029',
		time: '14 mins ago • Behavioral Monitor',
		icon: 'warning',
		className: 'bg-amber-50 border-l-4 border-amber-400',
		iconClass: 'text-amber-500',
	},
	{
		title: 'Info: Database backup completed',
		time: '1 hour ago • Maintenance System',
		icon: 'info',
		className: 'bg-surface-container-low border-l-4 border-outline-variant',
		iconClass: 'text-on-surface-variant',
	},
];

export default function AdminAnalyticsPage() {
	return (
		<div className="min-h-screen bg-surface text-on-surface">
			<header className="fixed top-0 w-full z-50 glass-nav shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-16 flex items-center justify-between px-6">
				<div className="flex items-center gap-8">
					<Link className="text-xl font-bold tracking-tighter" href="/admin/analytics">
						Aether Intelligence
					</Link>
					<nav className="hidden md:flex gap-6">
						<Link className="text-primary font-semibold border-b-2 border-primary h-16 flex items-center" href="/admin/analytics#overview">
							Dashboard
						</Link>
						<Link className="text-on-surface-variant font-medium hover:text-primary transition-colors h-16 flex items-center" href="/admin/analytics#keys">
							API Keys
						</Link>
						<Link className="text-on-surface-variant font-medium hover:text-primary transition-colors h-16 flex items-center" href="/admin/analytics#monitoring">
							Monitoring
						</Link>
						<Link className="text-on-surface-variant font-medium hover:text-primary transition-colors h-16 flex items-center" href="/admin/analytics#logs">
							Logs
						</Link>
						<Link className="text-on-surface-variant font-medium hover:text-primary transition-colors h-16 flex items-center" href="/admin/analytics#billing">
							Billing
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-4">
					<button className="p-2 text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80">
						<span className="material-symbols-outlined">notifications</span>
					</button>
					<button className="p-2 text-on-surface-variant hover:text-primary transition-all scale-95 active:opacity-80">
						<span className="material-symbols-outlined">settings</span>
					</button>
					<img
						alt="Administrator Profile"
						className="w-8 h-8 rounded-full border border-surface-container-high"
						src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVYfHmCiQ_F-aMHqoEKe6IjpMnHu48l8nkX5ZEYtDF1bMmrxoo3xsneD4ZVCn8oFS3S-tEq4PKG0O25PRVGFLZJOlc0Yc4ZuodLHwzJhvLICQ9AZLZOo3tiZDtpFvZpwwjFcfdDZTRxRdcXlNb6MWfO4zAv4cjG6ACw7SO42HkXIxL6mG0zwbvC_p2gJGt8wn5ARS7SKdkndcBABg7US5cc9t1zpJAZZY3yT0fSWXyE7mBMPiezyfqYXZIt6ohshcf_h81zI5w4Mc"
					/>
				</div>
			</header>

			<aside className="flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] p-4 w-64 bg-surface-container-low hidden md:flex">
				<div className="mb-8 px-2">
					<div className="flex items-center gap-3 mb-1">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
							<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
								neurology
							</span>
						</div>
						<div>
							<p className="font-black text-primary text-sm">Admin Console</p>
							<p className="text-[10px] text-on-surface-variant font-medium">V2.4.0-stable</p>
						</div>
					</div>
				</div>
				<nav className="flex-1 space-y-1">
					<Link className="flex items-center gap-3 px-3 py-2 bg-white text-primary shadow-sm rounded-lg transition-all duration-200" href="/admin/analytics#overview">
						<span className="material-symbols-outlined text-[20px]">dashboard</span>
						<span className="font-medium text-sm">Overview</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#models">
						<span className="material-symbols-outlined text-[20px]">neurology</span>
						<span className="font-medium text-sm">Models</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#deployments">
						<span className="material-symbols-outlined text-[20px]">rocket_launch</span>
						<span className="font-medium text-sm">Deployments</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#rate-limits">
						<span className="material-symbols-outlined text-[20px]">speed</span>
						<span className="font-medium text-sm">Rate Limits</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/moderation">
						<span className="material-symbols-outlined text-[20px]">shield_lock</span>
						<span className="font-medium text-sm">Trust &amp; Safety</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#team">
						<span className="material-symbols-outlined text-[20px]">group</span>
						<span className="font-medium text-sm">Team</span>
					</Link>
				</nav>
				<div className="mt-auto space-y-1">
					<button className="w-full py-2 px-4 mb-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
						Generate API Key
					</button>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#support">
						<span className="material-symbols-outlined text-[20px]">help</span>
						<span className="font-medium text-sm">Support</span>
					</Link>
					<Link className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all duration-200" href="/admin/analytics#docs">
						<span className="material-symbols-outlined text-[20px]">description</span>
						<span className="font-medium text-sm">Documentation</span>
					</Link>
				</div>
			</aside>

			<main className="md:ml-64 pt-24 pb-12 px-6 min-h-screen">
				<header id="overview" className="mb-8">
					<h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Platform Health &amp; Monitoring</h1>
					<p className="text-on-surface-variant">Real-time oversight of infrastructure and usage telemetry.</p>
				</header>

				<section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
					{metrics.map((metric) => (
						<div
							key={metric.title}
							className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] transition-all"
						>
							<div className="flex justify-between items-start mb-4">
								<div className={`w-10 h-10 rounded-full flex items-center justify-center ${metric.iconClass}`}>
									<span className="material-symbols-outlined">{metric.icon}</span>
								</div>
								{metric.badge && (
									<span className="text-xs font-bold bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full">
										{metric.badge}
									</span>
								)}
							</div>
							<p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">{metric.title}</p>
							<h3 className="text-2xl font-bold mt-1">{metric.value}</h3>
							{metric.helper && (
								<p className="text-xs text-on-surface-variant mt-2">{metric.helper}</p>
							)}
							{metric.progress && (
								<div className="w-full bg-surface-container-high h-1.5 rounded-full mt-4 overflow-hidden">
									<div className="bg-primary h-full rounded-full" style={{ width: `${metric.progress}%` }}></div>
								</div>
							)}
						</div>
					))}
				</section>

				<section id="monitoring" className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
					<div className="lg:col-span-8 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
						<div className="flex justify-between items-center mb-10">
							<div>
								<h4 className="text-xl font-bold">API Rate Limits &amp; Queue Status</h4>
								<p className="text-sm text-on-surface-variant">Usage patterns over the last 24 hours</p>
							</div>
							<div className="flex gap-2">
								<div className="flex items-center gap-1.5">
									<span className="w-2 h-2 rounded-full bg-primary"></span>
									<span className="text-xs font-medium text-on-surface-variant">Live Load</span>
								</div>
								<div className="flex items-center gap-1.5 ml-4">
									<span className="w-2 h-2 rounded-full bg-outline-variant"></span>
									<span className="text-xs font-medium text-on-surface-variant">Queue Depth</span>
								</div>
							</div>
						</div>
						<div className="w-full h-64 relative">
							<svg className="w-full h-full" viewBox="0 0 800 200">
								<defs>
									<linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
										<stop offset="5%" stopColor="#2170e4" stopOpacity="0.3"></stop>
										<stop offset="95%" stopColor="#2170e4" stopOpacity="0"></stop>
									</linearGradient>
								</defs>
								<path d="M0,150 Q100,50 200,120 T400,80 T600,150 T800,100 L800,200 L0,200 Z" fill="url(#chartGradient)"></path>
								<path d="M0,150 Q100,50 200,120 T400,80 T600,150 T800,100" fill="none" stroke="#2170e4" strokeWidth="3"></path>
								<path d="M0,180 Q100,160 200,170 T400,165 T600,175 T800,160" fill="none" stroke="#c2c6d6" strokeDasharray="4" strokeWidth="2"></path>
								<circle cx="400" cy="80" fill="#2170e4" r="4"></circle>
							</svg>
							<div className="absolute top-0 left-0 h-full flex flex-col justify-between text-[10px] text-slate-400 font-bold">
								<span>100%</span>
								<span>75%</span>
								<span>50%</span>
								<span>25%</span>
								<span>0%</span>
							</div>
						</div>
					</div>
					<div className="lg:col-span-4 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
						<h4 className="text-xl font-bold mb-2">Images Generated by Tier</h4>
						<p className="text-sm text-on-surface-variant mb-8">Comparing Free vs Pro users</p>
						<div className="space-y-6">
							{[
								{ label: 'Free Tier', value: '42,100', width: '45%', className: 'bg-surface-container-highest' },
								{ label: 'Pro Plus', value: '82,482', width: '85%', className: 'bg-gradient-to-r from-primary to-primary-container' },
								{ label: 'Enterprise', value: '12,200', width: '20%', className: 'bg-surface-container-high' },
							].map((item) => (
								<div key={item.label} className="space-y-2">
									<div className="flex justify-between text-sm font-bold">
										<span>{item.label}</span>
										<span className="text-on-surface-variant">{item.value}</span>
									</div>
									<div className="w-full bg-surface-container-low h-6 rounded-lg overflow-hidden">
										<div className={`${item.className} h-full rounded-r-lg`} style={{ width: item.width }}></div>
									</div>
								</div>
							))}
						</div>
						<div className="mt-10 pt-6 border-t border-surface-container">
							<div className="flex items-center gap-4">
								<div className="flex-1">
									<p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Growth</p>
									<p className="text-lg font-bold text-primary">+28.4%</p>
								</div>
								<div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
									<span className="material-symbols-outlined">trending_up</span>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div className="bg-surface-container-low p-8 rounded-2xl">
						<div className="flex items-center justify-between mb-8">
							<h4 className="text-xl font-bold">System Health</h4>
							<span className="px-3 py-1 bg-surface-container-high text-primary text-xs font-bold rounded-full flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
								ALL SYSTEMS LIVE
							</span>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{systemHealth.map((item) => (
								<div key={item.name} className="bg-surface-container-lowest p-4 rounded-xl flex items-center gap-4 transition-all hover:translate-y-[-2px]">
									<div className="w-3 h-3 rounded-full bg-primary"></div>
									<div>
										<p className="text-sm font-bold">{item.name}</p>
										<p className="text-[10px] text-on-surface-variant">{item.detail}</p>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
						<div className="flex items-center justify-between mb-8">
							<h4 className="text-xl font-bold">Recent Alerts</h4>
							<Link className="text-primary text-xs font-bold hover:underline" href="/admin/analytics#logs">
								View All Logs
							</Link>
						</div>
						<div className="space-y-4">
							{alerts.map((alert) => (
								<div key={alert.title} className={`flex gap-4 p-4 rounded-xl ${alert.className}`}>
									<span className={`material-symbols-outlined ${alert.iconClass}`} style={{ fontVariationSettings: "'FILL' 1" }}>
										{alert.icon}
									</span>
									<div>
										<p className="text-sm font-bold text-on-surface">{alert.title}</p>
										<p className="text-xs text-on-surface-variant">{alert.time}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}

