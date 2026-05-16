import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../../services/adminService';
import { useSettings } from '../../../../shared/context/SettingsContext';

const InputField = ({ icon: Icon, type, placeholder, value, onChange, ...props }) => (
  <div className="relative group">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
      <Icon size={18} strokeWidth={2} />
    </div>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
      {...props}
    />
  </div>
);

const AdminLogin = () => {
  const { settings } = useSettings();
  const [view, setView] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const appLogo = settings.general?.logo || settings.customization?.logo;
  const appName = settings.general?.app_name || 'Rydon24';

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    resetMessages();

    try {
      const response = await adminService.login({ email, password });
      localStorage.setItem('adminToken', response?.data?.token || '');
      localStorage.setItem('adminInfo', JSON.stringify(response?.data?.admin || {}));
      setTimeout(() => navigate('/admin/dashboard'), 300);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-['Inter'] overflow-hidden">
      {/* Immersive Background / Decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-slate-50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-slate-100 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] space-y-8"
        >
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="cursor-pointer"
              onClick={() => navigate('/')}
            >
              {appLogo ? (
                <img src={appLogo} alt={appName} className="h-14 w-auto object-contain" />
              ) : (
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                   <ShieldCheck size={24} />
                </div>
              )}
            </motion.div>
            
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Access Terminal</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{appName} Cloud Infrastructure</p>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative">
             {isLoading && (
               <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
                 <div className="h-full bg-slate-900 animate-[loading_1.5s_infinite_linear]" style={{ width: '40%' }} />
               </div>
             )}

             <AnimatePresence mode="wait">
               {error && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   exit={{ opacity: 0, height: 0 }}
                   className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600"
                 >
                   <AlertCircle size={18} className="shrink-0" />
                   <p className="text-xs font-bold leading-none">{error}</p>
                 </motion.div>
               )}
             </AnimatePresence>

             <AnimatePresence mode="wait">
               {view === 'login' ? (
                 <motion.form 
                   key="login"
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -10 }}
                   onSubmit={handleLogin}
                   className="space-y-5"
                 >
                   <InputField 
                     icon={Mail} 
                     type="email" 
                     placeholder="Administrator Email" 
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     required
                   />
                   <div className="space-y-2">
                     <InputField 
                       icon={Lock} 
                       type="password" 
                       placeholder="Security Token" 
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       required
                     />
                     <div className="flex justify-end">
                       <button 
                         type="button" 
                         onClick={() => { setView('forgot-email'); resetMessages(); }}
                         className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                       >
                         Forgot Credentials?
                       </button>
                     </div>
                   </div>

                   <button
                     type="submit"
                     disabled={isLoading}
                     className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                     {isLoading ? <Loader2 className="animate-spin" size={18} /> : <>Initialize Access <ArrowRight size={18} /></>}
                   </button>
                 </motion.form>
               ) : (
                 <motion.div
                   key="forgot"
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -10 }}
                   className="space-y-5"
                 >
                    <div className="text-center pb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest Identity Recovery" />
                    </div>
                    <InputField 
                      icon={Mail} 
                      type="email" 
                      placeholder="Registered Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      Send Recovery Code
                    </button>
                    <button 
                      onClick={() => setView('login')}
                      className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Terminal
                    </button>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            This is a secure system. All access attempts are logged.<br/>
            Authorized personnel only.
          </p>
        </motion.div>
      </main>

      <footer className="p-8 text-center relative z-10">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">&copy; 2026 {appName} Security Operations</p>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;
