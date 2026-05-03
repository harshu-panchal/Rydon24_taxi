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
    const isLoginPage = location.pathname === '/taxi/driver/login' || location.pathname === '/taxi/driver/login/';
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
                ? `Enter your registered number to access your account.`
                : `Start your journey as a ${isOwner ? 'fleet owner' : isBusDriver ? 'bus captain' : isServiceCenter ? 'service center operator' : isServiceCenterStaff ? 'service center staff member' : 'professional driver'}.`,
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

            navigate('/taxi/driver/otp-verify', {
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

            <main className="relative z-10 mx-auto max-w-sm px-5 pt-12 pb-32 space-y-8">
                <motion.header 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    <div className="flex items-center justify-between">
                        <motion.div 
                            variants={itemVariants}
                            className="ml-auto rounded-full bg-indigo-50 px-4 py-1.5 text-[11px] font-bold tracking-[0.1em] text-indigo-600 uppercase"
                        >
                            {isLoginPage ? 'Secure Portal' : 'Onboarding'}
                        </motion.div>
                    </div>

                    <motion.section 
                        variants={itemVariants}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2">
                             <div 
                                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
                                style={{ backgroundColor: modeConfig.accentColor }}
                            >
                                <modeConfig.Icon size={24} />
                            </div>
                            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {modeConfig.badge}
                            </span>
                        </div>
                        <h1 className="font-['Outfit'] text-[42px] font-extrabold leading-[1] tracking-[-0.03em] text-slate-900">
                            {modeConfig.title}
                        </h1>
                        <p className="text-[16px] leading-relaxed text-slate-500 font-medium max-w-[30ch]">
                            {modeConfig.subtitle}
                        </p>
                    </motion.section>
                </motion.header>

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    <motion.div 
                        variants={itemVariants}
                        className="grid grid-cols-5 gap-2"
                    >
                        {roleOptions.map((option) => {
                            const active = role === option.id;
                            return (
                                <motion.button
                                    key={option.id}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setRole(option.id)}
                                    className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all border ${
                                        active
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-xl'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                    }`}
                                >
                                    <option.Icon size={18} strokeWidth={active ? 2.5 : 2} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{option.label}</span>
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    <motion.section 
                        variants={itemVariants}
                        ref={phoneCardRef}
                        className="glass-morphism rounded-[32px] p-1 shadow-premium overflow-hidden border-white/50"
                        style={{ scrollMarginTop: '24vh' }}
                    >
                        <div className="bg-white rounded-[31px] p-6 space-y-6">
                            <div className={`group rounded-[24px] border-2 transition-all p-4 ${error ? 'border-rose-100 bg-rose-50/30' : 'border-slate-50 bg-slate-50/50 focus-within:border-indigo-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-indigo-500/10'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${error ? 'bg-rose-100 text-rose-600' : 'bg-indigo-50 text-indigo-600 group-focus-within:bg-indigo-600 group-focus-within:text-white'}`}>
                                        <Phone size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Mobile Number</label>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="shrink-0 text-base font-black text-slate-400 sm:text-lg">+91</span>
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
                                                className="min-w-0 w-full border-none bg-transparent p-0 text-lg font-bold text-slate-900 outline-none focus:ring-0 placeholder:text-slate-200 sm:text-xl"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 px-2">
                                <div className="relative flex items-center shrink-0">
                                    <input 
                                        type="checkbox" 
                                        id="terms"
                                        checked={agreed}
                                        onChange={() => setAgreed(!agreed)}
                                        className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 bg-white transition-all checked:bg-indigo-600 checked:border-indigo-600"
                                    />
                                    <CheckCircle2 className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} />
                                </div>
                                <label htmlFor="terms" className="text-[12px] font-semibold text-slate-500 leading-relaxed cursor-pointer">
                                    By continuing, you agree to our{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            saveDriverRegistrationSession({
                                                ...storedSession,
                                                role,
                                            });
                                            navigate('/terms', { state: { role, returnTo: location.pathname } });
                                        }}
                                        className="text-indigo-600 font-bold hover:underline"
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
                                        className="text-indigo-600 font-bold hover:underline"
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
                                        className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-[13px] font-bold text-rose-600"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.section>

                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="flex items-center justify-center gap-3 py-2 text-slate-400">
                            <Sparkles size={16} className="text-amber-400" />
                            <span className="text-[13px] font-bold tracking-tight">{modeConfig.highlight}</span>
                        </div>

                        <motion.button 
                            variants={itemVariants}
                            whileHover={{ y: -1 }}
                            onClick={() => navigate(isLoginPage ? '/taxi/driver/reg-phone' : '/taxi/driver/login')}
                            className="w-full text-[14px] font-bold text-slate-400 hover:text-slate-900 transition-colors py-2"
                        >
                            {isLoginPage ? (
                                <>Don't have an account? <span className="text-indigo-600">Register now</span></>
                            ) : (
                                <>Already a partner? <span className="text-indigo-600">Sign in</span></>
                            )}
                        </motion.button>
                    </motion.div>
                </motion.div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100">
                    <div className="mx-auto max-w-sm">
                        <motion.button 
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSendOTP}
                            disabled={loading || !agreed || phone.length !== 10}
                            className={`flex h-16 w-full items-center justify-center gap-3 rounded-[24px] text-[16px] font-black tracking-tight shadow-xl transition-all ${
                                agreed && phone.length === 10 
                                    ? 'bg-slate-900 text-white shadow-indigo-500/20' 
                                    : 'pointer-events-none bg-slate-100 text-slate-300 shadow-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Get Verification Code</span>
                                    <ChevronRight size={20} strokeWidth={3} />
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
