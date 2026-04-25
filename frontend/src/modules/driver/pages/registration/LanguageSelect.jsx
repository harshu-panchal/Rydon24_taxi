import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Globe, ChevronRight } from 'lucide-react';
import { useSettings } from '../../../../shared/context/SettingsContext';

const LanguageSelect = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const appName = settings.general?.app_name || 'App';
    const appLogo = settings.general?.logo || settings.customization?.logo || settings.general?.favicon || '';
    const [selectedLang, setSelectedLang] = useState(() => localStorage.getItem('driver_lang') || 'english');
    const isAuthenticatedDriver = Boolean(localStorage.getItem('driverToken') || localStorage.getItem('token')) && !location.state?.registrationFlow;
    const authenticatedHome =
        String(localStorage.getItem('role') || 'driver').toLowerCase() === 'owner'
            ? '/taxi/driver/profile'
            : '/taxi/driver/home';

    const languages = [
        { id: 'english', label: 'English', sub: 'Standard Experience', native: 'English' },
        { id: 'hindi', label: 'Hindi', sub: 'मानक अनुभव', native: 'हिन्दी' },
        { id: 'marathi', label: 'Marathi', sub: 'मानक अनुभव', native: 'मराठी' },
        { id: 'gujarati', label: 'Gujarati', sub: 'પ્રમાણભૂત અનુભવ', native: 'ગુજરાતી' }
    ];

    const handleConfirm = () => {
        localStorage.setItem('driver_lang', selectedLang);
        navigate(isAuthenticatedDriver ? authenticatedHome : '/taxi/driver/reg-phone', { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] font-sans select-none overflow-x-hidden flex flex-col p-6 pt-12 pb-10">
            {/* Branding */}
            <div className="mb-12 flex flex-col items-center text-center space-y-4">
                {appLogo ? (
                    <img src={appLogo} alt={appName} className="h-10 object-contain drop-shadow-sm" />
                ) : (
                    <div className="rounded-2xl bg-white px-4 py-2 text-lg font-black tracking-tight text-slate-900 shadow-sm">
                        {appName}
                    </div>
                )}
                <div className="space-y-1">
                    <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Choose Language</h1>
                    <p className="text-[15px] font-medium text-slate-400">Select your preferred communication language</p>
                </div>
            </div>

            {/* Language Grid */}
            <main className="flex-1 grid grid-cols-1 gap-4">
                {languages.map((lang, index) => (
                    <motion.div
                        key={lang.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedLang(lang.id)}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden ${
                            selectedLang === lang.id 
                            ? 'bg-white border-primary shadow-premium' 
                            : 'bg-white border-slate-100 shadow-soft hover:border-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                selectedLang === lang.id ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-400'
                            }`}>
                                <Globe size={22} strokeWidth={2.5} />
                            </div>
                            <div className="leading-tight">
                                <h4 className="text-[17px] font-display font-bold text-slate-900">{lang.label}</h4>
                                <p className="text-[12px] font-medium text-slate-400 mt-0.5">{lang.native}</p>
                            </div>
                        </div>

                        {selectedLang === lang.id && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white shadow-soft relative z-10"
                            >
                                <Check size={16} strokeWidth={3} />
                            </motion.div>
                        )}
                        
                        {/* Subtle Background Pattern */}
                        <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity ${selectedLang === lang.id ? 'opacity-[0.07]' : ''}`}>
                            <Globe size={100} />
                        </div>
                    </motion.div>
                ))}
            </main>

            {/* Footer Action */}
            <div className="mt-8">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    className="w-full h-15 bg-primary text-white rounded-2xl flex items-center justify-center gap-3 text-[17px] font-display font-bold shadow-premium transition-all hover:bg-primary/95 group"
                >
                    {isAuthenticatedDriver ? 'Save Language' : 'Confirm & Continue'}
                    <ChevronRight size={20} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
            </div>
        </div>
    );
};

export default LanguageSelect;
