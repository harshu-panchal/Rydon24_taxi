import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

// Generate mock seats (10 rows, 2x2 layout)
const generateSeats = () => {
  const seats = [];
  const rows = 10;
  for (let r = 1; r <= rows; r++) {
    const isLastRow = r === rows;
    // Row layout: Left Window (W), Left Aisle (A), [Aisle Space], Right Aisle (A), Right Window (W)
    seats.push({ id: `${r}A`, label: `${r}A`, status: Math.random() > 0.7 ? 'booked' : 'available', type: 'W' });
    seats.push({ id: `${r}B`, label: `${r}B`, status: Math.random() > 0.8 ? 'booked' : 'available', type: 'A' });
    
    if (isLastRow) {
      // The back row covers the aisle
      seats.push({ id: `${r}M`, label: `${r}M`, status: Math.random() > 0.9 ? 'booked' : 'available', type: 'M' });
    } else {
      seats.push(null); // Aisle
    }

    seats.push({ id: `${r}C`, label: `${r}C`, status: Math.random() > 0.7 ? 'booked' : 'available', type: 'A' });
    seats.push({ id: `${r}D`, label: `${r}D`, status: Math.random() > 0.8 ? 'booked' : 'available', type: 'W' });
  }
  return seats;
};

const INITIAL_SEATS = generateSeats();

const BusSeats = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const { bus, fromCity, toCity, date } = state;

  const [seats, setSeats] = useState(INITIAL_SEATS);

  if (!bus) {
    navigate('/bus');
    return null;
  }

  const toggleSeat = (id) => {
    setSeats(prev => prev.map(s => {
      if (!s || s.id !== id || s.status === 'booked') return s;
      return { ...s, status: s.status === 'selected' ? 'available' : 'selected' };
    }));
  };

  const selectedSeats = seats.filter(s => s && s.status === 'selected');
  const totalFare = selectedSeats.length * bus.price;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_40%,#F1F5F9_100%)] max-w-lg mx-auto font-sans pb-32">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">Select Seats</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{bus.operator}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 flex flex-col items-center">
         
         <div className="w-full max-w-[280px] bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-slate-100 relative">
             
             {/* Steering Wheel Area */}
             <div className="flex justify-between items-center mb-6 pb-6 border-b-2 border-dashed border-slate-100">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-2 py-1 bg-slate-50 rounded">Lower Deck</span>
                <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-r-transparent border-b-transparent transform rotate-45 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
                </div>
             </div>

             {/* Seat Layout (Grid) */}
             <div className="grid grid-cols-5 gap-3">
                {seats.map((seat, i) => {
                    if (!seat) return <div key={`empty-${i}`} className="w-full" />; // Aisle
                    
                    return (
                        <motion.button
                           key={seat.id}
                           whileTap={seat.status !== 'booked' ? { scale: 0.85 } : {}}
                           onClick={() => toggleSeat(seat.id)}
                           className={`aspect-square w-full rounded-[8px] flex items-center justify-center border-2 transition-all relative
                             ${seat.status === 'booked' ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-50' : 
                               seat.status === 'selected' ? 'bg-slate-900 border-slate-900 shadow-[0_6px_16px_rgba(2,6,23,0.22)]' : 
                               'bg-white border-slate-300 hover:border-sky-300'}
                           `}
                        >
                           {/* Seat recline visual indicator */}
                           <div className={`absolute -top-1 w-full h-2 rounded-t-sm transition-colors ${seat.status === 'selected' ? 'bg-sky-400' : 'bg-slate-200'}`} />
                           
                           <span className={`text-[9px] font-black leading-none ${seat.status === 'selected' ? 'text-white' : seat.status === 'booked' ? 'text-slate-400' : 'text-slate-600'}`}>
                             {seat.status === 'booked' ? '×' : seat.id}
                           </span>
                        </motion.button>
                    );
                })}
             </div>
             
             <div className="mt-8 pt-4 border-t border-slate-50 flex justify-between gap-2">
                 <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border-2 bg-white border-slate-300" /><span className="text-[9px] font-bold text-slate-500 uppercase">Avail</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border-2 bg-slate-900 border-slate-900" /><span className="text-[9px] font-bold text-slate-500 uppercase">Selected</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border-2 bg-slate-100 border-slate-200 opacity-50" /><span className="text-[9px] font-bold text-slate-500 uppercase">Booked</span></div>
             </div>
         </div>
         
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <AnimatePresence>
            {selectedSeats.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                 className="pointer-events-auto bg-white/90 rounded-[20px] border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.06)] px-5 py-4 flex items-center justify-between mb-3">
                 <div>
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-0.5">
                       {selectedSeats.length} Seat{selectedSeats.length > 1 ? 's' : ''} Selected
                    </p>
                    <p className="text-[12px] font-bold text-slate-600 leading-tight">
                       {selectedSeats.map(s => s.id).join(', ')}
                    </p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                    <p className="text-[20px] font-black text-slate-900 leading-none">₹{totalFare}</p>
                 </div>
              </motion.div>
            )}
        </AnimatePresence>
        <motion.button
            disabled={selectedSeats.length === 0}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/bus/details', { state: { ...state, selectedSeats, totalFare } })}
            className={`w-full py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
               selectedSeats.length > 0 ? 'bg-slate-900 text-white shadow-[0_10px_26px_rgba(2,6,23,0.22)] active:scale-95' : 'bg-slate-200 text-slate-400'
            }`}
        >
          Proceed <ChevronRight size={18} strokeWidth={3} className={selectedSeats.length > 0 ? 'opacity-80' : 'opacity-40'} />
        </motion.button>
      </div>

    </div>
  );
};

export default BusSeats;
