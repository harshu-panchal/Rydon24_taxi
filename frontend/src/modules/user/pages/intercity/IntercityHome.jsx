import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, MapPin, Calendar, Users, ChevronRight, Repeat } from 'lucide-react';

const CITIES = ['Indore', 'Bhopal', 'Ujjain', 'Jabalpur', 'Ratlam', 'Dewas', 'Mumbai', 'Delhi', 'Pune'];


const CITY_DISTANCES = {
  'Indore-Bhopal': 195, 'Indore-Ujjain': 55, 'Indore-Jabalpur': 330,
  'Indore-Mumbai': 587, 'Indore-Delhi': 852, 'Indore-Pune': 540,
  'Bhopal-Delhi': 745, 'Bhopal-Ujjain': 186, 'default': 250,
};

const getDistance = (from, to) => {
  const key1 = `${from}-${to}`;
  const key2 = `${to}-${from}`;
  return CITY_DISTANCES[key1] || CITY_DISTANCES[key2] || CITY_DISTANCES.default;
};

const IntercityHome = () => {
  const [tripType, setTripType] = useState('One Way');
  const [fromCity, setFromCity] = useState('Indore');
  const [toCity, setToCity] = useState('Bhopal');
  const [date, setDate] = useState('');
  const navigate = useNavigate();

  const distance = getDistance(fromCity, toCity);

  const swapCities = () => {
    const temp = fromCity;
    setFromCity(toCity);
    setToCity(temp);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] max-w-lg mx-auto font-sans pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-10 pb-6 sticky top-0 z-20 shadow-sm border-b border-gray-50">
        <div className="flex items-center gap-4 mb-1">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 active:scale-90 transition-all">
            <ArrowLeft size={24} className="text-gray-900" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-[22px] font-black text-gray-900 leading-none tracking-tight">Intercity Travel</h1>
            <p className="text-[12px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">City to city cabs</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {/* Trip Type Toggle */}
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          {['One Way', 'Round Trip'].map(t => (
            <button
              key={t}
              onClick={() => setTripType(t)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all ${
                tripType === t ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* City Selector Card */}
        <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-50 space-y-3">
          {/* From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">From</label>
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <select
                value={fromCity}
                onChange={e => setFromCity(e.target.value)}
                className="flex-1 bg-transparent border-none text-[16px] font-black text-gray-900 focus:outline-none"
              >
                {CITIES.filter(c => c !== toCity).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center">
            <button
              onClick={swapCities}
              className="w-10 h-10 bg-gray-50 rounded-full border border-gray-100 flex items-center justify-center active:scale-90 transition-all shadow-sm hover:bg-gray-100"
            >
              <Repeat size={16} className="text-gray-500" />
            </button>
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">To</label>
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <select
                value={toCity}
                onChange={e => setToCity(e.target.value)}
                className="flex-1 bg-transparent border-none text-[16px] font-black text-gray-900 focus:outline-none"
              >
                {CITIES.filter(c => c !== fromCity).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Distance badge */}
          <div className="flex justify-center pt-1">
            <span className="text-[11px] font-black text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
              ~{distance} km · {Math.round(distance / 60)} hr estimated
            </span>
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-50 space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
            <Calendar size={11} strokeWidth={3} /> Travel Date (Select to view pricing)
          </label>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
             <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-transparent border-none text-[16px] font-black text-gray-900 focus:outline-none"
             />
          </div>
        </div>

        {/* CTA */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8F9FB] via-[#F8F9FB]/95 to-transparent z-30">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => date
              ? navigate('/intercity/vehicle', { state: { fromCity, toCity, tripType, date, distance } })
              : alert('Please select a travel date')
            }
            className="w-full bg-[#1C2833] text-white py-4 rounded-2xl text-[16px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
          >
            Select Vehicle <ChevronRight size={18} strokeWidth={3} className="text-yellow-400" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default IntercityHome;
