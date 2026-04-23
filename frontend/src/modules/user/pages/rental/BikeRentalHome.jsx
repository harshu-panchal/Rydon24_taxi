import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Fuel, Shield, ChevronRight, Star, Info, Clock } from 'lucide-react';

const DURATION_TABS = ['Hourly', 'Half-Day', 'Daily'];

const vehicles = [
  {
    id: 'activa',
    name: 'Honda Activa 6G',
    tag: '⚡ Most Popular',
    tagColor: 'text-orange-500',
    tagBg: 'bg-orange-50 border-orange-100',
    image: '/2_AutoRickshaw.png',
    rating: '4.8',
    fuel: 'Petrol · Full tank provided',
    prices: { Hourly: 59, 'Half-Day': 249, Daily: 399 },
    kmLimit: { Hourly: '20 km', 'Half-Day': '80 km', Daily: '150 km' },
    features: ['Helmet included', 'GPS tracking', '24/7 roadside assist'],
    gradientFrom: '#FFF7ED',
    gradientTo: '#FFFFFF',
  },
  {
    id: 'splendor',
    name: 'Hero Splendor+',
    tag: '💸 Best Value',
    tagColor: 'text-emerald-600',
    tagBg: 'bg-emerald-50 border-emerald-100',
    image: '/1_Bike.png',
    rating: '4.6',
    fuel: 'Petrol · Full tank provided',
    prices: { Hourly: 45, 'Half-Day': 189, Daily: 299 },
    kmLimit: { Hourly: '25 km', 'Half-Day': '100 km', Daily: '180 km' },
    features: ['Helmet included', 'GPS tracking'],
    gradientFrom: '#F0FDF4',
    gradientTo: '#FFFFFF',
  },
  {
    id: 'pulsar',
    name: 'Bajaj Pulsar 150',
    tag: '🏍️ Sport Ride',
    tagColor: 'text-blue-600',
    tagBg: 'bg-blue-50 border-blue-100',
    image: '/1_Bike.png',
    rating: '4.7',
    fuel: 'Petrol · Full tank provided',
    prices: { Hourly: 79, 'Half-Day': 349, Daily: 549 },
    kmLimit: { Hourly: '30 km', 'Half-Day': '100 km', Daily: '200 km' },
    features: ['Helmet included', 'GPS tracking', 'Insurance covered'],
    gradientFrom: '#EFF6FF',
    gradientTo: '#FFFFFF',
  },
  {
    id: 'royal-enfield',
    name: 'Royal Enfield Classic 350',
    tag: '👑 Premium',
    tagColor: 'text-purple-600',
    tagBg: 'bg-purple-50 border-purple-100',
    image: '/1_Bike.png',
    rating: '4.9',
    fuel: 'Petrol · Full tank provided',
    prices: { Hourly: 149, 'Half-Day': 599, Daily: 999 },
    kmLimit: { Hourly: '30 km', 'Half-Day': '100 km', Daily: '200 km' },
    features: ['Helmet included', 'GPS tracking', 'Insurance covered', 'Priority support'],
    gradientFrom: '#FDF4FF',
    gradientTo: '#FFFFFF',
  },
];

const infoBanner = {
  Hourly: 'Minimum 2 hours · Extra km charged ₹3/km',
  'Half-Day': '6 hours · Extra km charged ₹2.5/km',
  Daily: '24 hours · Extra km charged ₹2/km · Free return pickup',
};

const durationSuffix = { Hourly: '/hr', 'Half-Day': '/6hr', Daily: '/day' };

const BikeRentalHome = () => {
  const [selectedDuration, setSelectedDuration] = useState('Hourly');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans relative overflow-hidden pb-12">

      {/* Ambient blobs */}
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-28 right-[-40px] h-40 w-40 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Self-drive · No driver needed</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-tight">Bike Rentals</h1>
          </div>
          <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-600 shadow-sm shrink-0">
            {vehicles.length} bikes
          </div>
        </div>

        {/* Duration Tabs */}
        <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-[16px]">
          {DURATION_TABS.map(tab => (
            <motion.button
              key={tab}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedDuration(tab)}
              className={`flex-1 py-2 rounded-[12px] text-[11px] font-black uppercase tracking-widest transition-all ${
                selectedDuration === tab
                  ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.08)]'
                  : 'text-slate-400'
              }`}
            >
              {tab}
            </motion.button>
          ))}
        </div>
      </motion.header>

      <div className="px-5 pt-4 space-y-4">

        {/* Info Banner */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDuration}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22 }}
            className="flex items-center gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
          >
            <div className="w-7 h-7 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
              <Info size={14} className="text-blue-500" strokeWidth={2.5} />
            </div>
            <p className="text-[12px] font-black text-slate-700">{infoBanner[selectedDuration]}</p>
          </motion.div>
        </AnimatePresence>

        {/* Section label */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Available Bikes</p>
          <h2 className="mt-0.5 text-[16px] font-black tracking-tight text-slate-900">Choose your ride</h2>
        </div>

        {/* Vehicle Cards */}
        {vehicles.map((v, idx) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: idx * 0.07, ease: 'easeOut' }}
            className="rounded-[24px] border border-white/80 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden"
          >
            {/* Top gradient section */}
            <div
              className="px-4 pt-3.5 pb-3 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${v.gradientFrom} 0%, ${v.gradientTo} 100%)` }}
            >
              <div className="flex-1 min-w-0 pr-2 space-y-1">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${v.tagBg} ${v.tagColor}`}>
                  {v.tag}
                </span>
                <h3 className="text-[15px] font-black text-slate-900 leading-tight tracking-tight">{v.name}</h3>
                <div className="flex items-center gap-1">
                  <Star size={10} className="text-yellow-500 fill-yellow-400" />
                  <span className="text-[11px] font-black text-slate-700">{v.rating}</span>
                  <span className="text-[10px] font-bold text-slate-400">· {v.kmLimit[selectedDuration]} limit</span>
                </div>
              </div>
              <img src={v.image} alt={v.name} className="h-20 w-24 object-contain drop-shadow-lg shrink-0 -mt-2 -mb-2" />
            </div>

            {/* Bottom details */}
            <div className="px-4 pb-4 pt-3 space-y-2.5 border-t border-slate-50">
              {/* Feature chips */}
              <div className="flex flex-wrap gap-1">
                {v.features.map(f => (
                  <span key={f} className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">
                    {f}
                  </span>
                ))}
              </div>

              {/* Fuel */}
              <div className="flex items-center gap-1.5">
                <Fuel size={11} className="text-slate-300 shrink-0" />
                <span className="text-[11px] font-bold text-slate-400">{v.fuel}</span>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block">Price</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[22px] font-black text-slate-900 tracking-tighter leading-none">₹{v.prices[selectedDuration]}</span>
                    <span className="text-[11px] font-bold text-slate-400 ml-0.5">{durationSuffix[selectedDuration]}</span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/rental/vehicle', { state: { vehicle: v, duration: selectedDuration } })}
                  className="bg-slate-900 text-white px-4 py-2.5 rounded-[12px] text-[11px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_6px_16px_rgba(15,23,42,0.18)] active:bg-black transition-all"
                >
                  Book Now <ChevronRight size={13} strokeWidth={3} className="opacity-60" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Safety Note */}
        <div className="flex items-center gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="w-8 h-8 rounded-[10px] bg-slate-50 flex items-center justify-center shrink-0">
            <Shield size={15} className="text-slate-400" strokeWidth={2} />
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
            All bikes are insured, regularly serviced, and GPS-tracked. Valid driving license required at pickup.
          </p>
        </div>

      </div>
    </div>
  );
};

export default BikeRentalHome;
