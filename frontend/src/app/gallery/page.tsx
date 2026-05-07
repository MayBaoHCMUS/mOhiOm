import Link from 'next/link';

const panels = [
  {
    alt: 'Neon Cityscape',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_TDciQhP6QFBJq97kGPikYQCxY3wmkN09Z9PjSf_dxaOSg3CZkzyi7upW8X2s2D0de9Fe9bZpqGaaBscOE_Dm3mf235nhecRUg8-6p7amTfzgszWfGq21XMRNqjGKwZ3-9CHy24jiB6F-e5Y0ORjELlvWhwm938fARtpufusDA-alQLxHejact4995gQJR1Gi_L4cmPlj4VpK6kSxUnuHW-hzf7MA0vRNUvszcknLgDfanbPIJ76rJ46oFIdhiFPDt3s_deNZoVE',
    className: 'w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl shadow-slate-200',
  },
  {
    alt: 'Cybernetic Eye',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANVUoSuB2lYX7NXSSbAq15r6L9hMm_AvHwYoezfmbCpAmTgkUK62MVDRvOLf_rJK9TgjboXBIZ1dWmEw9jA_B89KHP-HRHAyWvjt8vSgyK6ZsR9o3BaFaJfHIvyM-MU49W4gUocdSHoq21HghqbJ2OnIvIpHWHmykUxmKq9X-0zocwIKwXOECyH1pzNXEyAH4OAHAEinhgekIhzAVWN-sTwOM8MUIwWDdn8GGPHlAHrL2L99bFEUfcZ0GUoUoFqWn0c7iXFoUKfNo',
    className: 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-xl shadow-slate-200/60',
  },
  {
    alt: 'Action Sequence',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDHSNe9n6_mOmZ7JNuGPkEMjp3zPXJ6F-FEfSnQkEiYkfOvbx-QBaYS9Zrvje9AprTeCp0CqKkdytux37PepgPPutMV2Ad8CsDR_RoEzCzTsjF5jAwR08uTMoQkr-fFi24NtZN6gGSSiCAEkdj8kVORVX8-bjZ1mYYM-HwHzjKP66uKY_Q8folOEbQGFlnGCAvlj6S3ZG8m6KbT12vYC6vpujnnR7x7pLoCr4J4DTjk3QZVzESiQQXynjin9YBDKuN_ZmVzQCSzufU',
    className: 'w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl shadow-slate-200',
  },
  {
    alt: 'Emotional Portrait',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNylQpElIYmnuIuvzLn-vNbdtYI-a15uilFDX1wNKcy-3aVs0b1OMLeEt6Whcyzrne6O_9FEZCXQ3RrLncM8UCdD0Wrcy9zJvt9jBt2uIlmsf-QcJyNpqwJvBHal6M3eogY-qjyM7YDtT-IxrxCA7T0N5pakwWQF5b0ngC-wDPNsK-pI-p8Z8KH5xloDbdAr_n_MqmMhW6LD91rMrwK-RS8la0PZ330QYmJE46E6ZGbSUlu6EFJWi-ZwSpbAn05MVWt8eI_bnJJQs',
    className: 'w-full max-w-2xl bg-surface-container-lowest rounded-xl overflow-hidden shadow-xl shadow-slate-200',
  },
  {
    alt: 'The Climax',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ8Rem9xyAUOPe21pwzN9k5zADoIT7DUs5xdxbg0gI3QBoVtMUec5w_mE8xrfFyvfHPvFNCsKXQ5puGa5nzI7nD0RjCRwTvWODfuggQiBh6HftZRmmY2bR6xyLr4J-w3BZ0Ji7m-leVnu53fGqR2j_Rkg8erVZECN2B6WqBwyi3Tthlkq_zbiqyXfcQbLxJbDNMA-Zdu1LLEQ2OtMXvzT3bS3TTuc78vAoOLvsS0BMJ4s_tmW9kzCm24KM-H-RdiKchdBLyBSn7Cc',
    className: 'w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl shadow-slate-200',
  },
];

const comments = [
  {
    initials: 'JD',
    name: 'Jordan Dax',
    time: '2 hours ago',
    text: 'The lighting in panel 4 is absolutely incredible. The way the holograms illuminate the face feels so cinematic. Can\'t wait for Part II!',
    likes: 42,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    initials: 'SM',
    name: 'Sarah Miller',
    time: '1 hour ago',
    text: 'Totally agree! The world-building in just 5 panels is top notch.',
    likes: 12,
    color: 'bg-purple-100 text-purple-600',
    isReply: true,
  },
  {
    initials: 'MK',
    name: 'Marcus Knight',
    time: '5 hours ago',
    text: 'That explosion panel... definitely saving that for my wallpaper folder. InkFlow keeps getting better.',
    likes: 89,
    color: 'bg-emerald-100 text-emerald-600',
  },
];

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased selection:bg-primary/10">
      <nav className="glass-nav fixed top-0 w-full z-50 shadow-sm shadow-slate-200/50">
        <div className="flex justify-between items-center px-6 py-3 w-full max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-8">
            <Link className="text-xl font-bold tracking-tighter" href="/">
              InkFlow Gallery
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link className="text-on-surface-variant hover:text-on-surface transition-all duration-300 ease-out hover:opacity-80" href="/gallery">
                Explore
              </Link>
              <Link className="text-on-surface-variant hover:text-on-surface transition-all duration-300 ease-out hover:opacity-80" href="/studio">
                Community
              </Link>
              <Link className="text-on-surface-variant hover:text-on-surface transition-all duration-300 ease-out hover:opacity-80" href="/pricing">
                Series
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="relative w-full max-w-xs group hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Search comics..."
                type="text"
              />
            </div>
            <Link className="bg-primary text-on-primary px-5 py-2 rounded-full font-semibold text-sm transition-transform scale-95 active:scale-90 hover:shadow-lg hover:shadow-primary/20" href="/login">
              Sign in to Create
            </Link>
            <div className="hidden sm:flex items-center gap-3 ml-2">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">notifications</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">person</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-32 px-4 max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-on-surface">Neon Horizon: Part I</h1>
          <div className="flex items-center justify-center gap-3">
            <span className="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-xs font-bold rounded-full tracking-widest uppercase">
              Sci-Fi Manga
            </span>
            <span className="text-outline text-sm">•</span>
            <span className="text-outline text-sm">8 min read</span>
          </div>
        </header>

        <section className="space-y-8 flex flex-col items-center">
          <div className={panels[0].className}>
            <img alt={panels[0].alt} className="w-full h-auto object-cover" src={panels[0].src} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div className={panels[1].className}>
              <img alt={panels[1].alt} className="w-full h-full object-cover" src={panels[1].src} />
            </div>
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-xl shadow-slate-200/60 flex items-center justify-center p-8 bg-gradient-to-br from-white to-surface-container-low">
              <p className="text-2xl font-light italic text-on-surface-variant leading-relaxed text-center">
                &quot;In the heart of the grid, the pulse of humanity was nothing but a ghost in the machine.&quot;
              </p>
            </div>
          </div>
          <div className={panels[2].className}>
            <img alt={panels[2].alt} className="w-full h-auto object-cover" src={panels[2].src} />
          </div>
          <div className={panels[3].className}>
            <img alt={panels[3].alt} className="w-full h-auto object-cover" src={panels[3].src} />
          </div>
          <div className={panels[4].className}>
            <img alt={panels[4].alt} className="w-full h-auto object-cover" src={panels[4].src} />
          </div>
        </section>

        <aside className="fixed right-8 bottom-32 hidden lg:flex flex-col gap-4 z-40">
          <button className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-xl flex items-center justify-center text-on-surface hover:text-red-500 transition-all hover:-translate-y-1 group">
            <span className="material-symbols-outlined text-2xl group-active:scale-125 transition-transform">favorite</span>
          </button>
          <button className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-xl flex items-center justify-center text-on-surface hover:text-primary transition-all hover:-translate-y-1 group">
            <span className="material-symbols-outlined text-2xl">link</span>
          </button>
          <button className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-xl flex items-center justify-center text-on-surface hover:text-primary transition-all hover:-translate-y-1 group">
            <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
          </button>
        </aside>

        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4 px-6 py-3 bg-surface-container-lowest/90 backdrop-blur-xl rounded-full shadow-2xl z-50 border border-outline-variant/20">
          <button className="flex items-center gap-2 text-on-surface font-medium px-2">
            <span className="material-symbols-outlined text-red-500">favorite</span>
            <span className="text-sm">2.4k</span>
          </button>
          <div className="w-px h-6 bg-outline-variant/30 self-center"></div>
          <button className="flex items-center gap-2 text-on-surface font-medium px-2">
            <span className="material-symbols-outlined text-primary">link</span>
            <span className="text-sm">Share</span>
          </button>
          <div className="w-px h-6 bg-outline-variant/30 self-center"></div>
          <button className="flex items-center gap-2 text-on-surface font-medium px-2">
            <span className="material-symbols-outlined">download</span>
          </button>
        </div>

        <section className="mt-24 pt-16 border-t border-outline-variant/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
            <div className="flex items-center gap-4">
              <img
                alt="Alex Rivera"
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/10"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCB6SfEHgTW7Om2CUd7OQeNat-JETVY6hJr4gHzd1hc4_-X0TyyzEG7oiav3iweyLErpu8Rg0VFTXVuE4kwYJo8IhsLcZIDzOMNvmUxDoBk6xSv0vhfX0G60Zd-pMBHopLPHqKKlqXAQmda99cQZ7Swq2-8t--oajCeGECc9qRiBGUuCPlFmRILNLZJF43eyZ_qJ3kOm5pkfsQD0MwW6JeE1T6rKhNgz73SezGRpk4rP-ctbWRKHuBh5QwRh3I1qzW6q6jKPfuYi48"
              />
              <div>
                <h3 className="text-xl font-bold text-on-surface">Alex Rivera</h3>
                <p className="text-sm text-outline">Comic Illustrator &amp; AI Artist</p>
              </div>
              <button className="ml-4 px-6 py-2 bg-primary text-on-primary rounded-full font-semibold text-sm hover:opacity-90 transition-opacity">
                Follow
              </button>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="px-4 py-1.5 bg-surface-container-high rounded-full text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
                Generated with Manga Style Seed #1234
              </div>
              <p className="text-xs text-outline italic">Created via InkFlow Engine v2.4</p>
            </div>
          </div>

          <div className="bg-surface-container-low/50 rounded-3xl p-8 md:p-12">
            <h4 className="text-2xl font-bold mb-8 flex items-center gap-3">
              Comments
              <span className="text-sm font-normal bg-white px-3 py-1 rounded-full shadow-sm text-outline">128</span>
            </h4>
            <div className="relative mb-12">
              <textarea
                className="w-full bg-surface-container-lowest border-none rounded-2xl p-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-shadow shadow-sm min-h-[100px] resize-none"
                placeholder="Add a comment..."
              ></textarea>
              <button className="absolute bottom-4 right-4 bg-primary text-on-primary px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-transform active:scale-95">
                Post
              </button>
            </div>

            <div className="space-y-10">
              {comments.map((comment) => (
                <div key={`${comment.name}-${comment.time}`} className={`flex gap-4 ${comment.isReply ? 'pl-12 border-l-2 border-outline-variant/20' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs ${comment.color}`}>
                    {comment.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-on-surface">{comment.name}</span>
                      <span className="text-xs text-outline">{comment.time}</span>
                    </div>
                    <p className="text-on-surface-variant leading-relaxed">{comment.text}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <button className="flex items-center gap-1.5 text-xs text-outline hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">thumb_up</span> {comment.likes}
                      </button>
                      <button className="text-xs text-outline hover:text-primary transition-colors">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-12 py-4 text-primary font-bold text-sm tracking-wider uppercase hover:bg-white/50 transition-colors rounded-2xl">
              View More Comments
            </button>
          </div>
        </section>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 bg-white/90 backdrop-blur-2xl rounded-t-2xl z-50 shadow-2xl">
        <div className="flex flex-col items-center justify-center text-primary bg-primary/10 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-[11px] font-medium uppercase tracking-widest mt-1">Reader</span>
        </div>
        <div className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">auto_stories</span>
          <span className="text-[11px] font-medium uppercase tracking-widest mt-1">Library</span>
        </div>
        <div className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">search</span>
          <span className="text-[11px] font-medium uppercase tracking-widest mt-1">Search</span>
        </div>
        <div className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[11px] font-medium uppercase tracking-widest mt-1">Settings</span>
        </div>
      </nav>
    </div>
  );
}

