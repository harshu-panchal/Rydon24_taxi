import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getStoredDriverRegistrationSession,
    clearDriverRegistrationSession,
    persistDriverAuthSession,
    saveDriverRegistrationSession,
    sendDriverLoginOtp,
    sendDriverOtp,
    verifyDriverLoginOtp,
    verifyDriverOtp,
} from '../../services/registrationService';

const unwrap = (response) => response?.data?.data || response?.data || response;
const normalizeDriverRole = (role) => {
    const normalized = String(role || 'driver').toLowerCase();
    if (normalized === 'owner') return 'owner';
    if (normalized === 'service_center' || normalized === 'service-center' || normalized === 'servicecenter') {
        return 'service_center';
    }
    if (normalized === 'service_center_staff' || normalized === 'service-center-staff' || normalized === 'servicecenterstaff') {
        return 'service_center_staff';
    }
    if (normalized === 'bus_driver' || normalized === 'bus-driver' || normalized === 'busdriver') {
        return 'bus_driver';
    }
    return 'driver';
};
const syncPushTokens = () => {
    window.__flushNativeFcmToken?.().catch?.(() => {});
    window.__registerBrowserFcmToken?.({ interactive: true }).catch?.(() => {});
};

const OTPVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [otp, setOtp] = useState(['', '', '', '']);
    const inputs = useRef([]);
    const otpCardRef = useRef(null);
    const [timer, setTimer] = useState(30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const session = {
        ...getStoredDriverRegistrationSession(),
        ...(location.state || {}),
    };
    const routePrefix = location.pathname.startsWith('/taxi/owner') ? '/taxi/owner' : '/taxi/driver';

    const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);
    const role = session.role || 'driver';
    const registrationId = session.registrationId || '';
    const debugOtp = session.debugOtp || '';
    const isLoginFlow = Boolean(session.loginMode);

    useEffect(() => {
        if (!phone) {
            navigate(isLoginFlow ? `${routePrefix}/login` : `${routePrefix}/reg-phone`, { replace: true });
            return undefined;
        }

        const interval = setInterval(() => {
            setTimer(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [isLoginFlow, navigate, phone, routePrefix]);

    useEffect(() => {
        const scrollOtpIntoView = () => {
            otpCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        const focusTimer = window.setTimeout(() => {
            inputs.current[0]?.focus();
            scrollOtpIntoView();
        }, 180);

        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', scrollOtpIntoView);

        return () => {
            window.clearTimeout(focusTimer);
            viewport?.removeEventListener('resize', scrollOtpIntoView);
        };
    }, []);

    const handleChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        if (value && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        if (otp.join('').length !== 4) {
            setError('Please enter a valid 4-digit OTP');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isLoginFlow) {
                const response = await verifyDriverLoginOtp({
                    phone,
                    otp: otp.join(''),
                    role,
                });
                const payload = unwrap(response);

                const token = payload?.token;
                if (token) {
                    const normalizedRole = normalizeDriverRole(role);
                    persistDriverAuthSession({ token, role: normalizedRole });
                    syncPushTokens();
                }

                clearDriverRegistrationSession();
                const normalizedRole = normalizeDriverRole(role);
                const nextPath =
                    normalizedRole === 'owner' || normalizedRole === 'driver'
                        ? `${routePrefix}/registration-status`
                        : normalizedRole === 'service_center'
                            ? '/taxi/driver/service-center'
                            : normalizedRole === 'service_center_staff'
                                ? '/taxi/driver/service-center'
                                : normalizedRole === 'bus_driver'
                                    ? '/taxi/driver/bus-home'
                                    : '/taxi/driver/home';
                navigate(nextPath, { 
                    replace: true, 
                    state: { 
                        role: normalizedRole,
                        token: payload?.token,
                        driver: payload?.driver
                    } 
                });
                return;
            }

            const response = await verifyDriverOtp({
                registrationId,
                phone,
                otp: otp.join(''),
            });
            const payload = unwrap(response);

            const nextState = saveDriverRegistrationSession({
                ...session,
                otpVerified: true,
                otpSession: payload?.session || null,
            });

            navigate(`${routePrefix}/step-personal`, { state: nextState });
        } catch (err) {
            setError(err?.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        setLoading(true);
        setError('');
        try {
            if (isLoginFlow) {
                const response = await sendDriverLoginOtp({ phone, role });
                saveDriverRegistrationSession({
                    ...session,
                    phone,
                    role,
                    loginMode: true,
                    debugOtp: response?.data?.session?.debugOtp || response?.session?.debugOtp || '',
                });
            } else {
                const response = await sendDriverOtp({ phone, role });
                const sessionData = response?.data?.session || response?.session || {};
                saveDriverRegistrationSession({
                    ...session,
                    phone,
                    role,
                    registrationId: sessionData.registrationId || '',
                    debugOtp: sessionData.debugOtp || '',
                    loginMode: false,
                });
            }
            setOtp(['', '', '', '']);
            inputs.current[0]?.focus();
            setTimer(30);
            setError('OTP Resent Successfully');
        } catch (err) {
            setError(err?.message || 'Failed to resend OTP');
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
                <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/40 to-white/90" />
            </div>

            <main className="relative z-10 mx-auto max-w-sm px-6 pt-16 pb-36">
                <motion.header 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6 mb-12"
                >
                    <div className="flex items-center justify-between">
                        <motion.button
                            variants={itemVariants}
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                                navigate(isLoginFlow ? `${routePrefix}/login` : `${routePrefix}/reg-phone`, {
                                    state: session,
                                })
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-900 shadow-sm transition-all"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </motion.button>
                        <motion.div 
                            variants={itemVariants}
                            className="rounded-full bg-slate-900/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-900/5"
                        >
                            Security Check
                        </motion.div>
                    </div>

                    <motion.section 
                        variants={itemVariants}
                        className="space-y-3"
                    >
                        <div className="flex items-center gap-3">
                             <div 
                                className="flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                            >
                                <ShieldCheck size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                                Dynamic Verification
                            </span>
                        </div>
                        <h1 className="font-['Outfit'] text-[48px] font-black leading-[1] tracking-[-0.04em] text-slate-900">
                            Verify <span className="text-slate-400">Phone</span>
                        </h1>
                        <p className="text-[15px] leading-relaxed text-slate-500 font-bold opacity-80 max-w-[28ch]">
                            Enter the 4-digit code sent to <span className="text-slate-900 underline underline-offset-4 decoration-2 decoration-slate-900/10">+91 {phone}</span>
                        </p>
                    </motion.section>
                </motion.header>

                <motion.section
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    ref={otpCardRef}
                    className="bg-white rounded-[2.5rem] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden space-y-8"
                    style={{ scrollMarginTop: '24vh' }}
                >
                    <div className="flex justify-between gap-3">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => inputs.current[index] = el}
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="off"
                                name={`driver-otp-${index}`}
                                maxLength={1}
                                value={digit}
                                onChange={e => handleChange(index, e.target.value)}
                                onKeyDown={e => handleKeyDown(index, e)}
                                onFocus={() => otpCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                className={`h-16 w-full rounded-[1.25rem] border-2 text-center text-2xl font-black transition-all outline-none ${
                                    digit 
                                        ? 'border-slate-900 bg-white shadow-[0_10px_20px_rgba(0,0,0,0.05)]' 
                                        : 'border-slate-50 bg-slate-50 focus:border-slate-900/10 focus:bg-white'
                                }`}
                            />
                        ))}
                    </div>

                    <div className="space-y-6">
                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`rounded-2xl border px-4 py-3 text-[12px] font-bold flex items-center gap-2 ${
                                        error.includes('Successfully') 
                                            ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                            : 'border-rose-100 bg-rose-50 text-rose-600'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${error.includes('Successfully') ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex flex-col items-center gap-3 py-2">
                            <p className="text-[12px] font-black uppercase tracking-[0.1em] text-slate-400 opacity-60">
                                Didn't receive the code?
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={timer > 0 || loading}
                                className={`flex items-center gap-2 text-[13px] font-black uppercase tracking-widest transition-all ${
                                    timer > 0 
                                        ? 'text-slate-300' 
                                        : 'text-slate-900 hover:opacity-70 border-b-2 border-slate-900/10 pb-0.5'
                                }`}
                            >
                                <MessageSquare size={14} className={timer > 0 ? 'opacity-30' : 'opacity-100'} />
                                {timer > 0 ? `Wait ${timer}s` : 'Resend Now'}
                            </button>
                        </div>
                    </div>
                </motion.section>

                <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
                    <div className="mx-auto max-w-sm">
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleVerify}
                            disabled={loading || otp.join('').length !== 4}
                            className={`group flex h-16 w-full items-center justify-center gap-3 rounded-[1.8rem] text-[15px] font-black tracking-tight transition-all relative overflow-hidden ${
                                otp.join('').length === 4
                                    ? 'bg-slate-900 text-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:bg-black'
                                    : 'pointer-events-none bg-slate-200 text-slate-400 shadow-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 uppercase tracking-widest">Verify & Continue</span>
                                    <ChevronRight size={18} strokeWidth={3} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OTPVerification;
