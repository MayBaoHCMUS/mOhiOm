import { motion } from 'framer-motion';
import { ChevronRight, Clock, MoreHorizontal, Play, Verified, Star, PlusCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const PROJECTS = [
  {
    id: 1,
    title: 'Midnight in Neo-Tokyo',
    tag: 'Sci-Fi',
    image: 'https://images.unsplash.com/photo-1605142859862-978be7eba909?q=80&w=2670&auto=format&fit=crop',
    lastEdited: '2 hours ago',
  },
  {
    id: 2,
    title: 'The Silent Woods',
    tag: 'Fantasy',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2560&auto=format&fit=crop',
    lastEdited: '5 hours ago',
  },
  {
    id: 3,
    title: 'Case #402: Red Herring',
    tag: 'Noir',
    image: 'https://images.unsplash.com/photo-1502472545332-e24162e3b2ed?q=80&w=2670&auto=format&fit=crop',
    lastEdited: '1 day ago',
  },
];

const CHARACTERS = [
  {
    name: 'Emma',
    seed: '#88219',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1587&auto=format&fit=crop',
    verified: true,
  },
  {
    name: 'Minh',
    seed: '#44012',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1587&auto=format&fit=crop',
    favorite: true,
  },
  {
    name: 'Kael',
    seed: '#12993',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1587&auto=format&fit=crop',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function Dashboard() {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="px-8 py-12 hide-scrollbar"
    >
      {/* Welcome Hero */}
      <motion.section variants={itemVariants} className="mb-12">
        <div className="bg-surface-container-low rounded-[2rem] p-10 relative overflow-hidden flex items-center">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl font-extrabold text-on-surface tracking-tight mb-4 leading-tight">
              Welcome back, Storyteller.
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
              Your latest masterpiece is waiting. Use AI to blend cinematic landscapes with deep character emotions.
            </p>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-white text-primary font-bold rounded-full premium-shadow hover:bg-surface-container-lowest transition-colors">
                Resume Last Project
              </button>
              <button className="px-8 py-3 text-on-surface-variant font-bold hover:text-primary transition-colors">
                View Inspiration
              </button>
            </div>
          </div>
          {/* Abstract background elements */}
          <div className="absolute right-[-5%] top-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute right-[10%] bottom-[-20%] w-[300px] h-[300px] bg-primary-container/10 rounded-full blur-2xl" />
        </div>
      </motion.section>

      {/* Recent Projects */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Recent Projects</h3>
            <p className="text-on-surface-variant text-sm mt-1">Pick up where you left off</p>
          </div>
          <button className="text-primary font-bold text-sm flex items-center gap-1 group">
            View all collections 
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PROJECTS.map((project) => (
            <motion.div
              key={project.id}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="group bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-outline-variant/10"
            >
              <div className="aspect-[16/10] overflow-hidden relative">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {project.tag}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-bold truncate pr-4">{project.title}</h4>
                  <button className="text-on-surface-variant hover:text-primary transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Clock size={14} />
                  Last edited {project.lastEdited}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Saved Characters */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Saved Characters</h3>
            <p className="text-on-surface-variant text-sm mt-1">Maintain consistency across panels</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-10">
          {CHARACTERS.map((char) => (
            <motion.div
              key={char.name}
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="relative mb-3">
                <div className={cn(
                  "w-24 h-24 rounded-full p-1 transition-transform group-hover:rotate-12",
                  char.verified ? "bg-gradient-to-tr from-primary to-primary-container" : "bg-surface-container-high"
                )}>
                  <img
                    src={char.image}
                    alt={char.name}
                    className="w-full h-full rounded-full object-cover border-4 border-white shadow-sm"
                  />
                </div>
                {char.verified && (
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                    <Verified size={18} className="text-primary" />
                  </div>
                )}
                {char.favorite && (
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                    <Star size={16} className="text-on-surface-variant" />
                  </div>
                )}
              </div>
              <span className="font-bold text-sm">{char.name}</span>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant/50 mt-1 tracking-widest">{char.seed}</span>
            </motion.div>
          ))}
          
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            className="flex flex-col items-center group"
          >
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-outline-variant/50 flex items-center justify-center mb-3 group-hover:bg-surface-container-low transition-colors group-hover:border-primary/50">
              <PlusCircle size={32} className="text-outline-variant group-hover:text-primary transition-colors" />
            </div>
            <span className="font-bold text-sm text-on-surface-variant group-hover:text-primary transition-colors">Add New</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/30 mt-1 tracking-widest">Custom Seed</span>
          </motion.button>
        </div>
      </section>
    </motion.div>
  );
}
