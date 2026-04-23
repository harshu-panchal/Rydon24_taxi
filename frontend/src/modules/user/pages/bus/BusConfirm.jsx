import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Ticket, QrCode, Home, Calendar, Clock, Share2 } from 'lucide-react';

const generatePNR = () => 'B' + Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

const BusConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const { bus, fromCity, toCity, date, selectedSeats, totalFare, passenger } = state;

  const [pnr] = useState(generatePNR());

  if (!bus || !passenger) {
    navigate('/bus');
    return null;
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bus Ticket',
          text: `Here is my ticket PNR: ${pnr} for bus from ${fromCity} to ${toCity} on ${date}. Seats: ${selectedSeats.map(s => s.id).join(',')}`
        });
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_45%,#F1F5F9_100%)] max-w-lg mx-auto font-sans pb-32">
       {/* Background glow */}
       <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-sky-300/20 blur-[80px] pointer-events-none" />

       {/* Header */}
      <div className="bg-transparent px-5 pt-10 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
            <h1 className="text-[19px] font-black tracking-tight text-slate-900">E-Ticket</h1>
            <button onClick={handleShare} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform text-slate-600">
               <Share2 size={18} strokeWidth={2.5} />
            </button>
        </div>
      </div>

       <div className="px-5 pt-2 flex flex-col items-center">
            <motion.div 
               initial={{ scale: 0, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               transition={{ type: 'spring', damping: 15 }}
               className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-[0_10px_26px_rgba(2,6,23,0.22)] mb-5"
            >
               <CheckCircle2 size={40} className="text-white" strokeWidth={3} />
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center mb-8">
               <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Booking Confirmed</p>
               <h2 className="text-[26px] font-black text-slate-900 leading-tight">Ticket Generated</h2>
            </motion.div>

            {/* Ticket Card */}
            <motion.div 
               initial={{ y: 30, opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }} 
               transition={{ delay: 0.2 }}
               className="w-full bg-white rounded-[24px] shadow-[0_12px_40px_rgba(15,23,42,0.08)] relative overflow-hidden"
            >
               {/* Ticket cutting circles */}
               <div className="absolute left-[-12px] top-[140px] w-6 h-6 rounded-full bg-slate-100 shadow-inner" />
               <div className="absolute right-[-12px] top-[140px] w-6 h-6 rounded-full bg-slate-100 shadow-inner" />
               <div className="absolute left-4 right-4 top-[152px] h-0 border-t-2 border-dashed border-slate-200" />

               {/* Top Section */}
               <div className="p-6 pb-8 bg-slate-900 text-white relative">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Ticket size={80} />
                   </div>
                   <div className="flex justify-between items-center mb-6">
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                         <p className="text-[10px] font-black uppercase text-white/70 tracking-widest leading-none mb-1">PNR No</p>
                         <p className="text-[16px] font-black tracking-[0.1em]">{pnr}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black uppercase text-white/50 tracking-widest leading-none mb-1">Seat(s)</p>
                         <p className="text-[18px] font-black">{selectedSeats.map(s => s.id).join(', ')}</p>
                      </div>
                   </div>

                   <h3 className="text-[18px] font-black leading-tight mb-1">{bus.operator}</h3>
                   <p className="text-[11px] font-bold text-slate-400">{bus.type}</p>
               </div>

               {/* Bottom Section */}
               <div className="p-6 pt-8 space-y-6">
                   <div className="flex items-center justify-between">
                       <div className="flex-1">
                          <p className="text-[20px] font-black text-slate-900 leading-none">{bus.departure}</p>
                          <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">{fromCity}</p>
                       </div>
                       <div className="flex flex-col items-center flex-1">
                          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{bus.duration}</span>
                          <div className="w-16 h-0 border-t-2 border-dashed border-slate-200 my-1 relative">
                             <div className="absolute right-[-4px] top-[-5px] border-t-[4px] border-l-[6px] border-b-[4px] border-transparent border-l-slate-300" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{date}</span>
                       </div>
                       <div className="flex-1 text-right">
                          <p className="text-[20px] font-black text-slate-900 leading-none">{bus.arrival}</p>
                          <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">{toCity}</p>
                       </div>
                   </div>

                   <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Passenger</p>
                         <p className="text-[14px] font-black text-slate-900">{passenger.name} <span className="text-slate-400 font-bold ml-1">({passenger.age}{passenger.gender[0]})</span></p>
                      </div>
                      <QrCode size={40} className="text-slate-800" strokeWidth={1.5} />
                   </div>
               </div>
            </motion.div>

       </div>

       {/* CTA */}
       <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-4 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30 flex gap-3">
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {/* download logic */}}
            className="flex-1 bg-white text-slate-900 py-4 rounded-[18px] text-[13px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(15,23,42,0.05)] border border-slate-100"
        >
          Download PDF
        </motion.button>
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex-[2] bg-slate-900 text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(2,6,23,0.22)] transition-all"
        >
          <Home size={18} strokeWidth={2.5} /> Go to Home
        </motion.button>
      </div>
    </div>
  );
};

export default BusConfirm;
