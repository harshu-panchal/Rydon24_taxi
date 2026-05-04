import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
                const nextPath =
                    normalizeDriverRole(role) === 'owner'
                        ? '/taxi/owner/dashboard'
                        : normalizeDriverRole(role) === 'service_center'
                            ? '/taxi/driver/service-center'
                            : normalizeDriverRole(role) === 'service_center_staff'
                            ? '/taxi/driver/service-center'
                        : normalizeDriverRole(role) === 'bus_driver'
                            ? '/taxi/driver/bus-home'
                            : '/taxi/driver/home';
                navigate(nextPath, { replace: true });
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

    return (
        <div 
            className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none overflow-x-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            <main className="mx-auto max-w-sm space-y-6">
                <header className="space-y-5">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() =>
                                navigate(isLoginFlow ? `${routePrefix}/login` : `${routePrefix}/reg-phone`, {
                                    state: session,
                                })
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-transform active:scale-95"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="rounded-full border border-[#dcc9ab] bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#8a6a3d] uppercase">
                            Security Check
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                            <ShieldCheck size={18} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                                Dynamic verification
                            </p>
                            <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                                Verify phone
                            </h1>
                            <p className="max-w-[24ch] text-sm leading-6 text-slate-600">
                                Enter the 4-digit code sent to your number <span className="text-slate-900 font-semibold tracking-tight">+91 {phone}</span>
                            </p>
                        </div>
                    </section>
                </header>

                <section
                    ref={otpCardRef}
                    className="space-y-8 rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
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
                                className={`h-16 w-full rounded-[22px] border-2 text-center text-2xl font-bold transition-all outline-none ${
                                    digit 
                                        ? 'border-slate-900 bg-white shadow-lg' 
                                        : 'border-slate-100 bg-[#fcfcfb] focus:border-[#c59d66] focus:bg-white'
                                }`}
                            />
                        ))}
                    </div>

                    <div className="space-y-4">
                        {error && (
                            <div className={`rounded-xl border px-3 py-2 text-xs font-semibold text-center ${
                                error.includes('Successfully') 
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                    : 'border-rose-100 bg-rose-50 text-rose-600'
                            }`}>
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-3">
                            <p className="text-[13px] font-medium text-slate-400">
                                Didn't receive the code?
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={timer > 0 || loading}
                                className={`flex items-center gap-2 text-sm font-bold tracking-tight transition-all ${
                                    timer > 0 
                                        ? 'text-slate-300' 
                                        : 'text-[#8a5a22] hover:text-[#70491b]'
                                }`}
                            >
                                <MessageSquare size={16} />
                                {timer > 0 ? `Resend in ${timer}s` : 'Resend Code Now'}
                            </button>
                        </div>
                    </div>
                </section>

                <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
                    <div className="mx-auto max-w-sm">
                        <button
                            onClick={handleVerify}
                            disabled={loading || otp.join('').length !== 4}
                            className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                                otp.join('').length === 4
                                    ? 'bg-slate-950 text-white hover:bg-slate-900'
                                    : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                            }`}
                        >
                            {loading ? 'Verifying OTP...' : 'Verify & Continue'}
                            {!loading && <ChevronRight size={17} strokeWidth={2.8} />}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OTPVerification;
