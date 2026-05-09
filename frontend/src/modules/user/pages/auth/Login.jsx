import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import AuthLayout from '../../components/AuthLayout';
import { Phone } from 'lucide-react';
import { getLocalUserToken, userAuthService } from '../../services/authService';
import { useSettings } from '../../../../shared/context/SettingsContext';

const Login = () => {
  const location = useLocation();
  const { settings } = useSettings();
  const [phoneNumber, setPhoneNumber] = useState(() => String(location.state?.phone || '').replace(/\D/g, '').slice(-10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => String(location.state?.error || ''));
  const navigate = useNavigate();
  const appName = settings.general?.app_name || 'App';
  const userHomeRoute = useMemo(
    () => (location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '/user'),
    [location.pathname],
  );

  const isValidPhone = phoneNumber.length === 10 && /^\d+$/.test(phoneNumber);

  useEffect(() => {
    const token = getLocalUserToken();
    if (!token) {
      return;
    }

    navigate(userHomeRoute, { replace: true });
  }, [navigate, userHomeRoute]);

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
      subtitle={`Join ${appName} for fast, safe, and premium rides across the city.`}
    >
      <form onSubmit={handleLogin} className="space-y-8">
        <div className="space-y-4">
          <label htmlFor="phone" className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Mobile Number
          </label>
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 via-orange-500 to-magenta-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000 group-focus-within:duration-200"></div>
            <div className="relative flex items-center gap-3 bg-white rounded-2xl p-4 transition-all border-2 border-gray-50 focus-within:border-yellow-400/50 shadow-sm">
              <div className="flex items-center gap-2 pr-3 border-r-2 border-gray-100">
                <img src="https://flagcdn.com/w40/in.png" alt="India" className="w-5 h-3.5 object-cover rounded-sm" />
                <span className="text-[15px] font-bold text-gray-800 tracking-tight">+91</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <Phone size={18} className="text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                <input 
                  type="tel" 
                  id="phone"
                  autoFocus
                  maxLength={10}
                  placeholder="00000 00000"
                  className="w-full bg-transparent border-none text-[17px] font-bold text-gray-900 placeholder:text-gray-200 focus:outline-none tracking-[0.1em]"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
          whileTap={{ scale: 0.98 }}
          disabled={!isValidPhone || loading}
          className={`w-full py-5 rounded-2xl text-[14px] font-black transition-all flex items-center justify-center gap-3 shadow-2xl ${
            isValidPhone && !loading
            ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-magenta-500 text-white shadow-orange-500/30' 
            : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span className="tracking-tight uppercase">Sending...</span>
            </div>
          ) : (
            <span className="uppercase tracking-[0.15em]">Get Verification Code</span>
          )}
        </motion.button>

        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold text-red-500 text-center bg-red-50 py-3 rounded-xl border border-red-100"
          >
            {error}
          </motion.p>
        )}

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black">
            <span className="bg-white px-6 text-gray-300">Secure Login</span>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            type="button" 
            className="w-full py-4 rounded-2xl border-2 border-gray-50 flex items-center justify-center gap-4 hover:bg-gray-50 hover:border-blue-100 transition-all group shadow-sm bg-white"
          >
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-black text-gray-500 group-hover:text-black uppercase tracking-wider">Continue with Google</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-400 font-bold text-center leading-relaxed px-4 mt-8">
           By continuing, you agree to our 
           <Link to="/terms" className="text-black hover:text-orange-500 transition-colors mx-1 underline decoration-2 decoration-yellow-400 underline-offset-4">Terms</Link> & 
           <Link to="/privacy" className="text-black hover:text-orange-500 transition-colors mx-1 underline decoration-2 decoration-yellow-400 underline-offset-4">Privacy Policy</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
