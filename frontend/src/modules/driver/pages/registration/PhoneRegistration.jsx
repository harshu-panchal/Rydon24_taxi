import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Phone, ChevronRight, ShieldCheck, Briefcase, UserRound, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    clearDriverRegistrationSession,
    saveDriverRegistrationSession,
    sendDriverLoginOtp,
    sendDriverOtp,
} from '../../services/registrationService';

import { useSettings } from '../../../../shared/context/SettingsContext';

const PhoneRegistration = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('driver');
    const [agreed, setAgreed] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isLoginPage = location.pathname === '/taxi/driver/login' || location.pathname === '/taxi/driver/login/';
    const appName = settings.general?.app_name || 'App';
    
    const modeConfig = useMemo(() => {
        const isOwner = role === 'owner';

        return {
            badge: isOwner ? 'Enterprise' : 'Partner',
            title: isLoginPage
                ? `${isOwner ? 'Owner' : 'Driver'} Login`
                : `Join ${appName}`,
            subtitle: isLoginPage
                ? `Enter your registered number to access your account.`
                : `Start your journey as a ${isOwner ? 'fleet owner' : 'professional driver'}.`,
            highlight: isOwner ? 'Manage fleet, payouts & drivers.' : 'Go online, get trips & earn daily.',
            accentBg: isOwner ? 'bg-[#1C2833]' : 'bg-slate-900',
            accentSoft: isOwner ? 'bg-[#fcfcfb]' : 'bg-white',
            accentText: isOwner ? 'text-[#1C2833]' : 'text-slate-900',
            buttonClass: 'bg-slate-950 text-white',
            Icon: isOwner ? Briefcase : UserRound,
        };
    }, [appName, isLoginPage, role]);

    useEffect(() => {
        clearDriverRegistrationSession();
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
                ? await sendDriverLoginOtp({ phone })
                : await sendDriverOtp({ phone, role });
            const sessionData = response?.data?.session || {};
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

    return (
        <div 
            className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none overflow-x-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            <main className="mx-auto max-w-sm space-y-6">
                <header className="space-y-5">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-transform active:scale-95"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="rounded-full border border-[#dcc9ab] bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#8a6a3d] uppercase">
                            {isLoginPage ? 'Welcome Back' : 'Get Started'}
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                                    {modeConfig.badge}
                                </p>
                                <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                                    {modeConfig.title}
                                </h1>
                                <p className="max-w-[24ch] text-sm leading-6 text-slate-600">
                                    {modeConfig.subtitle}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                                <modeConfig.Icon size={22} />
                            </div>
                        </div>
                    </section>
                </header>

                <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-white/50 border border-white/80 p-1.5 shadow-soft backdrop-blur-sm">
                    {[
                        { id: 'driver', label: 'Driver', Icon: UserRound },
                        { id: 'owner', label: 'Fleet Owner', Icon: Briefcase },
                    ].map((option) => {
                        const active = role === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setRole(option.id)}
                                className={`flex h-12 items-center justify-center gap-2 rounded-[14px] text-[13px] font-semibold tracking-tight transition-all ${
                                    active
                                        ? 'bg-slate-950 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <option.Icon size={16} strokeWidth={2} />
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white focus-within:shadow-[0_16px_40px_rgba(197,157,102,0.14)]">
                        <div className="flex items-start gap-3.5">
                            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                                <Phone size={18} />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Mobile number</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[17px] font-semibold text-slate-400">+91</span>
                                    <input 
                                        type="tel" 
                                        maxLength={10}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 10 digits"
                                        className="w-full border-none bg-transparent p-0 text-[17px] font-semibold text-slate-950 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 px-1 py-1">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox" 
                                id="terms"
                                checked={agreed}
                                onChange={() => setAgreed(!agreed)}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 bg-white transition-all checked:bg-slate-950 checked:border-slate-950"
                            />
                            <ShieldCheck className="pointer-events-none absolute left-1 top-1 h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                        </div>
                        <label htmlFor="terms" className="text-[12px] font-medium text-slate-500 leading-snug cursor-pointer">
                            I understand and agree to the{' '}
                            <button type="button" onClick={() => navigate('/terms')} className="text-slate-950 font-semibold underline underline-offset-2">Terms</button>
                            {' '}and{' '}
                            <button type="button" onClick={() => navigate('/privacy')} className="text-slate-950 font-semibold underline underline-offset-2">Privacy Policy</button>.
                        </label>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 animate-in fade-in slide-in-from-top-1 duration-300">
                            {error}
                        </div>
                    )}
                </section>

                <div className="space-y-4 pt-2">
                    <p className="text-center text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
                        <Sparkles size={14} className="text-amber-400" />
                        {modeConfig.highlight}
                    </p>

                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate(isLoginPage ? '/taxi/driver/welcome' : '/taxi/driver/login')}
                            className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors py-2"
                        >
                            {isLoginPage ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                        </button>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
                    <div className="mx-auto max-w-sm">
                        <button 
                            onClick={handleSendOTP}
                            disabled={loading || !agreed || phone.length !== 10}
                            className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                                agreed && phone.length === 10 
                                    ? 'bg-slate-950 text-white hover:bg-slate-900' 
                                    : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                            }`}
                        >
                            {loading ? 'Sending OTP...' : 'Continue'} 
                            {!loading && <ChevronRight size={17} strokeWidth={2.8} />}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PhoneRegistration;
