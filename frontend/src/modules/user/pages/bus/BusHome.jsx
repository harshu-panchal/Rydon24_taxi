import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Repeat, Calendar, ChevronRight } from 'lucide-react';

const CITIES = ['Indore', 'Bhopal', 'Ujjain', 'Jabalpur', 'Ratlam', 'Pune', 'Mumbai', 'Ahmedabad'];

const BusHome = () => {
  const navigate = useNavigate();
  const [fromCity, setFromCity] = useState('Indore');
  const [toCity, setToCity] = useState('Pune');
  const [date, setDate] = useState('');

  const swapCities = () => {
    const temp = fromCity;
    setFromCity(toCity);
    setToCity(temp);
  };

  const handleSearch = () => {
    if (!date) return alert("Please select a travel date");
    navigate('/bus/list', { state: { fromCity, toCity, date } });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_55%,#F1F5F9_100%)] max-w-lg mx-auto font-sans pb-32 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Intercity Travel</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-none">Bus Booking</h1>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 space-y-4">
        {/* Banner */}
        <div className="rounded-[20px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-5 text-white shadow-[0_10px_26px_rgba(2,6,23,0.22)] flex items-center justify-between">
           <div>
               <p className="text-[10px] font-black text-sky-200 uppercase tracking-widest mb-1">Premium Buses</p>
               <h2 className="text-[18px] font-black leading-tight">Comfortable<br />Intercity Rides</h2>
           </div>
           <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
               <span className="text-2xl">🚌</span>
           </div>
        </div>

        {/* Search Card */}
        <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-white/80 space-y-4 relative">
          
          <div className="absolute left-[33px] top-[48px] bottom-[48px] w-0.5 border-l-2 border-dashed border-slate-200 z-0" />

          {/* From */}
          <div className="relative z-10">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 pl-9">Leaving From</label>
            <div className="mt-1 flex items-center gap-3">
               <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center shrink-0 border border-sky-200 shadow-sm">
                  <div className="w-2 h-2 bg-sky-600 rounded-full" />
               </div>
               <select
                 value={fromCity}
                 onChange={e => setFromCity(e.target.value)}
                 className="flex-1 bg-slate-50 border border-slate-100 rounded-[14px] px-4 py-3 text-[16px] font-black text-slate-900 focus:outline-none focus:border-sky-300"
               >
                 {CITIES.filter(c => c !== toCity).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
          </div>

          <div className="flex justify-center relative z-20 -my-2 pl-9">
            <div className="bg-white p-1 rounded-full border border-slate-100 absolute -translate-x-[50%] left-[-16px]">
                <button onClick={swapCities} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center active:scale-95 shadow-sm">
                   <Repeat size={14} className="text-slate-500" />
                </button>
            </div>
          </div>

          {/* To */}
          <div className="relative z-10 pt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 pl-9">Going To</label>
            <div className="mt-1 flex items-center gap-3">
               <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
               </div>
               <select
                 value={toCity}
                 onChange={e => setToCity(e.target.value)}
                 className="flex-1 bg-slate-50 border border-slate-100 rounded-[14px] px-4 py-3 text-[16px] font-black text-slate-900 focus:outline-none focus:border-sky-300"
               >
                 {CITIES.filter(c => c !== fromCity).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-white/90 rounded-[20px] p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em] flex items-center gap-1.5 ml-1 mb-2">
             <Calendar size={12} strokeWidth={2.5} className="text-slate-400" /> Date of Journey
           </label>
           <input
               type="date"
               value={date}
               min={new Date().toISOString().split('T')[0]}
               onChange={e => setDate(e.target.value)}
               className="w-full bg-slate-50 border border-slate-100 rounded-[16px] px-4 py-3.5 text-[15px] font-bold text-slate-900 focus:outline-none focus:border-sky-300 shadow-sm"
           />
        </div>

      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSearch}
            className="w-full bg-slate-900 text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(2,6,23,0.22)] active:scale-95 transition-all"
        >
          Search Buses <ChevronRight size={18} strokeWidth={3} className="opacity-80" />
        </motion.button>
      </div>

    </div>
  );
};

export default BusHome;
