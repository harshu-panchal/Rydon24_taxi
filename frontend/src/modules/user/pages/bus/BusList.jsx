import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Star, ChevronRight, Wind } from 'lucide-react';

const BUSES = [
  { id: 'b1', operator: 'Hans Travels', type: 'A/C Sleeper (2+1)', departure: '21:30', arrival: '06:00', duration: '8h 30m', rating: 4.5, price: 850, seats: 12 },
  { id: 'b2', operator: 'Orange Tours', type: 'Non A/C Seater (2+2)', departure: '22:00', arrival: '06:30', duration: '8h 30m', rating: 4.1, price: 550, seats: 24 },
  { id: 'b3', operator: 'NueGo Electric', type: 'A/C Seater (2+2)', departure: '23:15', arrival: '07:15', duration: '8h 00m', rating: 4.8, price: 650, seats: 8 },
  { id: 'b4', operator: 'Chartered Bus', type: 'Volvo Multi-Axle Sleeper', departure: '23:45', arrival: '08:00', duration: '8h 15m', rating: 4.6, price: 1200, seats: 5 },
];

const BusList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const { fromCity, toCity, date } = state;

  if (!fromCity) {
    navigate('/bus');
    return null;
  }

  const handleSelect = (bus) => {
    navigate('/bus/seats', { state: { ...state, bus } });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_40%,#F1F5F9_100%)] max-w-lg mx-auto font-sans pb-10">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">{fromCity} to {toCity}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{date} · {BUSES.length} Buses found</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {BUSES.map((bus, i) => (
          <motion.div
            key={bus.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleSelect(bus)}
            className="bg-white/90 rounded-[20px] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[16px] font-black text-slate-900 leading-tight">{bus.operator}</h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                   {bus.type.includes('A/C') && <Wind size={10} className="text-blue-400" />} {bus.type}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-green-50 border border-green-100 rounded-[8px] px-2 py-1">
                <Star size={10} className="text-green-600 fill-green-600" />
                <span className="text-[10px] font-black text-green-700">{bus.rating}</span>
              </div>
            </div>

            <div className="flex justify-between items-end">
               <div className="flex items-center gap-4">
                 <div>
                    <p className="text-[18px] font-black text-slate-900 leading-none">{bus.departure}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{fromCity}</p>
                 </div>
                 <div className="flex flex-col items-center gap-1 px-2">
                    <p className="text-[9px] font-black text-slate-400">{bus.duration}</p>
                    <div className="w-12 h-px bg-slate-200 relative">
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                    </div>
                 </div>
                 <div>
                    <p className="text-[18px] font-black text-slate-900 leading-none">{bus.arrival}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{toCity}</p>
                 </div>
               </div>

               <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">{bus.seats} Seats Left</p>
                  <p className="text-[20px] font-black text-slate-900 leading-none">₹{bus.price}</p>
               </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
               <p className="text-[10px] font-bold text-slate-400">Amenities: WiFi, Water, Charging</p>
               <div className="flex items-center gap-1 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  Select Seats <ChevronRight size={14} strokeWidth={3} />
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BusList;
