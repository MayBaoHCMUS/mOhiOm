import { LucideIcon, Home, BookOpen, UserCircle, Settings, ChevronRight, HelpCircle, LogOut, Plus, Star, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { motion } from 'framer-motion';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
          isActive
            ? "text-primary bg-surface-container-lowest shadow-sm"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
        )
      }
    >
      <Icon size={20} className="transition-transform group-hover:scale-110" />
      <span className="font-semibold text-sm">{label}</span>
    </NavLink>
  );
}

export default function SideNavBar() {
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low/50 border-r border-outline-variant/10 flex flex-col p-4 z-[60]">
      <div className="mb-8 px-2 pt-4">
        <h1 className="text-xl font-bold tracking-tight text-on-surface">ComicGen AI</h1>
        <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/50 mt-1">Creative Hub</p>
      </div>

      <nav className="flex-1 space-y-1">
        <NavItem to="/dashboard" icon={Home} label="Home" />
        <NavItem to="/projects" icon={BookOpen} label="My Comics" />
        <NavItem to="/characters" icon={UserCircle} label="Character Library" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </nav>

      <div className="mt-auto pt-6 space-y-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
        >
          Upgrade to Pro
        </motion.button>
        
        <div className="flex items-center gap-3 px-2 py-4 border-t border-outline-variant/20">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1587&auto=format&fit=crop"
              alt="Alex Rivera"
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div className="absolute -bottom-1 -right-1 bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              <Star size={10} fill="currentColor" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate">Alex Rivera</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-tight">Free Tier</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
