import React from 'react';
import { motion } from 'framer-motion';
import heroImg from '@/assets/landing/hero.png';
import { useSettings } from '../../../shared/context/SettingsContext';

const AuthLayout = ({ children, title, subtitle }) => {
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'App';
  const appLogo = settings.general?.logo || settings.customization?.logo || settings.general?.favicon || '';

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col lg:flex-row font-sans selection:bg-black selection:text-white overflow-x-hidden w-full">
      {/* Left side (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-black">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src={heroImg} 
            alt="Premium Mobility" 
            className="w-full h-full object-cover opacity-60 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/40 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col justify-between p-16">
          <div className="flex items-center gap-3">
            {appLogo ? (
              <img
                src={appLogo}
                alt={`${appName} logo`}
                className="h-11 w-11 rounded-xl object-cover bg-white/95 p-1 shadow-lg shadow-black/20"
              />
            ) : (
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
                <div className="w-5 h-5 bg-black rounded-md"></div>
              </div>
            )}
            <span className="text-2xl font-black tracking-tighter text-white">{appName}</span>
          </div>
          
          <div className="max-w-xl">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <h2 className="text-7xl font-black text-white leading-[1.1] mb-6 tracking-tight">
                Move with <br/><span className="text-white/60">Safety and Style.</span>
              </h2>
              <p className="text-white/70 text-2xl font-medium mb-12 leading-relaxed">
                Experience the next generation of urban mobility with {appName}. Reliable, fast, and always at your service.
              </p>
              
              <div className="flex gap-4">
                <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Global Coverage</p>
                  <p className="text-white font-bold">15,000+ Cities</p>
                </div>
                <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Safe Rides</p>
                  <p className="text-white font-bold">Verified Drivers</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center gap-8 text-white/40 text-[11px] font-bold uppercase tracking-[0.2em]">
            <span>© {appName} 2026</span>
            <span>•</span>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </div>

      {/* Right side (Mobile-first login card) */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 md:p-12 pt-44 lg:pt-12 relative w-full bg-white lg:bg-[#F8F9FB]">
        {/* Mobile Header (Visible only on small screens) */}
        <div className="lg:hidden absolute top-8 left-0 right-0 flex flex-col items-center px-4 text-center">
            {appLogo ? (
              <img
                src={appLogo}
                alt={`${appName} logo`}
                className="h-14 w-14 rounded-2xl object-cover bg-white p-1.5 mb-3 shadow-lg shadow-black/10"
              />
            ) : (
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-black/10">
                <div className="w-5 h-5 bg-white rounded-md"></div>
              </div>
            )}
            <span className="text-2xl font-black tracking-tighter text-black pb-2">{appName}</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[28px] md:rounded-[40px] p-8 md:p-12 shadow-[0_30px_70px_rgba(0,0,0,0.06)] border border-gray-100 lg:mt-0"
        >
          {title && (
            <div className="mb-10 text-center lg:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-gray-500 text-base font-medium mt-4 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          <div className="relative z-10">
            {children}
          </div>
        </motion.div>
        
        {/* Helper footer link */}
        <div className="absolute bottom-8 text-center w-full max-w-md">
            <p className="text-gray-400 text-xs font-bold">
              Need assistance? <a href="/support" className="text-black hover:underline ml-1">Contact Support</a>
            </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
