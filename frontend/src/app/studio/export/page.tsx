import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';

const previewPages = [
  {
    title: 'Cover Page',
    index: '01',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAC4q6IruAlr0sg7bOT6prawLzzEfnvyNTUbOOZkRqhkgJtJYwqjVTYbmisR0Fzn2QodSiYX1EW_oBbGHUBFW5aZHf9X9CW7fFSYJ1Sl1z7tzwNHyCWNq_lxCofX6CEK3Ukrzw84F6E9dYoel1FCJctYrEsIIAJ1ZQ2S_v1VwPyjihnSCCgt__71BrhT62QJGwUIhdFaRa64SnGHUIC9gSvMOVCBcQxkXk8BqWWr7ZlBRS4rICLufH5L-Gb8F1hW3fWbjmIXGDWbVE',
  },
  {
    title: 'The Arrival',
    index: '02',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCThBhZQMWXztVGrIzWKG3oxtwNCyKD88Y8Topmo8BIjK0uWKsNnAGlVSArKD9GIAMfzeyq3OCG8Wv9GMq-WmEqub88mcCY0DfPDdPSIQ_TEMGUeeRKiXNRKPgmnw6Swi63VA5Mdas7BklK0iRy8QfJrbmLtyDswDrqD6Hn_LFmXF2FJdT-tGdrtt7sOBESJGYZs0wWpPvLEjUjUpJWKSzHaggn9aYX6RaQrmxA_XGQmYxzEnpRibTw9OS1r24kjyW6LzeY7lCLQ8w',
    grid: true,
  },
  {
    title: 'Cosmic Convergence',
    index: '03',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAut6JEyTJ5CMlPe-HNPBA1UvXwuUEitZ0BTZT3OnRmfUdo-a35Q5L2BRcZzRLf6JJg6N9DNWPqxwLNmWmyBU1ipk_Nqr-zCUK4BrAfDXqSEqACqVCyD3Oo17JcLNJFzqEmJ93tpeZKLji5xp6K3qz1xj6ArHtKZ9PF_vpOa3yHcQaGIBhJqzgvZzdC67B18Jtag_hz3eUbGfyQWTxg5i0nrLXHxtgzxponyVz3ats5gI37ShuojEUSOC0zAyhOzNXf6kYK6jmfPzM',
  },
];

export default function ExportPublishPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <div className="flex h-screen pt-24 ml-[var(--studio-sidebar-width)]">
        <aside className="w-72 shrink-0 bg-surface-container-low flex flex-col gap-2 p-4">
          <div className="px-4 py-6 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center overflow-hidden">
                <img
                  className="w-full h-full object-cover"
                  alt="Export cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvk0TqOcuuhWM4urnHoOrCpPMU_7Ixy_xpqvHl8U0SI2-8gDiQqpMfSOgoTXRj1pfM92Ud9CeRDQNbr3nSlSPtoogQQQcvcJux1UC34lcZ6EHDaJRL5WBuomjVyQTutk_i4nR4W7xBxOHj5Wqdmt5gmfh03e-E0icvvFa4WKmb94QNMEvXz6ZbeQ0QlnAzEg7rDF92F1R9Iv2gKFG27bkHKEz9dyCLZNp4JX4pEQ9Nxqp8m7KmHLOnlVhFpNZ9_PJT7DIhvEr_5lg"
                />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-none">Export Studio</h2>
                <span className="text-[10px] text-on-surface-variant">V1.2 Final Draft</span>
              </div>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {[
              { label: 'Format', icon: 'file_present' },
              { label: 'Quality', icon: 'high_quality' },
              { label: 'Metadata', icon: 'label' },
            ].map((item) => (
              <div key={item.label} className="text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors duration-200 cursor-pointer rounded-lg">
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="leading-relaxed">{item.label}</span>
              </div>
            ))}
            <div className="bg-white text-primary shadow-sm rounded-lg mx-2 px-4 py-3 flex items-center gap-3 transition-colors duration-200 cursor-pointer">
              <span className="material-symbols-outlined">rocket_launch</span>
              <span className="leading-relaxed font-semibold">Distribution</span>
            </div>
          </nav>
          <div className="mt-auto p-2">
            <button className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold shadow-lg shadow-primary/20 scale-95 active:scale-90 transition-all duration-200">
              Batch Export
            </button>
          </div>
        </aside>

        <main className="flex-1 mr-80 overflow-y-auto hide-scrollbar p-12 bg-surface-container-low">
          <div className="max-w-4xl mx-auto space-y-16 pb-32">
            {previewPages.map((page) => (
              <div key={page.index} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.08)] transform hover:-translate-y-1 transition-transform duration-500">
                {page.grid ? (
                  <div className="p-8">
                    <div className="grid grid-cols-2 grid-rows-3 gap-4 aspect-[3/4]">
                      <div className="col-span-2 row-span-1 rounded-lg overflow-hidden relative group">
                        <img className="w-full h-full object-cover" alt="Preview" src={page.image} />
                      </div>
                      <div className="col-span-1 row-span-1 rounded-lg overflow-hidden">
                        <img className="w-full h-full object-cover" alt="Preview" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_EoHF244oUNw6bUrYoQiqNP4iECLfxJypjMKrFP8qgvomsjd6GM_ufq4Cms79IrMr-krHpvwiPla5kSn9ZnhiHfQoA1wfJ7vv74Nz57QFXoeJjkOZq25vAmgbpiA3VzViu5RF_1AjQ_G06HSwcFu7AhjuJl4DOEO0i_Yaft1HdO3f970obnmsQtCoCk7ajtfu2S94EZaUyl43bMNRdtse1mMW8qq64Mak6aYpo5YV62_xWwS7FUHL_r3IwxxuoYRMT3-1U40aeWg" />
                      </div>
                      <div className="col-span-1 row-span-2 rounded-lg overflow-hidden">
                        <img className="w-full h-full object-cover" alt="Preview" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5T-L8Bv6id_1Z8KP5VD_RMp3iNpY1fVDbXy2HFCCu3OKeQ5Xli8_aPZ331tKud3YC44ApXbDus1KZQIcM1XHN0BwjYmnFybPFjnP3kJFd5b7Fjwy2qpV3v8J306wFICm3i2zBWn-7Ibn1iNCNtPiYZ9a4UeRjHP9rlnH4XD3PmKWO5gleuK_ei-wDLN4Cm7hSyPVg4E05thiGXCf-JuOqgRkY7e5IfUZjiuGEkQ1PwxigizsTVBa2NN_BSpF5j-pmuP1eAM2EkPw" />
                      </div>
                      <div className="col-span-1 row-span-1 rounded-lg overflow-hidden">
                        <img className="w-full h-full object-cover" alt="Preview" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdzBuN3RjzM1VOGaNjnmPwhv3X72lTA0AWij7CkVAdbw_EK2bXi9xLkcZGuKOm8JcmgaPLG-M8DLUL41p5HoV7mSQ6VEsNfmXiLJCFj_45FDRF_IUgeuKaiYuhIIErn5aXIxIcU3mM7tEwncnn9MyKUJljm7lpj7K9ap2aXv3vOJ9iA1K0swxnBTcHbrgZAsWxw4K-mL4_-_QPfB1PJmoXbAWMbZGIxaCQyIrMvSKQFeev5UYJhb5NgPP2CfwmGSY5R-FvBQnslxk" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img className="w-full aspect-[3/4] object-cover" alt={page.title} src={page.image} />
                )}
                <div className="p-4 flex justify-between items-center bg-white/60 backdrop-blur-md">
                  <span className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">{page.title}</span>
                  <span className="text-xs text-on-surface-variant">{page.index}</span>
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="fixed right-0 top-0 h-screen w-80 bg-surface-container-lowest pt-24 px-6 border-l border-outline-variant/10 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
          <div className="space-y-8">
            <button className="w-full bg-primary text-on-primary px-6 py-3 rounded-full font-semibold hover:opacity-80 transition-all scale-95 active:scale-90 duration-200">
              Publish
            </button>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight mb-6">Export Settings</h3>
              <div className="space-y-4">
                {['Include Cover Page', 'High Resolution (300 DPI)'].map((label) => (
                  <label key={label} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input checked className="peer h-5 w-5 rounded-md border-outline-variant bg-surface-container-low text-primary focus:ring-primary/20 transition-all cursor-pointer appearance-none border-2 checked:bg-primary checked:border-primary" type="checkbox" readOnly />
                      <span className="material-symbols-outlined absolute text-white scale-0 peer-checked:scale-75 transition-transform pointer-events-none" style={{ fontSize: '16px' }}>
                        check
                      </span>
                    </div>
                    <span className="text-sm font-medium text-on-surface/80 group-hover:text-on-surface transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-6 border-t border-outline-variant/20">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Final Delivery</p>
              {[
                { label: 'Download as PDF', icon: 'picture_as_pdf' },
                { label: 'Download as CBZ', icon: 'folder_zip' },
                { label: 'Export as PNG Images', icon: 'image' },
              ].map((item) => (
                <button key={item.label} className="w-full flex items-center justify-between px-5 py-4 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant rounded-xl font-semibold transition-all group active:scale-[0.98]">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                </button>
              ))}
            </div>
            <div className="pt-8">
              <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
                  <span className="text-xs font-bold text-primary">Pro Tip</span>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  CBZ is the standard for comic readers. Use PDF for easier sharing with printers or casual readers.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed bottom-0 left-[var(--studio-sidebar-width)] right-0 z-[60] bg-white/90 backdrop-blur-xl px-12 py-6 border-t border-outline-variant/10 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex-1 max-w-2xl">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-on-surface-variant">Generating final file...</span>
            <span className="text-sm font-extrabold text-primary">75%</span>
          </div>
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary-container w-[75%] rounded-full shadow-[0_0_10px_rgba(0,88,190,0.3)]"></div>
          </div>
        </div>
        <div className="ml-12 flex gap-4">
          <button className="px-8 py-3 rounded-full text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            Cancel
          </button>
          <button className="px-10 py-3 rounded-full bg-surface-container-highest text-on-surface-variant/50 font-bold text-sm cursor-not-allowed">
            Waiting for Render
          </button>
        </div>
      </div>
    </div>
  );
}
