import React, { useEffect, useState } from 'react';
import { ArrowLeft, Gift, ChevronRight, Tag } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getStoredDriverRegistrationSession,
    saveDriverReferral,
    saveDriverRegistrationSession,
} from '../../services/registrationService';

const StepReferral = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const session = {
        ...getStoredDriverRegistrationSession(),
        ...(location.state || {}),
    };
    const [referral, setReferral] = useState(session.referralCode || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        saveDriverRegistrationSession({
            ...session,
            referralCode: referral,
        });
    }, [referral]);

    const handleNext = async (skip = false) => {
        setLoading(true);
        setError('');

        try {
            const response = await saveDriverReferral({
                registrationId: session.registrationId,
                phone: session.phone,
                referralCode: skip ? '' : referral,
            });

            const nextState = saveDriverRegistrationSession({
                ...session,
                referralCode: skip ? '' : referral,
                referralSession: response?.data?.session || null,
            });

            navigate('/taxi/driver/step-vehicle', { state: nextState });
        } catch (err) {
            setError(err?.message || 'Unable to save referral code');
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
                            Step 2 of 4
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                            <Gift size={18} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                                Rewards program
                            </p>
                            <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                                Got a code?
                            </h1>
                            <p className="max-w-[28ch] text-sm leading-6 text-slate-600">
                                Enter a referral code to unlock exclusive joining bonuses and rewards.
                            </p>
                        </div>
                    </section>
                </header>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
                        {error}
                    </div>
                )}

                <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    <div className="space-y-1 px-1">
                        <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950">Referral details</h2>
                        <p className="text-sm text-slate-500">Optional but recommended for bonuses.</p>
                    </div>

                    <div className="space-y-3.5">
                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white focus-within:shadow-[0_16px_40px_rgba(197,157,102,0.14)]">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                                    <Tag size={18} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Referral Code</label>
                                    <input
                                        value={referral}
                                        onChange={(e) => setReferral(e.target.value.toUpperCase())}
                                        placeholder="ZETO-BONUS-9080"
                                        className="w-full border-none bg-transparent p-0 text-[16px] font-semibold text-slate-950 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-300 tracking-wider uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-amber-100 bg-amber-50/50 p-4">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
                                    <Gift size={18} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className="block text-sm font-semibold text-amber-900 tracking-tight">Joining Reward</span>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        Unlock <span className="font-bold">₹500 Bonus</span> after you complete your first 10 rides successfully.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <button 
                    onClick={() => handleNext(true)}
                    disabled={loading}
                    className="w-full text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors py-2"
                >
                    I don't have a code, skip this
                </button>

                <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
                    <div className="mx-auto max-w-sm">
                        <button
                            onClick={() => handleNext(false)}
                            disabled={loading || !referral}
                            className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                                referral
                                    ? 'bg-slate-950 text-white hover:bg-slate-900'
                                    : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                            }`}
                        >
                            {loading ? 'Applying Code...' : 'Apply & Continue'}
                            {!loading && <ChevronRight size={17} strokeWidth={2.8} />}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StepReferral;

