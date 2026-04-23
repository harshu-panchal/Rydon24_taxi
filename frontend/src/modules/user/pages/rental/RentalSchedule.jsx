import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, ChevronRight, Tag } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');

const toDatetimeLocal = (d) => {
  const Y = d.getFullYear(), M = pad(d.getMonth() + 1), D = pad(d.getDate());
  const h = pad(d.getHours()), m = pad(d.getMinutes());
  return `${Y}-${M}-${D}T${h}:${m}`;
};

const RentalSchedule = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { vehicle, duration } = location.state || {};
  if (!vehicle) { navigate('/rental'); return null; }

  const now = new Date();
  const defaultPickup = new Date(now.getTime() + 30 * 60000);
  const defaultReturn = new Date(defaultPickup.getTime() + (duration === 'Hourly' ? 2 : duration === 'Half-Day' ? 6 : 24) * 3600000);

  const [pickup, setPickup] = useState(toDatetimeLocal(defaultPickup));
  const [returnTime, setReturnTime] = useState(toDatetimeLocal(defaultReturn));

  const { hours, totalCost } = useMemo(() => {
    const diff = (new Date(returnTime) - new Date(pickup)) / 3600000;
    const hrs = Math.max(0, diff);
    let cost = 0;
    if (duration === 'Hourly') cost = Math.ceil(hrs) * vehicle.prices['Hourly'];
    else if (duration === 'Half-Day') cost = Math.ceil(hrs / 6) * vehicle.prices['Half-Day'];
    else cost = Math.ceil(hrs / 24) * vehicle.prices['Daily'];
    return { hours: hrs.toFixed(1), totalCost: cost };
  }, [pickup, returnTime, duration, vehicle]);

  const suffix = { Hourly: 'hr', 'Half-Day': '6hr block', Daily: 'day' }[duration];
  const isValid = new Date(returnTime) > new Date(pickup);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-28 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />

      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Step 3 of 5 · {vehicle.name}</p>
            <h1 className="text-[18px] font-black tracking-tight text-slate-900 leading-tight">Date & Duration</h1>
          </div>
        </div>
      </motion.header>

      <div className="px-5 pt-5 space-y-4">
        {/* Pickup */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-[9px] bg-orange-50 flex items-center justify-center">
              <Calendar size={13} className="text-orange-500" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Pickup Date & Time</p>
          </div>
          <input type="datetime-local" value={pickup} min={toDatetimeLocal(now)}
            onChange={e => setPickup(e.target.value)}
            className="w-full bg-slate-50/80 rounded-[14px] px-4 py-3 text-[14px] font-black text-slate-900 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-200" />
        </motion.div>

        {/* Return */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-[9px] bg-blue-50 flex items-center justify-center">
              <Clock size={13} className="text-blue-500" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Return Date & Time</p>
          </div>
          <input type="datetime-local" value={returnTime} min={pickup}
            onChange={e => setReturnTime(e.target.value)}
            className="w-full bg-slate-50/80 rounded-[14px] px-4 py-3 text-[14px] font-black text-slate-900 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          {!isValid && (
            <p className="text-[11px] font-black text-red-500 ml-1">Return time must be after pickup.</p>
          )}
        </motion.div>

        {/* Cost summary */}
        <AnimatePresence mode="wait">
          {isValid && (
            <motion.div key={totalCost} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[9px] bg-emerald-50 flex items-center justify-center">
                  <Tag size={13} className="text-emerald-500" strokeWidth={2.5} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Cost Estimate</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-bold text-slate-400">{vehicle.name}</p>
                  <p className="text-[12px] font-bold text-slate-400">{hours} hrs · ₹{vehicle.prices[duration]}/{suffix}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</p>
                  <p className="text-[28px] font-black text-slate-900 leading-none">₹{totalCost}</p>
                  <p className="text-[10px] font-bold text-slate-400">+ deposit (refundable)</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button whileTap={{ scale: 0.98 }} disabled={!isValid}
          onClick={() => navigate('/rental/kyc', { state: { vehicle, duration, pickup, returnTime, totalCost } })}
          className={`pointer-events-auto w-full py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2 transition-all ${isValid ? 'bg-slate-900' : 'bg-slate-300'}`}>
          Continue <ChevronRight size={17} strokeWidth={3} className="opacity-50" />
        </motion.button>
      </div>
    </div>
  );
};

export default RentalSchedule;
