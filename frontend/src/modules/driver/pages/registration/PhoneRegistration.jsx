import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, ChevronRight, ShieldCheck, Briefcase, UserRound, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    clearDriverRegistrationSession,
    getStoredDriverRegistrationSession,
    saveDriverRegistrationSession,
    sendDriverLoginOtp,
    sendDriverOtp,
} from '../../services/registrationService';

import { useSettings } from '../../../../shared/context/SettingsContext';
import loginBg from '../../../../assets/images/driver-login-bg.png';

const PhoneRegistration = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const storedSession = getStoredDriverRegistrationSession();
    const [phone, setPhone] = useState(() => String(location.state?.phone || storedSession.phone || '').replace(/\D/g, '').slice(-10));
    const [role, setRole] = useState(() => {
        const normalizePortalRole = (value) => {
            const normalized = String(value || '').toLowerCase();
            if (normalized === 'owner') return 'owner';
            if (normalized === 'bus_driver' || normalized === 'bus-driver' || normalized === 'busdriver') return 'bus_driver';
            if (normalized === 'service_center' || normalized === 'service-center' || normalized === 'servicecenter') return 'service_center';
            if (normalized === 'service_center_staff' || normalized === 'service-center-staff' || normalized === 'servicecenterstaff') return 'service_center_staff';
            return 'driver';
        };

        const stateRole = String(location.state?.role || '').toLowerCase();
        if (stateRole) return normalizePortalRole(stateRole);

        const savedRole = String(storedSession.role || '').toLowerCase();
        return normalizePortalRole(savedRole);
    });
    const [agreed, setAgreed] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const phoneCardRef = useRef(null);
    const phoneInputRef = useRef(null);
    const routePrefix = location.pathname.startsWith('/taxi/owner') ? '/taxi/owner' : '/taxi/driver';
    const isLoginPage = location.pathname === `${routePrefix}/login` || location.pathname === `${routePrefix}/login/`;
    const appName = settings.general?.app_name || 'App';
    
    const roleOptions = isLoginPage
        ? [
            { id: 'driver', label: 'Driver', Icon: UserRound },
            { id: 'owner', label: 'Owner', Icon: Briefcase },
            { id: 'bus_driver', label: 'Bus', Icon: ShieldCheck },
            { id: 'service_center', label: 'Center', Icon: Building2 },
            { id: 'service_center_staff', label: 'Staff', Icon: UserRound },
        ]
        : [
            { id: 'driver', label: 'Driver', Icon: UserRound },
            { id: 'owner', label: 'Owner', Icon: Briefcase },
        ];
    
    const modeConfig = useMemo(() => {
        const isOwner = role === 'owner';
        const isBusDriver = role === 'bus_driver';
        const isServiceCenter = role === 'service_center';
        const isServiceCenterStaff = role === 'service_center_staff';

        return {
            badge: isOwner ? 'Enterprise' : isBusDriver ? 'Transit' : isServiceCenter ? 'Operations' : isServiceCenterStaff ? 'Team' : 'Partner',
            title: isLoginPage
                ? `${isOwner ? 'Owner' : isBusDriver ? 'Bus Driver' : isServiceCenter ? 'Service Center' : isServiceCenterStaff ? 'Service Staff' : 'Driver'} Login`
                : `Join ${appName}`,
            subtitle: isLoginPage
                ? `Enter your number to access account.`
                : `Start your journey as a ${isOwner ? 'owner' : isBusDriver ? 'captain' : isServiceCenter ? 'operator' : isServiceCenterStaff ? 'staff' : 'driver'}.`,
            highlight: isOwner ? 'Manage fleet, payouts & drivers.' : isBusDriver ? 'Manage your coach, schedules and seat desk.' : isServiceCenter ? 'Manage your center profile, staff and rental vehicle catalog.' : isServiceCenterStaff ? 'Handle assigned bookings and work queues for your center.' : 'Go online, get trips & earn daily.',
            accentColor: isOwner ? '#1C2833' : isBusDriver ? '#0f3d3e' : isServiceCenter ? '#14342b' : isServiceCenterStaff ? '#1e3a5f' : '#4F46E5',
            Icon: isOwner ? Briefcase : isBusDriver ? ShieldCheck : isServiceCenter ? Building2 : isServiceCenterStaff ? ShieldCheck : UserRound,
        };
    }, [appName, isLoginPage, role]);

    useEffect(() => {
        saveDriverRegistrationSession({
            ...storedSession,
            role,
            phone,
            loginMode: isLoginPage,
        });
    }, [isLoginPage, role, phone]);

    useEffect(() => {
        const scrollPhoneIntoView = () => {
            phoneCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        const focusTimer = window.setTimeout(() => {
            scrollPhoneIntoView();
            phoneInputRef.current?.focus();
        }, 180);

        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', scrollPhoneIntoView);

        return () => {
            window.clearTimeout(focusTimer);
            viewport?.removeEventListener('resize', scrollPhoneIntoView);
        };
    }, []);

    const handleSendOTP = async () => {
        if (phone.length !== 10) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        if (!agreed) {
            setError('Please accept the terms before continuing');
            return;
        }

        setLoading(true);
        setError('');

        try {
            clearDriverRegistrationSession();
            const response = isLoginPage
                ? await sendDriverLoginOtp({ phone, role })
                : await sendDriverOtp({ phone, role });
            const sessionData = response?.data?.session || response?.session || {};
            const nextState = saveDriverRegistrationSession({
                phone,
                role,
                registrationId: sessionData.registrationId || '',
                debugOtp: sessionData.debugOtp || '',
                loginMode: isLoginPage,
            });

            navigate(`${routePrefix}/otp-verify`, {
                state: nextState,
            });
        } catch (err) {
            setError(err?.message || 'Unable to send OTP right now');
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { 
                duration: 0.6, 
                ease: [0.22, 1, 0.36, 1],
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div 
            className="min-h-screen relative bg-slate-50 select-none overflow-x-hidden font-['Inter']"
        >
            <div className="fixed inset-0 z-0">
                <img 
                    src={loginBg} 
                    alt="" 
                    className="w-full h-full object-cover opacity-10 blur-[2px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/40 to-white/90" />
            </div>

            <main className="relative z-10 mx-auto max-w-sm px-5 pt-6 pb-24">
                <motion.header 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4 mb-5 flex flex-col items-center text-center"
                >
                    <div className="flex flex-col items-center gap-3">
                        {settings.general?.logo || settings.customization?.logo ? (
                            <img 
                                src={settings.general?.logo || settings.customization?.logo} 
                                alt={appName} 
                                className="h-8 w-auto object-contain drop-shadow-sm"
                            />
                        ) : (
                            <div className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black tracking-tighter text-white shadow-xl shadow-slate-900/10">
                                {appName}
                            </div>
                        )}
                        <motion.div 
                            variants={itemVariants}
                            className="rounded-full bg-slate-900/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-900/5 w-fit"
                        >
                            {isLoginPage ? 'Secure Portal' : 'Driver Onboarding'}
                        </motion.div>
                    </div>

                    <motion.section 
                        variants={itemVariants}
                        className="space-y-2 flex flex-col items-center"
                    >
                        <div className="flex items-center gap-2.5">
                             <div 
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-xl shadow-slate-900/10"
                                style={{ backgroundColor: modeConfig.accentColor }}
                            >
                                <modeConfig.Icon size={16} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                                {modeConfig.badge}
                            </span>
                        </div>
                        <h1 className="font-['Outfit'] text-[32px] font-black leading-[1.1] tracking-[-0.04em] text-slate-900">
                            {modeConfig.title.split(' ')[0]} <span className="text-slate-400">{modeConfig.title.split(' ').slice(1).join(' ')}</span>
                        </h1>
                        <p className="text-[14px] leading-relaxed text-slate-500 font-bold opacity-80 max-w-[32ch]">
                            {modeConfig.subtitle}
                        </p>
                    </motion.section>
                </motion.header>

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                >
                    <motion.div 
                        variants={itemVariants}
                        className="flex items-center gap-2 mb-4 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar scroll-smooth w-full"
                    >
                        {roleOptions.map((option) => {
                            const active = role === option.id;
                            return (
                                <motion.button
                                    key={option.id}
                                    layout
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setRole(option.id)}
                                    className={`flex-none flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <option.Icon size={14} strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">{option.label}</span>
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    <motion.section 
                        variants={itemVariants}
                        ref={phoneCardRef}
                        className="bg-white rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden"
                        style={{ scrollMarginTop: '20vh' }}
                    >
                        <div className="space-y-4">
                            <div className={`group rounded-2xl border-2 transition-all p-4 ${error ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100 bg-white focus-within:border-slate-900 focus-within:shadow-2xl focus-within:shadow-slate-900/10'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${error ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 group-focus-within:bg-slate-900 group-focus-within:text-white shadow-inner'}`}>
                                        <Phone size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <label className="block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Phone Number</label>
                                        <div className="flex items-center gap-2.5">
                                            <span className="shrink-0 text-[17px] font-black text-slate-400">+91</span>
                                            <input 
                                                ref={phoneInputRef}
                                                type="tel" 
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                autoFocus
                                                maxLength={10}
                                                value={phone}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setPhone(val);
                                                    if (error) setError('');
                                                }}
                                                onFocus={() => phoneCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                                placeholder="00000 00000"
                                                className="w-full border-none bg-transparent p-0 text-[17px] font-black text-slate-900 outline-none focus:ring-0 placeholder:text-slate-200 tracking-[0.05em]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-1 items-start">
                                <div className="relative flex items-center shrink-0 mt-0.5">
                                    <input 
                                        type="checkbox" 
                                        id="terms"
                                        checked={agreed}
                                        onChange={() => setAgreed(!agreed)}
                                        className="peer h-4 w-4 cursor-pointer appearance-none rounded-md border-2 border-slate-100 bg-white transition-all checked:bg-slate-900 checked:border-slate-900"
                                    />
                                    <CheckCircle2 className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} />
                                </div>
                                <label htmlFor="terms" className="text-[10px] font-bold text-slate-400 leading-normal cursor-pointer select-none">
                                    I agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            saveDriverRegistrationSession({
                                                ...storedSession,
                                                role,
                                            });
                                            navigate('/terms', { state: { role, returnTo: location.pathname } });
                                        }}
                                        className="text-slate-900 font-black hover:underline underline-offset-2"
                                    >
                                        Terms
                                    </button>
                                    {' '}and{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            saveDriverRegistrationSession({
                                                ...storedSession,
                                                role,
                                            });
                                            navigate('/privacy', { state: { role, returnTo: location.pathname } });
                                        }}
                                        className="text-slate-900 font-black hover:underline underline-offset-2"
                                    >
                                        Privacy Policy
                                    </button>.
                                </label>
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-2.5 text-[11px] font-bold text-rose-600 flex items-center gap-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.section>

                    <motion.div variants={itemVariants} className="space-y-5">
                        <div className="flex items-center justify-center gap-2.5 py-1.5 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 w-max mx-auto px-3.5 shadow-sm">
                            <Sparkles size={12} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-black tracking-tight text-slate-900 uppercase opacity-60">{modeConfig.highlight}</span>
                        </div>

                        <motion.button 
                            variants={itemVariants}
                            whileHover={{ y: -1 }}
                            onClick={() => navigate(isLoginPage ? `${routePrefix}/reg-phone` : `${routePrefix}/login`)}
                            className="w-full text-[12px] font-black text-slate-400 transition-all py-1 uppercase tracking-widest"
                        >
                            {isLoginPage ? (
                                <>Don't have an account? <span className="text-slate-900 border-b-2 border-slate-900/10 pb-0.5">Register</span></>
                            ) : (
                                <>Already a partner? <span className="text-slate-900 border-b-2 border-slate-900/10 pb-0.5">Sign in</span></>
                            )}
                        </motion.button>
                    </motion.div>
                </motion.div>

                <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
                    <div className="mx-auto max-w-sm">
                        <motion.button 
                            whileHover={{ scale: 1.01, y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={handleSendOTP}
                            disabled={loading || !agreed || phone.length !== 10}
                            className={`group flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[14px] font-black tracking-tight transition-all relative overflow-hidden ${
                                agreed && phone.length === 10 
                                    ? 'bg-slate-900 text-white shadow-[0_15px_30px_rgba(0,0,0,0.15)] active:bg-black' 
                                    : 'pointer-events-none bg-slate-200 text-slate-400 shadow-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 uppercase tracking-widest">Get Verification Code</span>
                                    <ChevronRight size={17} strokeWidth={3} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PhoneRegistration;
