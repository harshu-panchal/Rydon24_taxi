import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Box, ShieldCheck, ChevronRight, Scale, AlertTriangle, Building2, Route } from 'lucide-react';

const WEIGHT_PRICES = {
  'Under 5kg': { min: 45, max: 80 },
  'Above 5kg': { min: 90, max: 150 },
};

const ParcelDetails = () => {
  const location = useLocation();
  const parcelState = location.state || {};
  const [weight, setWeight] = useState(() => parcelState.weight || 'Under 5kg');
  const [deliveryScope, setDeliveryScope] = useState(() => parcelState.deliveryScope || 'city');
  const [description, setDescription] = useState(() => parcelState.description || '');
  const [descError, setDescError] = useState('');
  const navigate = useNavigate();
  const parcelType = parcelState.parcelType || 'Documents';
  const priceRange = WEIGHT_PRICES[weight];
  const isOutstation = deliveryScope === 'outstation';

  const handleNext = () => {
    if (description.trim().length < 3) {
      setDescError('Please add at least a short description.');
      return;
    }
    setDescError('');
    navigate('/parcel/contacts', {
      state: {
        ...parcelState,
        parcelType,
        weight,
        deliveryScope,
        isOutstation,
        description,
        estimatedFare: priceRange,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto flex flex-col font-sans relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-md px-5 py-4 flex items-center gap-3 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sticky top-0 z-20">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0">
          <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
        </motion.button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">{parcelType}</p>
          <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-tight">Parcel Details</h1>
        </div>
        <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-600 shadow-sm shrink-0">
          Step 2 of 3
        </div>
      </motion.header>

      <div className="flex-1 px-5 pt-5 pb-32 space-y-4 overflow-y-auto no-scrollbar">

        {/* Weight toggle */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Approximate Weight</p>
          <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-1.5 rounded-[16px]">
            {[
              { key: 'Under 5kg', icon: Scale, label: 'Under 5 kg' },
              { key: 'Above 5kg', icon: Box,   label: 'Above 5 kg' },
            ].map(({ key, icon: Icon, label }) => (
              <motion.button key={key} whileTap={{ scale: 0.97 }} onClick={() => setWeight(key)}
                className={`flex flex-col items-center gap-2 py-4 rounded-[13px] transition-all ${
                  weight === key
                    ? 'bg-white shadow-[0_4px_12px_rgba(15,23,42,0.08)] text-slate-900'
                    : 'text-slate-400'
                }`}>
                <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center transition-all ${
                  weight === key ? 'bg-orange-500 shadow-[0_4px_10px_rgba(249,115,22,0.25)]' : 'bg-slate-100'
                }`}>
                  <Icon size={17} className={weight === key ? 'text-white' : 'text-slate-400'} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-black uppercase tracking-tight">{label}</span>
              </motion.button>
            ))}
          </div>

          {/* Price preview */}
          <AnimatePresence mode="wait">
            <motion.div key={weight}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-[14px] px-3.5 py-2.5">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <p className="text-[12px] font-black text-emerald-700">
                Estimated fare: <span className="text-emerald-900">₹{priceRange.min} – ₹{priceRange.max}</span>
                <span className="text-[10px] font-bold text-emerald-500 ml-1">based on distance</span>
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] p-4 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Delivery Reach</p>
            <p className="mt-1 text-[12px] font-bold text-slate-500">Choose whether this parcel stays in city or goes outstation.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-1.5 rounded-[16px]">
            {[
              { key: 'city', icon: Building2, label: 'In City', hint: 'Local delivery' },
              { key: 'outstation', icon: Route, label: 'Outstation', hint: 'Outside city' },
            ].map(({ key, icon: Icon, label, hint }) => (
              <motion.button key={key} whileTap={{ scale: 0.97 }} onClick={() => setDeliveryScope(key)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-[13px] transition-all ${
                  deliveryScope === key
                    ? 'bg-white shadow-[0_4px_12px_rgba(15,23,42,0.08)] text-slate-900'
                    : 'text-slate-400'
                }`}>
                <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center transition-all ${
                  deliveryScope === key ? 'bg-slate-900 shadow-[0_4px_10px_rgba(15,23,42,0.18)]' : 'bg-slate-100'
                }`}>
                  <Icon size={17} className={deliveryScope === key ? 'text-white' : 'text-slate-400'} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-black uppercase tracking-tight">{label}</span>
                <span className="text-[10px] font-bold text-slate-400">{hint}</span>
              </motion.button>
            ))}
          </div>
          {isOutstation ? (
            <div className="rounded-[14px] border border-blue-100 bg-blue-50 px-3.5 py-2.5">
              <p className="text-[11px] font-black text-blue-900">Outstation selected</p>
              <p className="mt-1 text-[10px] font-bold text-blue-700">We will pass this parcel as an outstation request and save it with the booking.</p>
            </div>
          ) : null}
        </motion.div>

        {/* Description */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`rounded-[20px] border bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] p-4 space-y-2 transition-all ${
            descError ? 'border-red-200' : 'border-white/80'
          }`}>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">What are you sending?</p>
          <textarea
            rows={3}
            placeholder="e.g. My Laptop Charger and some clothes..."
            value={description}
            onChange={(e) => { setDescription(e.target.value); if (e.target.value.trim().length >= 3) setDescError(''); }}
            className="w-full bg-slate-50/60 rounded-[13px] px-3.5 py-3 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100 placeholder:text-slate-300 resize-none border-none"
          />
          <AnimatePresence>
            {descError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-[11px] font-black text-red-500 flex items-center gap-1.5">
                <AlertTriangle size={11} strokeWidth={3} /> {descError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Restrictions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex items-start gap-3 rounded-[16px] border border-orange-100 bg-orange-50/80 px-4 py-3.5">
          <div className="w-7 h-7 rounded-[9px] bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={13} className="text-orange-500" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Restricted Items</p>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5 leading-relaxed">
              Drugs, Alcohol, Explosives, and items above ₹5,000 are not allowed.
            </p>
          </div>
        </motion.div>

      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button whileTap={{ scale: 0.98 }} onClick={handleNext}
          className="pointer-events-auto w-full bg-slate-900 py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2">
          Sender & Receiver <ChevronRight size={17} strokeWidth={3} className="opacity-50" />
        </motion.button>
      </div>
    </div>
  );
};

export default ParcelDetails;
