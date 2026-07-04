import Link from 'next/link';

const reportedItems = [
	{
		image:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuAydbjB9vCTeocJQZlVhtxJikLWDJvJH9J0BsjIsSWatLRNizgX2P6rtZvqWftYxFjgmWPuHQYS7o_77YgWtLNAfYi3fa19PTTD6ZvI9ygfUEnZRblk5rsKDXGUSn_N0EbRas69QZ2ybnfOLKVRzCr9JMRmTdLx91uWsFnLsflitEaERfPeYrOjDSwASApVrRc-mkxE0vL2PEHXNHYaz3HyP3VJbsAnkmPh4C6bcZQybfKk_J9J1wcGEtewdxSWAa5B7ZtuPV6uWas',
		user: 'Alex Martinez',
		userId: '98212',
		reason: 'Copyright',
		reasonClass: 'bg-red-100 text-red-700',
		date: 'Oct 24, 2023',
		time: '14:22 PM',
		initials: 'AM',
		avatarClass: 'bg-primary/10 text-primary',
	},
	{
		image:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuCobhCPYE_u9SXTuOWZOZ7L68Jcz3ewi1pk8tyDDzS1dv89f0FAHvN4ayuqOyf7W4LlRiem6E_N0nDAkfaTtH3IWZOsFwcJzBPcOgl0on_jHiSDqVzaw_1azV5r3n5aQFMlDtYNtyyACKFxCVPAxRtqzlrqhULpArraFMUpfKekfD-wCUXxWSaDBRt3m4u6J95gQqL6cGI6TyQGffoC33rGTpQ9vLLrSgOJP3ICN8PLzpy8unZcQ4AVGu1leDFdO9utsTSRwt-jvpQ',
		user: 'Sarah K.',
		userId: '10455',
		reason: 'Harassment',
		reasonClass: 'bg-slate-200 text-slate-700',
		date: 'Oct 24, 2023',
		time: '12:05 PM',
		initials: 'SK',
		avatarClass: 'bg-surface-container-high text-primary',
	},
	{
		image:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuBjZg7gh51v6_ThAs53tKYBPsMy8ZZwEnhJaP4mpkaSzK_5ddF7zLzl3hMkaEYXqHHarpQOniUC7Vjf5e5fGkX_fRCBfjke0cq7_4KH2BNrthp3khY4nYEMtnXlS3eC7KO0LKoWvradnlmM_TgdFauRo3bi8IevRFc2fP1NxHBB-L5G5XCYR1e7lyM7BBucdWJcZrfh_mb1CV1QX2rYeoVeZL43Y3TPJYmZjdv7eZFCk9UQBLE_t2jjG5pk-M1M4CvM6KU7QsH1oCg',
		user: 'James Oliver',
		userId: '88203',
		reason: 'NSFW',
		reasonClass: 'bg-slate-900 text-white',
		date: 'Oct 24, 2023',
		time: '09:45 AM',
		initials: 'JO',
		avatarClass: 'bg-primary/10 text-primary',
	},
];

export default function AdminModerationPage() {
	return (
		<div className="min-h-screen bg-surface text-on-surface">
			<aside className="flex flex-col fixed left-0 top-0 h-full p-4 z-40 w-64 bg-surface-container-low">
				<div className="mb-8 px-4 py-2">
					<h1 className="text-xl font-bold tracking-tighter">Trust &amp; Safety</h1>
					<p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest mt-1">
						Admin Console
					</p>
				</div>
				<nav className="flex-1 space-y-2">
					<Link
						className="flex items-center gap-3 px-4 py-3 text-primary font-semibold bg-white shadow-sm rounded-lg"
						href="/admin/moderation#reported"
					>
						<span className="material-symbols-outlined">gavel</span>
						<span className="text-sm">Reported Content</span>
					</Link>
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/admin/moderation#dmca"
					>
						<span className="material-symbols-outlined">copyright</span>
						<span className="text-sm">DMCA</span>
					</Link>
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/admin/moderation#blocked"
					>
						<span className="material-symbols-outlined">block</span>
						<span className="text-sm">Blocked Keywords</span>
					</Link>
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/admin/moderation#audit"
					>
						<span className="material-symbols-outlined">history</span>
						<span className="text-sm">Audit Logs</span>
					</Link>
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/admin/analytics"
					>
						<span className="material-symbols-outlined">analytics</span>
						<span className="text-sm">Analytics</span>
					</Link>
				</nav>
				<div className="pt-4 border-t border-outline-variant/50 space-y-1">
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/admin/moderation#settings"
					>
						<span className="material-symbols-outlined">settings</span>
						<span className="text-sm">Settings</span>
					</Link>
					<Link
						className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-200 rounded-lg"
						href="/login"
					>
						<span className="material-symbols-outlined">logout</span>
						<span className="text-sm">Logout</span>
					</Link>
				</div>
			</aside>

			<main className="ml-64 min-h-screen">
				<header className="flex items-center justify-between px-8 w-full h-16 sticky top-0 z-50 glass-nav shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
					<div className="flex items-center gap-4">
						<span className="text-lg font-black">ModGuard Admin</span>
					</div>
					<div className="flex items-center gap-6">
						<div className="relative hidden lg:block">
							<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
								search
							</span>
							<input
								className="bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all"
								placeholder="Search moderation logs..."
								type="text"
							/>
						</div>
						<div className="flex items-center gap-4 text-on-surface-variant">
							<button className="hover:opacity-70 transition-opacity">
								<span className="material-symbols-outlined">notifications</span>
							</button>
							<button className="hover:opacity-70 transition-opacity">
								<span className="material-symbols-outlined">help_outline</span>
							</button>
							<div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200">
								<img
									alt="Moderator Profile"
									src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF7EBFxofXHfH4yuUOSfpRHqS9W72_qFXObVT_vgxk4xX3BerBML0twarBg-ubaBPUP4lXasAsRUsbi7awSPCMSkx3RhxTiQ3bX5QOS0QOssMwI0yzlHGrsEJPrmzh0lOvImsf4J3zpBmjCZpdR9Oi16MFywK9nv2roUQdmmFENPHH_4SJsS5hgTg1WU0jgk4_91eYW-FIK7Nhv9-3qqBmigzLYsh2vbEwzP6bj2-vTXVxMpUeYmUlc7Ys66S_JZb20yfyTSnMsSA"
								/>
							</div>
						</div>
					</div>
				</header>

				<div className="p-8 space-y-8">
					<section id="reported">
						<div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="space-y-2">
								<p className="text-xs font-bold uppercase tracking-widest text-primary">
									Keyword Filter Efficiency
								</p>
								<h2 className="text-2xl font-bold tracking-tight text-on-surface">
									150 prompts blocked today for copyright terms
								</h2>
								<p className="text-on-surface-variant text-sm">
									System performance is up 12% compared to the previous 24h window.
								</p>
							</div>
							<div className="flex items-end gap-2 h-16">
								{[
									{ height: 32, className: 'bg-primary/10' },
									{ height: 40, className: 'bg-primary/10' },
									{ height: 24, className: 'bg-primary/10' },
									{ height: 48, className: 'bg-primary/20' },
									{ height: 56, className: 'bg-primary/30' },
									{ height: 40, className: 'bg-primary/40' },
									{ height: 64, className: 'bg-primary/60' },
									{ height: 48, className: 'bg-primary' },
								].map((bar, index) => (
									<div
										key={index}
										className={`w-2 rounded-full ${bar.className}`}
										style={{ height: `${bar.height}px` }}
									></div>
								))}
							</div>
						</div>
					</section>

					<section className="space-y-6">
						<div className="flex items-center justify-between">
							<h3 className="text-xl font-bold tracking-tight text-on-surface">Reported Items</h3>
							<div className="flex gap-2">
								<button className="px-4 py-2 text-sm font-semibold rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors">
									Export CSV
								</button>
								<button className="px-4 py-2 text-sm font-semibold rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
									Bulk Resolve
								</button>
							</div>
						</div>
						<div className="bg-surface-container-lowest rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] overflow-hidden">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-surface-container-low/50">
										<th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
											Image Thumbnail
										</th>
										<th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
											User
										</th>
										<th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
											Report Reason
										</th>
										<th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
											Date
										</th>
										<th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">
											Action
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-surface-container-low">
									{reportedItems.map((item) => (
										<tr
											key={item.userId}
											className="hover:bg-surface-container-low/20 transition-colors"
										>
											<td className="px-6 py-5">
												<div className="h-12 w-12 rounded-lg overflow-hidden bg-slate-100">
													<img
														className="h-full w-full object-cover"
														alt={item.reason}
														src={item.image}
													/>
												</div>
											</td>
											<td className="px-6 py-5">
												<div className="flex items-center gap-3">
													<div
														className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${item.avatarClass}`}
													>
														{item.initials}
													</div>
													<div>
														<p className="text-sm font-bold text-on-surface">
															{item.user}
														</p>
														<p className="text-xs text-on-surface-variant">
															ID: {item.userId}
														</p>
													</div>
												</div>
											</td>
											<td className="px-6 py-5">
												<span
													className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${item.reasonClass}`}
												>
													{item.reason}
												</span>
											</td>
											<td className="px-6 py-5">
												<p className="text-sm text-on-surface-variant">
													{item.date}
												</p>
												<p className="text-[10px] text-slate-400">
													{item.time}
												</p>
											</td>
											<td className="px-6 py-5 text-right">
												<div className="flex items-center justify-end gap-2">
													<button
														className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
														title="Delete Content"
													>
														<span className="material-symbols-outlined text-lg">
															delete
														</span>
													</button>
													<button
														className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
														title="Ban User"
													>
														<span className="material-symbols-outlined text-lg">
															person_off
														</span>
													</button>
													<button
														className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
														title="Dismiss Report"
													>
														<span className="material-symbols-outlined text-lg">
															check_circle
														</span>
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="px-6 py-4 bg-surface-container-low/30 flex items-center justify-between">
								<p className="text-xs text-on-surface-variant">
									Showing 3 of 1,248 reported items
								</p>
								<div className="flex gap-2">
									<button className="p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:shadow-sm transition-all">
										<span className="material-symbols-outlined">chevron_left</span>
									</button>
									<button className="p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:shadow-sm transition-all">
										<span className="material-symbols-outlined">chevron_right</span>
									</button>
								</div>
							</div>
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}

