import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getStoredDriverRegistrationSession,
    saveDriverPersonalDetails,
    saveDriverRegistrationSession,
} from '../../services/registrationService';

const NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const StepPersonal = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const routePrefix = location.pathname.startsWith('/taxi/owner')
        ? '/taxi/owner'
        : '/taxi/driver';
    const session = {
        ...getStoredDriverRegistrationSession(),
        ...(location.state || {}),
    };
    const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);
    const registrationId = session.registrationId || '';
    const role = routePrefix === '/taxi/owner'
        ? 'owner'
        : (session.role || 'driver');
    const isOwner = role === 'owner';

    const [formData, setFormData] = useState({
        fullName: session.fullName || '',
        email: session.email || '',
        gender: session.gender || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        saveDriverRegistrationSession({
            ...session,
            ...formData,
        });
    }, [formData]);

    const handleContinue = async () => {
        const fullName = formData.fullName.trim();
        const email = formData.email.trim().toLowerCase();

        if (!fullName || !email || !formData.gender) {
            setError('Please fill all required details');
            return;
        }

        if (!NAME_REGEX.test(fullName)) {
            setError(`${isOwner ? 'Owner' : 'Driver'} name should contain alphabets only`);
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            setError('Please enter a valid email address, example aa@gmail.com');
            return;
        }

            setLoading(true);
            setError('');

            try {
                const normalizedFormData = {
                    ...formData,
                    fullName,
                    email,
                };
                const response = await saveDriverPersonalDetails({
                    registrationId,
                    phone,
                    ...normalizedFormData,
                });

                const nextState = saveDriverRegistrationSession({
                    ...session,
                    registrationId,
                    phone,
                    role,
                    ...normalizedFormData,
                    personalSession: response?.data?.session || null,
                });

                navigate(`${routePrefix}/step-referral`, { state: nextState });
            } catch (err) {
                setError(err?.message || 'Unable to save personal details');
            } finally {
                setLoading(false);
            }
    };

    const genders = ['Male', 'Female', 'Other'];

    return (
        <div
            className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            <main className="mx-auto max-w-sm space-y-6">
                <header className="space-y-5">
                    <div className="flex justify-end">
                        <div className="rounded-full border border-[#dcc9ab] bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#8a6a3d] uppercase">
                            Step 1 of 4
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                            <User size={18} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                                {isOwner ? 'Owner onboarding' : 'Driver onboarding'}
                            </p>
                            <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                                Personal details
                            </h1>
                            <p className="max-w-[28ch] text-sm leading-6 text-slate-600">
                                Let&apos;s get the basics in place so your profile feels complete from day one.
                            </p>
                        </div>
                    </section>
                </header>

                <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    <div className="space-y-1 px-1 pt-1">
                        <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950">Profile information</h2>
                        <p className="text-sm text-slate-500">Clear labels, readable fields, no guesswork.</p>
                    </div>

                    <div className="space-y-3.5">
                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white focus-within:shadow-[0_16px_40px_rgba(197,157,102,0.14)]">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                                    <User size={18} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Enter Name</label>
                                    <input
                                        value={formData.fullName}
                                        onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value.replace(/[^A-Za-z .'-]/g, '') }))}
                                        placeholder="Hritik Raghuwanshi"
                                        className="w-full border-none bg-transparent p-0 text-[16px] font-semibold text-slate-950 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[#e5dccd] bg-[#f8f4ed] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#8a6a3d] shadow-sm">
                                    <Phone size={18} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Mobile number</label>
                                    <p className="text-[16px] font-semibold text-slate-900">+91 {phone}</p>
                                    <p className="text-xs text-slate-500">Verified from your OTP step.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white focus-within:shadow-[0_16px_40px_rgba(197,157,102,0.14)]">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                                    <Mail size={18} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Email address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData(p => ({ ...p, email: e.target.value.trim().toLowerCase() }))}
                                        placeholder="name@example.com"
                                        className="w-full border-none bg-transparent p-0 text-[16px] font-semibold text-slate-950 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Gender</label>
                                    <p className="text-sm text-slate-500">Choose the option that matches your profile.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {genders.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setFormData(p => ({ ...p, gender: g }))}
                                            className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-all ${
                                                formData.gender === g
                                                    ? 'border-[#b8894f] bg-[#8a5a22] text-white shadow-[0_12px_24px_rgba(138,90,34,0.22)]'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#cfb28b] hover:bg-[#fbf6ef]'
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
                        {error}
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
                    <div className="mx-auto max-w-sm">
                        <button
                            onClick={handleContinue}
                            disabled={loading}
                            className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                                formData.fullName && formData.email && formData.gender
                                    ? 'bg-slate-950 text-white hover:bg-slate-900'
                                    : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                            }`}
                        >
                            {loading ? 'Saving...' : 'Continue'}
                            <ChevronRight size={17} strokeWidth={2.8} />
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StepPersonal;
