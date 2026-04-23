import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Fuel, Shield, ChevronRight, MapPin, Clock, CheckCircle2 } from 'lucide-react';

const RentalVehicleDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { vehicle, duration } = location.state || {};

  if (!vehicle) { navigate('/rental'); return null; }

  const price = vehicle.prices[duration];
  const suffix = { Hourly: '/hr', 'Half-Day': '/6hr', Daily: '/day' }[duration];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-28 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Vehicle Details</p>
            <h1 className="text-[18px] font-black tracking-tight text-slate-900 leading-tight truncate">{vehicle.name}</h1>
          </div>
        </div>
      </motion.header>

      <div className="px-5 pt-5 space-y-4">
        {/* Hero image card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-[24px] border border-white/80 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${vehicle.gradientFrom} 0%, ${vehicle.gradientTo} 100%)` }}>
            <img src={vehicle.image} alt={vehicle.name} className="h-36 object-contain drop-shadow-xl" />
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${vehicle.tagBg} ${vehicle.tagColor} mb-1.5`}>{vehicle.tag}</span>
                <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-tight">{vehicle.name}</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-400" />
                  <span className="text-[13px] font-black text-slate-700">{vehicle.rating}</span>
                  <span className="text-[11px] font-bold text-slate-400">· {vehicle.kmLimit[duration]} limit</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Rate</p>
                <p className="text-[24px] font-black text-slate-900 leading-none">₹{price}</p>
                <p className="text-[11px] font-bold text-slate-400">{suffix}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">What's included</p>
          <div className="space-y-2">
            {vehicle.features.map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                <span className="text-[13px] font-bold text-slate-700">{f}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5">
              <Fuel size={14} className="text-slate-400 shrink-0" strokeWidth={2} />
              <span className="text-[13px] font-bold text-slate-500">{vehicle.fuel}</span>
            </div>
          </div>
        </motion.div>

        {/* Pickup info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Pickup Point</p>
          <div className="flex items-start gap-2.5">
            <MapPin size={15} className="text-orange-400 shrink-0 mt-0.5" strokeWidth={2.5} />
            <div>
              <p className="text-[13px] font-black text-slate-800">Rydon24 Hub — Sector 12, City Center</p>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">Open 6 AM – 10 PM · Condition photos required at pickup</p>
            </div>
          </div>
        </motion.div>

        {/* Policy */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="w-8 h-8 rounded-[10px] bg-slate-50 flex items-center justify-center shrink-0">
            <Shield size={15} className="text-slate-400" strokeWidth={2} />
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
            Valid driving license required. Refundable security deposit collected at booking.
          </p>
        </motion.div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/rental/schedule', { state: { vehicle, duration } })}
          className="pointer-events-auto w-full bg-slate-900 py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2">
          Select Date & Time <ChevronRight size={17} strokeWidth={3} className="opacity-50" />
        </motion.button>
      </div>
    </div>
  );
};

export default RentalVehicleDetail;
