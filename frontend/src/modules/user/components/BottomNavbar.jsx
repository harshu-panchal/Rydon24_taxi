import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Clock, Map, User } from 'lucide-react';

const navItems = [
  { icon: Home,  label: 'Ride',    path: '/taxi/user'         },
  { icon: Clock, label: 'History', path: '/taxi/user/activity' },
  { icon: Map,   label: 'Travel',  path: '/taxi/user/support'  },
  { icon: User,  label: 'Profile', path: '/taxi/user/profile'  },
];

const BottomNavbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50 px-4 pb-5 pt-2">
      <div className="flex items-center justify-around bg-white/90 backdrop-blur-xl border border-white/80 rounded-[22px] shadow-[0_8px_32px_rgba(15,23,42,0.12)] px-2 py-1.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = pathname === path;
          return (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate(path)}
              className="flex-1 flex flex-col items-center gap-1 py-1 relative"
            >
              {/* Active pill background */}
              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.20)]'
                  : 'bg-transparent'
              }`}>
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-white' : 'text-slate-400'}
                />
              </div>

              {/* Label */}
              <span className={`text-[9px] font-black uppercase tracking-[0.18em] transition-colors duration-200 ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {label}
              </span>

              {/* Active dot */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-orange-500"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavbar;
