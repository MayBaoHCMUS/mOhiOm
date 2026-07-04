import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Zap, Shield, Play, ChevronRight, PenTool, Layout as LayoutIcon, Wand2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 hide-scrollbar overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full h-20 items-center justify-between px-10 flex z-[100] glass-nav">
        <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Sparkles className="text-on-primary" size={24} strokeWidth={2.5} fill="currentColor" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-on-surface">ComicGen AI</span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <NavLink to="#" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">How it works</NavLink>
          <NavLink to="#" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Features</NavLink>
          <NavLink to="#" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Pricing</NavLink>
          <NavLink to="/dashboard" className="px-8 py-3 bg-on-surface text-surface rounded-full font-bold text-sm hover:scale-105 transition-transform active:scale-95 shadow-lg">Start Creating</NavLink>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-10 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-6 py-2 bg-on-surface/5 rounded-full border border-on-surface/10 mb-8"
        >
          <Zap size={14} className="text-primary" fill="currentColor" />
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-on-surface/50">Next-Gen Comic Engine</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl font-black tracking-tighter text-on-surface mb-8 leading-[0.9]"
        >
          AI-Powered <br />
          <span className="text-primary italic">Storytelling.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl md:text-2xl text-on-surface-variant max-w-3xl mb-12 leading-relaxed"
        >
          Maintain industry-grade character consistency across every panel. 
          Blistering fast AI generation meets the precision of a professional artist.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-6"
        >
          <NavLink to="/dashboard" className="px-12 py-5 bg-primary text-on-primary rounded-full font-black text-lg shadow-xl shadow-primary/30 hover:scale-105 transition-transform active:scale-95 flex items-center gap-3">
            Open Workspace
            <ArrowRight size={22} />
          </NavLink>
          <button className="px-12 py-5 border-2 border-on-surface/10 text-on-surface rounded-full font-black text-lg hover:bg-on-surface/5 transition-colors flex items-center gap-3">
            Watch Demo
            <Play size={20} fill="currentColor" />
          </button>
        </motion.div>

        {/* Hero Visual */}
        <motion.div
           initial={{ opacity: 0, y: 40 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.5, duration: 1 }}
           className="mt-24 w-full aspect-[21/9] bg-surface-container-high rounded-[3rem] overflow-hidden shadow-2xl relative group border border-on-surface/5"
        >
          <img 
            src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2670&auto=format&fit=crop" 
            alt="Product Teaser" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2000ms]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end">
            <div className="text-left">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 block">Featured Preview</span>
              <h4 className="text-2xl font-black text-white">Advanced Canvas Engine v2.0</h4>
            </div>
            <div className="flex gap-4">
              <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest">
                4K Rendering
              </div>
              <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest">
                Latent Consistency
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Bento */}
      <section className="py-32 px-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6 grid-rows-2">
           <div className="lg:col-span-8 bg-surface-container-low p-12 rounded-[2.5rem] border border-on-surface/5 flex flex-col justify-between group hover:border-primary/20 transition-all">
              <div>
                <Wand2 size={42} className="text-primary mb-8" />
                <h3 className="text-4xl font-black text-on-surface tracking-tighter mb-4">Latent Character Engines.</h3>
                <p className="text-lg text-on-surface-variant max-w-md">Lock character visual descriptions into mathematical twins. Never struggle with different seeds again.</p>
              </div>
              <div className="mt-12 flex gap-4">
                 {[1,2,3,4].map(i => (
                   <div key={i} className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md grayscale group-hover:grayscale-0 transition-all duration-700">
                     <img src={`https://i.pravatar.cc/150?u=${i}`} alt="Avatar" />
                   </div>
                 ))}
              </div>
           </div>
           
           <div className="lg:col-span-4 bg-primary p-12 rounded-[2.5rem] text-on-primary flex flex-col justify-between shadow-2xl shadow-primary/20">
              <LayoutIcon size={42} strokeWidth={2.5} />
              <div>
                <h3 className="text-3xl font-black tracking-tighter mb-4">Pro Panel Workflows.</h3>
                <p className="text-on-primary/80 font-bold">Standard layouts are boring. Break the mold with dynamic, liquid gutters.</p>
              </div>
           </div>

           <div className="lg:col-span-4 bg-on-surface p-12 rounded-[2.5rem] text-surface flex flex-col justify-between">
              <Shield size={42} fill="currentColor" />
              <div>
                <h3 className="text-3xl font-black tracking-tighter mb-4">Secure Copyright.</h3>
                <p className="text-surface/60 font-medium">Your characters, your stories, your commercial rights. Guaranteed by blockchain anchoring.</p>
              </div>
           </div>

           <div className="lg:col-span-8 bg-surface-container-high p-12 rounded-[2.5rem] border border-on-surface/5 relative group overflow-hidden">
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                   <PenTool size={42} className="text-on-surface mb-8" />
                   <h3 className="text-4xl font-black text-on-surface tracking-tighter mb-4">Cinematic Storybeats.</h3>
                   <p className="text-lg text-on-surface-variant max-w-md">Input text scripts, get orchestrated comic beats automatically. Gemini handles the heavy lifting.</p>
                </div>
                <button className="self-start text-on-surface font-black text-sm uppercase tracking-widest flex items-center gap-2 mt-12 hover:translate-x-2 transition-transform">
                  Explore Automation
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="absolute right-[-10%] bottom-[-10%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] group-hover:bg-primary/30 transition-colors" />
           </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-48 text-center px-10">
         <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-12">The future of comics <br /> is <span className="text-primary italic">Now.</span></h2>
         <NavLink to="/dashboard" className="inline-flex px-16 py-6 bg-on-surface text-surface rounded-full font-black text-2xl hover:scale-105 transition-transform active:scale-95 shadow-2xl">
           Join the Creative Renaissance
         </NavLink>
         <p className="mt-8 text-on-surface-variant font-bold">Free to start. No credit card required.</p>
      </section>

      {/* Footer */}
      <footer className="py-20 px-10 border-t border-on-surface/5 text-center">
         <div className="flex items-center justify-center gap-2 mb-8 opacity-40 grayscale">
            <div className="w-8 h-8 bg-on-surface rounded-lg" />
            <span className="text-xl font-black tracking-tighter text-on-surface">ComicGen AI</span>
         </div>
         <p className="text-on-surface-variant/50 text-xs font-bold uppercase tracking-widest">© 2026 COMICGEN AI • LONDON • SAN FRANCISCO • TOKYO</p>
      </footer>
    </div>
  );
}
