import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../../services/adminService';
import { useSettings } from '../../../../shared/context/SettingsContext';

const STATIC_ADMIN_EMAIL = 'admin@gmail.com';
const STATIC_ADMIN_PASSWORD = '12345';

const AdminLogin = () => {
  const { settings } = useSettings();
  const [email, setEmail] = useState(STATIC_ADMIN_EMAIL);
  const [password, setPassword] = useState(STATIC_ADMIN_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const appLogo = settings.general?.logo || settings.customization?.logo;
  const appName = settings.general?.app_name || 'App';

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await adminService.login({ email, password });
      localStorage.setItem('adminToken', response.data?.token || '');
      localStorage.setItem('adminInfo', JSON.stringify(response.data?.admin || {}));
      setTimeout(() => navigate('/admin/dashboard'), 300);
    } catch (err) {
      setError(err.message || 'Unable to complete admin login.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-3 py-2 sm:py-3 md:py-4 font-sans overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[390px] md:max-w-[420px] bg-white rounded-[32px] md:rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.08)] border border-gray-100 px-4 py-3 sm:px-5 sm:py-4 md:px-14 md:py-8 relative z-10 overflow-hidden"
      >
        {isLoading && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            className="absolute top-0 left-0 h-1.5 bg-primary z-20"
          />
        )}

        <div className="flex flex-col items-center mb-3 md:mb-6 text-center">
          {appLogo ? (
            <img
              src={appLogo}
              alt={`${appName} Logo`}
              className="w-36 sm:w-44 md:w-56 h-auto mb-2 md:mb-4 object-contain drop-shadow-2xl cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate('/')}
            />
          ) : (
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl">
               <ShieldCheck size={32} />
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
            <ShieldCheck size={16} className="text-primary" />
            <span className="text-gray-500 font-bold text-[11px] uppercase tracking-[2px]">{appName} Access Terminal</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600"
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-[13px] font-bold leading-relaxed">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleLogin} className="space-y-2.5 md:space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-left">
            <p className="text-[11px] font-black uppercase tracking-[1.5px] text-blue-700">Static Admin Login</p>
            <p className="mt-1 text-[12px] sm:text-[13px] font-semibold text-blue-900">
              Email: {STATIC_ADMIN_EMAIL} | Password: {STATIC_ADMIN_PASSWORD}
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative group">
              <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-all">
                <Mail size={20} strokeWidth={2} />
              </div>
              <input
                type="email"
                placeholder="Official Email Address"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-14 sm:pl-16 pr-5 sm:pr-6 py-3 md:py-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-3xl text-[15px] md:text-[16px] transition-all font-semibold placeholder:text-gray-300 outline-none"
              />
            </div>
            <div className="relative group">
              <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-all">
                <Lock size={20} strokeWidth={2} />
              </div>
              <input
                type="password"
                placeholder="Security Access Token"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-14 sm:pl-16 pr-5 sm:pr-6 py-3 md:py-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-3xl text-[15px] md:text-[16px] transition-all font-semibold placeholder:text-gray-300 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-2 mb-1 md:mb-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="w-5 h-5 rounded-lg border-gray-200 text-primary focus:ring-primary/20 transition-all"
              />
              <span className="text-[12px] sm:text-[13px] font-bold text-gray-400 group-hover:text-gray-700 transition-colors">
                Trust this device
              </span>
            </label>
            <button
              type="button"
              className="text-[12px] sm:text-[13px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
            >
              Need Help?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full ${isLoading ? 'bg-primary/80' : 'bg-primary'} py-3 md:py-4 rounded-[24px] text-white font-black text-[16px] md:text-[18px] shadow-2xl shadow-primary/30 hover:translate-y-[-2px] hover:shadow-primary/40 active:translate-y-[1px] transition-all flex items-center justify-center gap-3 mt-1 md:mt-3`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : (
              <>
                Initialize Login <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
