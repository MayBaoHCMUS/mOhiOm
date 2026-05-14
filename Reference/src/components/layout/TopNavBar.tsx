import { Search, Bell, HelpCircle, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TopNavBar() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 z-50 glass-nav flex items-center justify-between px-8 w-full shadow-sm">
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center group">
          <Search size={18} className="absolute left-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search your creative universe..."
            className="w-full pl-12 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-on-surface-variant">
          <button className="hover:text-on-surface transition-colors">
            <Bell size={20} />
          </button>
          <button className="hover:text-on-surface transition-colors">
            <HelpCircle size={20} />
          </button>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Create New Comic
        </motion.button>
      </div>
    </header>
  );
}
