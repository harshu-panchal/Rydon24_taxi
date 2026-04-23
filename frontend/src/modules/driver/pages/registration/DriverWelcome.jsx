import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Wallet, Clock, Star, TrendingUp, Sparkles, UserCheck } from 'lucide-react';
import DriverHero from '@/assets/driver_welcome_hero.png';
import { useSettings } from '@/shared/context/SettingsContext';

const DriverWelcome = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings.general?.app_name || 'App';
    const appLogo = settings.general?.logo || settings.customization?.logo;

    const perks = [
        { icon: <Wallet size={18} />, title: 'Weekly Payouts', sub: 'Receive your earnings directly every week.' },
        { icon: <Clock size={18} />, title: 'Set Your Schedule', sub: 'Ultimate flexibility to drive whenever you want.' },
        { icon: <ShieldCheck size={18} />, title: 'Premium Support', sub: 'Dedicated 24/7 assistance for our partners.' },
        { icon: <TrendingUp size={18} />, title: 'Growth Incentives', sub: 'Earn bonuses for high performance and trips.' }
    ];

    return (
        <div 
            className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] select-none overflow-x-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            {/* Hero Section */}
            <header className="relative h-[42vh] overflow-hidden rounded-b-[40px] shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C2833]/90 via-[#1C2833]/40 to-transparent z-10" />
                <img 
                    src={DriverHero} 
                    alt={`Drive with ${appName}`} 
                    className="w-full h-full object-cover scale-110"
                />
                
                {/* Branding Top Overlay */}
                <div className="absolute top-10 left-6 z-20">
                     {appLogo ? (
                         <img src={appLogo} alt={appName} className="h-8 drop-shadow-sm" />
                     ) : (
                         <span className="text-xl font-bold text-white tracking-tight">{appName}</span>
                     )}
                </div>

                {/* Overlay Greeting */}
                <div className="absolute bottom-10 left-6 right-6 text-white z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="space-y-2"
                    >
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                             <Sparkles size={12} /> Partner Program
                        </div>
                        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.04em]">
                            Drive & <span className="text-amber-400">Earn Daily</span>
                        </h1>
                        <p className="max-w-[28ch] text-[15px] font-medium text-white/70 leading-relaxed">
                            Join the professional network of {appName} partners and take control of your time.
                        </p>
                    </motion.div>
                </div>
            </header>

            {/* Content Section */}
            <main className="px-5 pt-10 pb-32 space-y-10">
                <section className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-900">
                                Partner Benefits
                            </h3>
                            <p className="text-xs font-medium text-slate-500">Why thousands choose {appName}</p>
                        </div>
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm">
                                     <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="partner" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-950 text-[9px] flex items-center justify-center text-white font-bold shadow-sm">
                                +15k
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {perks.map((perk, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                className="flex items-start gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all hover:shadow-xl group"
                            >
                                <div className="mt-1 w-11 h-11 rounded-2xl bg-[#f7efe2] text-[#8a5a22] flex items-center justify-center shrink-0 group-hover:bg-[#8a5a22] group-hover:text-white transition-colors duration-300">
                                    {perk.icon}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[15px] font-semibold text-slate-900 tracking-tight">{perk.title}</h4>
                                    <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{perk.sub}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-[32px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 text-emerald-50 opacity-20">
                       <UserCheck size={80} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Star size={24} fill="currentColor" />
                        </div>
                        <div className="space-y-2">
                             <p className="text-sm font-medium text-slate-500 italic leading-relaxed px-2">
                                "The payouts are always on time and the support team is incredible. This is the best decision I've made."
                             </p>
                             <div className="space-y-0.5">
                                 <h5 className="text-[15px] font-semibold text-slate-900">Arjun Shinde</h5>
                                 <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Verified Partner • 5.0 Rating</p>
                             </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 z-50">
                <div className="mx-auto max-w-sm">
                    <button 
                        onClick={() => navigate('/taxi/driver/lang-select')}
                        className="w-full bg-slate-950 h-14 rounded-[22px] flex items-center justify-center gap-2 text-[15px] font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)] active:scale-95 transition-all"
                    >
                        Apply to Drive <ChevronRight size={18} strokeWidth={2.8} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DriverWelcome;

