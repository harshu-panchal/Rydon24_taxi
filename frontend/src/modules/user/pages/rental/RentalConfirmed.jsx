import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, MapPin, Clock, Camera, Home, Upload } from 'lucide-react';

const RentalConfirmed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  if (!state.vehicle) { navigate('/rental'); return null; }

  const { vehicle, duration, pickup, returnTime, totalCost, deposit } = state;
  const [conditionPhoto, setConditionPhoto] = useState(null);
  const inputRef = useRef();

  const bookingId = `RNT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-28 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />

      <div className="px-5 pt-14 space-y-5">
        {/* Success hero */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.15)]">
            <CheckCircle2 size={32} className="text-emerald-500" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Booking Confirmed</p>
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight mt-0.5">You're all set!</h1>
            <p className="text-[12px] font-bold text-slate-400 mt-1">Booking ID: <span className="text-slate-700 font-black">{bookingId}</span></p>
          </div>
        </motion.div>

        {/* Vehicle summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${vehicle.gradientFrom} 0%, ${vehicle.gradientTo} 100%)` }}>
            <img src={vehicle.image} alt={vehicle.name} className="h-16 w-20 object-contain drop-shadow-lg shrink-0" />
            <div>
              <p className="text-[15px] font-black text-slate-900">{vehicle.name}</p>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">{duration}</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5 border-t border-slate-50">
            <div className="flex items-center gap-2.5">
              <Clock size={13} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-[11px] font-black text-slate-700">Pickup: {pickup?.slice(0, 16).replace('T', ' ')}</p>
                <p className="text-[11px] font-bold text-slate-400">Return: {returnTime?.slice(0, 16).replace('T', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin size={13} className="text-orange-400 shrink-0" />
              <p className="text-[11px] font-black text-slate-700">Rydon24 Hub — Sector 12, City Center</p>
            </div>
            <div className="border-t border-slate-50 pt-2.5 flex justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400">Rental cost (at pickup)</p>
                <p className="text-[15px] font-black text-slate-900">₹{totalCost}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400">Deposit paid</p>
                <p className="text-[15px] font-black text-emerald-600">₹{deposit}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Condition photo upload */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[9px] bg-orange-50 flex items-center justify-center">
              <Camera size={13} className="text-orange-500" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Condition Photo at Pickup</p>
          </div>
          <p className="text-[12px] font-bold text-slate-400">Capture the vehicle condition before you ride. This protects you during return inspection.</p>
          {conditionPhoto ? (
            <div className="relative rounded-[14px] overflow-hidden">
              <img src={URL.createObjectURL(conditionPhoto)} alt="condition" className="w-full h-40 object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-white" strokeWidth={2} />
              </div>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] border-2 border-dashed border-slate-200 text-[12px] font-black text-slate-500 active:bg-slate-50 transition-all">
              <Upload size={14} strokeWidth={2.5} /> Upload Condition Photo
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => setConditionPhoto(e.target.files?.[0])} />
        </motion.div>

        {/* Deposit refund note */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-start gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="w-8 h-8 rounded-[10px] bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 size={15} className="text-emerald-500" strokeWidth={2} />
          </div>
          <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
            After return & inspection, your ₹{deposit} deposit will be refunded within 24–48 hours.
          </p>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/')}
          className="pointer-events-auto w-full bg-slate-900 py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2">
          <Home size={16} strokeWidth={2.5} /> Back to Home
        </motion.button>
      </div>
    </div>
  );
};

export default RentalConfirmed;
