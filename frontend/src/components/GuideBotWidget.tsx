'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import { useOnboardingContext } from '@/context/OnboardingContext';
import { subscribeWizardStep, type WizardStep } from '@/utils/wizardStepBus';
import { GUIDE_MENUS, ROOT_MENU_ID, resolveMenuId, type QuickReply } from '@/content/guideBotScript';
import SpotlightTour, { type TourStep } from '@/components/onboarding/SpotlightTour';
import ContextualTip from '@/components/onboarding/ContextualTip';
import { PAGE_TOUR_STEPS } from '@/content/pageTourSteps';

const SEEN_STORAGE_KEY = 'mohiom-guidebot-seen';
const POSITION_STORAGE_KEY = 'mohiom-guidebot-position';
const DRAG_CLICK_THRESHOLD = 5;

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

export default function GuideBotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { setWelcomeSeen } = useOnboardingContext();

  const [open, setOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep | null>(null);
  const [menuHistory, setMenuHistory] = useState<string[]>([ROOT_MENU_ID]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasNudged, setHasNudged] = useState(true);
  const [activeTour, setActiveTour] = useState<{ steps: TourStep[]; index: number } | null>(null);
  const [activeTip, setActiveTip] = useState<{
    id: string;
    target: string;
    title: string;
    body: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);

  const constraintsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => subscribeWizardStep(setWizardStep), []);

  useEffect(() => {
    try {
      setHasNudged(window.localStorage.getItem(SEEN_STORAGE_KEY) === 'true');
    } catch {
      setHasNudged(true);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          x.set(parsed.x);
          y.set(parsed.y);
        }
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, [x, y]);

  const persistPosition = () => {
    try {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: x.get(), y: y.get() }));
    } catch {
      // ignore write failures (private browsing, quota, etc.)
    }
  };

  useEffect(() => {
    if (hasNudged) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        window.localStorage.setItem(SEEN_STORAGE_KEY, 'true');
      } catch {
        // ignore write failures (private browsing, quota, etc.)
      }
      setHasNudged(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hasNudged]);

  const resetForContext = () => {
    const menuId = resolveMenuId(pathname ?? '/', wizardStep);
    const menu = GUIDE_MENUS[menuId] ?? GUIDE_MENUS[ROOT_MENU_ID];
    setMenuHistory([menu.id]);
    setMessages([{ id: `greeting-${menu.id}`, from: 'bot', text: menu.greeting }]);
  };

  useEffect(() => {
    resetForContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, wizardStep]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    } else {
      launcherRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const currentMenuId = menuHistory[menuHistory.length - 1];
  const currentMenu = GUIDE_MENUS[currentMenuId] ?? GUIDE_MENUS[ROOT_MENU_ID];

  const handleQuickReply = (reply: QuickReply) => {
    setMessages((prev) => [
      ...prev,
      { id: `${reply.id}-user-${prev.length}`, from: 'user', text: reply.label },
      { id: `${reply.id}-bot-${prev.length}`, from: 'bot', text: reply.response },
    ]);

    if (!reply.action) return;

    if (reply.action.type === 'navigate') {
      router.push(reply.action.href);
    } else if (reply.action.type === 'start-tour') {
      setWelcomeSeen();
      router.push('/studio/dashboard');
    } else if (reply.action.type === 'submenu') {
      const target = GUIDE_MENUS[reply.action.menuId];
      if (target) {
        setMenuHistory((prev) => [...prev, target.id]);
        setMessages((prev) => [...prev, { id: `${target.id}-greeting-${prev.length}`, from: 'bot', text: target.greeting }]);
      }
    } else if (reply.action.type === 'page-tour') {
      const steps = PAGE_TOUR_STEPS[currentMenuId];
      if (steps?.length) {
        setActiveTip(null);
        setActiveTour({ steps, index: 0 });
        setOpen(false);
      }
    } else if (reply.action.type === 'highlight') {
      setActiveTour(null);
      setActiveTip({
        id: `bot-tip-${reply.id}-${Date.now()}`,
        target: reply.action.target,
        title: reply.action.title,
        body: reply.response,
        position: reply.action.position,
      });
    }
  };

  const handleBack = () => {
    if (menuHistory.length <= 1) return;
    const nextHistory = menuHistory.slice(0, -1);
    const menu = GUIDE_MENUS[nextHistory[nextHistory.length - 1]] ?? GUIDE_MENUS[ROOT_MENU_ID];
    setMenuHistory(nextHistory);
    setMessages((prev) => [...prev, { id: `${menu.id}-back-${prev.length}`, from: 'bot', text: menu.greeting }]);
  };

  const handleMainMenu = () => {
    resetForContext();
  };

  const handleLauncherClick = () => {
    if (dragDistanceRef.current > DRAG_CLICK_THRESHOLD) return;
    setOpen((v) => !v);
  };

  return (
    <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        ref={containerRef}
        drag={!open}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => {
          dragDistanceRef.current = 0;
        }}
        onDrag={(_, info) => {
          dragDistanceRef.current += Math.abs(info.delta.x) + Math.abs(info.delta.y);
        }}
        onDragEnd={persistPosition}
        style={{ x, y, bottom: '1.5rem', right: '1.5rem' }}
        className="absolute pointer-events-auto"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-label="mOhiOm guide chat"
              className="absolute bottom-full right-0 mb-3 w-[360px] max-h-[520px] rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant flex-shrink-0">
                {menuHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label="Back"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors flex-shrink-0 -ml-1"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div className="relative w-11 h-11 flex-shrink-0">
                  <Image src="/images/landing/mascot-bot.png" alt="" fill sizes="44px" className="object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-on-surface leading-tight">Mo — mOhiOm Guide</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[11px] text-on-surface-variant">Online</span>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close mOhiOm guide chat"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2 text-[13px] leading-snug ${
                        message.from === 'user'
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 px-4 pb-3 flex-shrink-0">
                {currentMenu.quickReplies.map((reply) => {
                  const Icon = reply.icon;
                  return (
                    <button
                      key={reply.id}
                      type="button"
                      onClick={() => handleQuickReply(reply)}
                      className="flex items-center gap-1.5 rounded-full border border-outline-variant px-3.5 py-2 text-xs font-medium text-on-surface hover:bg-surface-container hover:border-outline transition-colors"
                    >
                      {Icon && <Icon size={13} />}
                      {reply.label}
                    </button>
                  );
                })}
              </div>

              {menuHistory.length > 1 && (
                <div className="border-t border-outline-variant px-4 py-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleMainMenu}
                    className="text-xs text-primary font-semibold hover:opacity-80 transition-opacity"
                  >
                    Main menu
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          ref={launcherRef}
          type="button"
          onClick={handleLauncherClick}
          aria-label={open ? 'Close mOhiOm guide chat' : 'Open mOhiOm guide chat'}
          aria-expanded={open}
          className="relative w-20 h-20 rounded-full shadow-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center hover:scale-105 transition-transform cursor-grab active:cursor-grabbing"
        >
          <div className="relative w-16 h-16">
            <Image src="/images/landing/mascot-bot.png" alt="mOhiOm guide" fill sizes="64px" className="object-contain" />
          </div>
        </button>
      </motion.div>

      {activeTour && (
        <SpotlightTour
          steps={activeTour.steps}
          currentStep={activeTour.index}
          onNext={() =>
            setActiveTour((t) => (t ? { ...t, index: Math.min(t.index + 1, t.steps.length - 1) } : t))
          }
          onPrev={() => setActiveTour((t) => (t ? { ...t, index: Math.max(t.index - 1, 0) } : t))}
          onSkip={() => {
            setActiveTour(null);
            setOpen(true);
          }}
          onComplete={() => {
            setActiveTour(null);
            setOpen(true);
            setMessages((prev) => [
              ...prev,
              { id: `tour-complete-${prev.length}`, from: 'bot', text: "That's everything on this page! Anything else you'd like explained?" },
            ]);
          }}
        />
      )}

      {activeTip && (
        <ContextualTip
          id={activeTip.id}
          target={activeTip.target}
          title={activeTip.title}
          body={activeTip.body}
          position={activeTip.position}
        />
      )}
    </div>
  );
}
