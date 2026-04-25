import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthLayout from '../../components/AuthLayout';
import { Phone } from 'lucide-react';
import { userAuthService } from '../../services/authService';
import { useSettings } from '../../../../shared/context/SettingsContext';

const Login = () => {
  const location = useLocation();
  const { settings } = useSettings();
  const [phoneNumber, setPhoneNumber] = useState(() => String(location.state?.phone || '').replace(/\D/g, '').slice(-10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => String(location.state?.error || ''));
  const navigate = useNavigate();
  const appName = settings.general?.app_name || 'App';

  const isValidPhone = phoneNumber.length === 10 && /^\d+$/.test(phoneNumber);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isValidPhone) return;

    setLoading(true);
    setError('');

    try {
      await userAuthService.startOtp(phoneNumber);
      setLoading(false);
      navigate('/taxi/user/verify-otp', {
        state: {
          phone: phoneNumber,
        },
      });
    } catch (err) {
      setError(err?.message || 'Unable to send OTP. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Enter your mobile number" 
      subtitle={`Fast. Affordable. Local rides with ${appName}.`}
    >
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <label htmlFor="phone" className="text-sm font-semibold text-gray-700 tracking-tight ml-1">
            Mobile Number
          </label>
            <div className="flex items-center gap-3 bg-[#F6F6F6] rounded-2xl p-4 focus-within:ring-2 focus-within:ring-black/5 focus-within:bg-white transition-all border border-transparent">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-200 opacity-70">
               <img src="https://flagcdn.com/w40/in.png" alt="India" className="w-5 h-3.5 object-cover rounded-sm" />
               <span className="text-[15px] font-bold text-gray-800">+91</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
               <Phone size={18} className="text-gray-400 opacity-50" />
               <input 
                  type="tel" 
                  id="phone"
                  autoFocus
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  className="w-full bg-transparent border-none text-[17px] font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
               />
            </div>
          </div>
        </div>

        <motion.button 
          whileTap={{ scale: 0.98 }}
          disabled={!isValidPhone || loading}
          className={`w-full py-4 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-3 ${
            isValidPhone && !loading
            ? 'bg-black text-white shadow-xl shadow-black/10' 
            : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Sending OTP...</span>
            </div>
          ) : (
            <span>Continue</span>
          )}
        </motion.button>

        {error && (
          <p className="text-sm font-bold text-red-500 text-center">{error}</p>
        )}

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
            <span className="bg-white px-4 text-gray-400">or</span>
          </div>
        </div>

        <div className="space-y-3">
          <button type="button" className="w-full py-4 rounded-xl border border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all group">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span className="text-[15px] font-bold text-gray-700 group-hover:text-black">Continue with Google</span>
          </button>
          <button type="button" className="w-full py-4 rounded-xl border border-gray-200 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all group">
            <svg className="w-5 h-5" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            <span className="text-[15px] font-bold text-gray-700 group-hover:text-black">Continue with Apple</span>
          </button>
        </div>

        <p className="text-[12px] text-gray-400 font-medium text-center leading-relaxed px-2 mt-8">
           By continuing, you agree to our 
           <Link to="/terms" className="underline text-black hover:opacity-70 transition-colors ml-1">Terms</Link> & 
           <Link to="/privacy" className="underline text-black hover:opacity-70 transition-colors ml-1">Privacy Policy</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
