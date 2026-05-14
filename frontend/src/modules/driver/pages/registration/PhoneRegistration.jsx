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

const AUTO_FLOW_ROLES = new Set(['driver']);
const LOGIN_ONLY_ROLES = new Set(['bus_driver', 'service_center', 'service_center_staff']);
const SHARED_ROLE_OPTIONS = [
    { id: 'driver', label: 'Driver', Icon: UserRound },
    { id: 'owner', label: 'Owner', Icon: Briefcase },
    { id: 'bus_driver', label: 'Bus', Icon: ShieldCheck },
    { id: 'service_center', label: 'Center', Icon: Building2 },
    { id: 'service_center_staff', label: 'Staff', Icon: UserRound },
];

const PhoneRegistration = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const storedSession = getStoredDriverRegistrationSession();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const sharedReferralCode = String(
        searchParams.get('ref') ||
        searchParams.get('referral') ||
        searchParams.get('code') ||
        storedSession.referralCode ||
        '',
    ).trim().toUpperCase();
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

        if (sharedReferralCode && location.pathname.startsWith('/taxi/driver')) {
            return 'driver';
        }

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
    const entryPath = isLoginPage ? `${routePrefix}/login` : `${routePrefix}/reg-phone`;
    const appName = settings.general?.app_name || 'App';
    const shouldUseUnifiedFlow = AUTO_FLOW_ROLES.has(role) && routePrefix === '/taxi/driver';
    const isLoginOnlyRole = LOGIN_ONLY_ROLES.has(role);
    const usesLoginPresentation = isLoginPage || isLoginOnlyRole;
    const roleOptions = SHARED_ROLE_OPTIONS;
    
    const modeConfig = useMemo(() => {
        const isOwner = role === 'owner';
        const isBusDriver = role === 'bus_driver';
        const isServiceCenter = role === 'service_center';
        const isServiceCenterStaff = role === 'service_center_staff';

        return {
            badge: isOwner ? 'Enterprise' : isBusDriver ? 'Transit' : isServiceCenter ? 'Operations' : isServiceCenterStaff ? 'Team' : 'Partner',
            title: usesLoginPresentation
                ? `${isOwner ? 'Owner' : isBusDriver ? 'Bus Driver' : isServiceCenter ? 'Service Center' : isServiceCenterStaff ? 'Service Staff' : 'Driver'} Login`
                : `Join ${appName}`,
            subtitle: usesLoginPresentation
                ? `Enter your number to access account.`
                : `Start your journey as a ${isOwner ? 'owner' : isBusDriver ? 'captain' : isServiceCenter ? 'operator' : isServiceCenterStaff ? 'staff' : 'driver'}.`,
            highlight: isOwner ? 'Manage fleet, payouts & drivers.' : isBusDriver ? 'Manage your coach, schedules and seat desk.' : isServiceCenter ? 'Manage your center profile, staff and rental vehicle catalog.' : isServiceCenterStaff ? 'Handle assigned bookings and work queues for your center.' : 'Go online, get trips & earn daily.',
            accentColor: isOwner ? '#1C2833' : isBusDriver ? '#0f3d3e' : isServiceCenter ? '#14342b' : isServiceCenterStaff ? '#1e3a5f' : '#4F46E5',
            Icon: isOwner ? Briefcase : isBusDriver ? ShieldCheck : isServiceCenter ? Building2 : isServiceCenterStaff ? ShieldCheck : UserRound,
        };
    }, [appName, role, usesLoginPresentation]);

    useEffect(() => {
        saveDriverRegistrationSession({
            ...storedSession,
            role,
            phone,
            loginMode: isLoginPage,
            entryPath,
            referralCode: sharedReferralCode,
        });
    }, [entryPath, isLoginPage, role, phone, sharedReferralCode]);

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
            let response;
            let loginMode = isLoginPage;

            if (shouldUseUnifiedFlow) {
                try {
                    response = await sendDriverLoginOtp({ phone, role });
                    loginMode = true;
                } catch (loginError) {
                    const status = Number(loginError?.response?.status || 0);
                    const message = String(loginError?.message || '').toLowerCase();
                    const isMissingAccount = status === 404 || message.includes('account not found');

                    if (!isMissingAccount) {
                        throw loginError;
                    }

                    response = await sendDriverOtp({ phone, role });
                    loginMode = false;
                }
            } else {
                response = usesLoginPresentation
                    ? await sendDriverLoginOtp({ phone, role })
                    : await sendDriverOtp({ phone, role });
                loginMode = usesLoginPresentation;
            }

            const sessionData = response?.data?.session || response?.session || {};
            const nextState = saveDriverRegistrationSession({
                phone,
                role,
                registrationId: sessionData.registrationId || '',
                debugOtp: sessionData.debugOtp || '',
                loginMode,
                entryPath,
                referralCode: sharedReferralCode,
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
            className="min-h-screen relative bg-white select-none overflow-x-hidden font-['Inter']"
        >
            <div className="fixed inset-0 z-0">
                <img 
                    src={loginBg} 
                    alt="" 
                    className="w-full h-full object-cover opacity-20 blur-[1px]"
                />
                {/* Vibrant Bright Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/90 via-white to-blue-50/80" />
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#FFB300]/10 to-transparent" />
            </div>

            <main className="relative z-10 mx-auto max-w-sm px-5 pt-10 pb-24">
                <motion.header 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6 mb-8 flex flex-col items-center text-center"
                >
                    <div className="flex flex-col items-center gap-4">
                        {settings.general?.logo || settings.customization?.logo ? (
                            <div className="p-3 bg-white rounded-2xl shadow-xl shadow-amber-200/40 border border-amber-100">
                                <img 
                                    src={settings.general?.logo || settings.customization?.logo} 
                                    alt={appName} 
                                    className="h-10 w-auto object-contain"
                                />
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-[#FFB300] px-4 py-2 text-sm font-black tracking-tighter text-slate-900 shadow-xl shadow-amber-400/30">
                                {appName}
                            </div>
                        )}
                        <motion.div 
                            variants={itemVariants}
                            className="rounded-full bg-amber-100 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#B48400] border border-amber-200/50 w-fit"
                        >
                            {usesLoginPresentation ? 'Secure Access' : 'Partner Program'}
                        </motion.div>
                    </div>

                    <motion.section 
                        variants={itemVariants}
                        className="space-y-3 flex flex-col items-center"
                    >
                        <div className="flex items-center gap-3">
                             <div 
                                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xl"
                                style={{ 
                                    backgroundColor: modeConfig.accentColor,
                                    boxShadow: `0 10px 20px ${modeConfig.accentColor}33`
                                }}
                            >
                                <modeConfig.Icon size={20} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {modeConfig.badge}
                            </span>
                        </div>
                        <h1 className="font-['Outfit'] text-[36px] font-black leading-[1] tracking-[-0.04em] text-slate-900">
                            {modeConfig.title.split(' ')[0]} <span className="text-[#FFB300]">{modeConfig.title.split(' ').slice(1).join(' ')}</span>
                        </h1>
                        <p className="text-[15px] leading-relaxed text-slate-600 font-bold opacity-90 max-w-[28ch]">
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
                        className="flex items-center gap-2 mb-4 bg-white/60 backdrop-blur-md p-2 rounded-2xl border border-white/80 shadow-sm overflow-x-auto no-scrollbar scroll-smooth w-full"
                    >
                        {roleOptions.map((option) => {
                            const active = role === option.id;
                            return (
                                <motion.button
                                    key={option.id}
                                    layout
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setRole(option.id)}
                                    className={`flex-none flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-[#FFB300] text-slate-900 shadow-lg shadow-amber-400/20 border border-amber-300'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <option.Icon size={16} strokeWidth={active ? 3 : 2} />
                                    <span className="text-[11px] font-black uppercase tracking-wider">{option.label}</span>
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    <motion.section 
                        variants={itemVariants}
                        ref={phoneCardRef}
                        className="bg-white rounded-[32px] p-6 shadow-[0_20px_50px_rgba(255,179,0,0.08)] border border-amber-50 relative overflow-hidden"
                        style={{ scrollMarginTop: '20vh' }}
                    >
                        <div className="space-y-6">
                            <div className={`group rounded-2xl border-2 transition-all p-5 ${error ? 'border-rose-200 bg-rose-50/30' : 'border-amber-50 bg-amber-50/20 focus-within:border-[#FFB300] focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-amber-400/10'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${error ? 'bg-rose-100 text-rose-500' : 'bg-white text-amber-500 group-focus-within:bg-[#FFB300] group-focus-within:text-slate-900 shadow-sm'}`}>
                                        <Phone size={22} strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-amber-600/60 mb-1.5">Mobile Number</label>
                                        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                                            <span className="shrink-0 text-[20px] font-black text-slate-400">+91</span>
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
                                                className="min-w-0 flex-1 border-none bg-transparent p-0 text-[18px] font-black text-slate-900 outline-none focus:ring-0 placeholder:text-[17px] placeholder:text-slate-200 tracking-[0.02em] sm:text-[20px] sm:placeholder:text-[20px] sm:tracking-[0.05em]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 px-1 items-start">
                                <div className="relative flex items-center shrink-0 mt-1">
                                    <input 
                                        type="checkbox" 
                                        id="terms"
                                        checked={agreed}
                                        onChange={() => setAgreed(!agreed)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-amber-100 bg-white transition-all checked:bg-[#FFB300] checked:border-[#FFB300]"
                                    />
                                    <CheckCircle2 className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-slate-900 opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3.5} />
                                </div>
                                <label htmlFor="terms" className="text-[11px] font-bold text-slate-400 leading-relaxed cursor-pointer select-none">
                                    I agree to the{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            saveDriverRegistrationSession({
                                                ...storedSession,
                                                role,
                                            });
                                            navigate(`${routePrefix}/terms`, { state: { role, returnTo: location.pathname } });
                                        }}
                                        className="text-[#FFB300] font-black hover:underline underline-offset-2"
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
                                            navigate(`${routePrefix}/privacy`, { state: { role, returnTo: location.pathname } });
                                        }}
                                        className="text-[#FFB300] font-black hover:underline underline-offset-2"
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
                                        className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-[12px] font-bold text-rose-600 flex items-center gap-3"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.section>

                    <motion.div variants={itemVariants} className="space-y-6">
                        <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-2xl border border-amber-100 w-max mx-auto px-5 shadow-sm">
                            <Sparkles size={14} className="text-[#FFB300] fill-[#FFB300]" />
                            <span className="text-[11px] font-black tracking-tight text-slate-900 uppercase opacity-70">{modeConfig.highlight}</span>
                        </div>

                        <motion.p
                            variants={itemVariants}
                            className="w-full py-1 text-center text-[13px] font-black uppercase tracking-widest text-slate-500"
                        >
                            {shouldUseUnifiedFlow
                                ? 'New drivers sign up automatically. Existing drivers continue to login.'
                                : isLoginOnlyRole && !isLoginPage
                                    ? 'This role uses the same phone login flow from here.'
                                    : 'Use your phone number to continue.'}
                        </motion.p>

                        <motion.button
                            variants={itemVariants}
                            whileHover={{ y: -1 }}
                            type="button"
                            onClick={() => navigate(`${routePrefix}/support`, { state: { role, returnTo: location.pathname } })}
                            className="mx-auto block text-[12px] font-black text-slate-500 transition-all py-1 tracking-tight"
                        >
                            Need help? <span className="text-[#FFB300] border-b-2 border-amber-400/30 pb-0.5">Open Support</span>
                        </motion.button>
                    </motion.div>
                </motion.div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent">
                    <div className="mx-auto max-w-sm">
                        <motion.button 
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSendOTP}
                            disabled={loading || !agreed || phone.length !== 10}
                            className={`group flex h-16 w-full items-center justify-center gap-3 rounded-[24px] text-[16px] font-black tracking-tight transition-all relative overflow-hidden ${
                                agreed && phone.length === 10 
                                    ? 'bg-slate-900 text-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:bg-black' 
                                    : 'pointer-events-none bg-slate-100 text-slate-300 shadow-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-6 w-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 uppercase tracking-[0.1em]">Send OTP Code</span>
                                    <ChevronRight size={20} strokeWidth={3.5} className="relative z-10 group-hover:translate-x-1.5 transition-transform" />
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
