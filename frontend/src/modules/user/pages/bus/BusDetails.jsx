import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Mail, ChevronRight, Check } from 'lucide-react';

const BusDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const { bus, fromCity, toCity, date, selectedSeats, totalFare } = state;

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!bus || !selectedSeats) {
    navigate('/bus');
    return null;
  }

  const handleContinue = () => {
    if (!name || !age || !phone || !email) {
      alert("Please fill in all passenger details.");
      return;
    }
    const passenger = { name, age, gender, phone, email };
    navigate('/bus/confirm', { state: { ...state, passenger } });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_40%,#F1F5F9_100%)] max-w-lg mx-auto font-sans pb-32">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">Passenger Details</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{selectedSeats.length} Seat(s) | {fromCity} → {toCity}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">
         
         {/* Summary Banner */}
         <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 rounded-[24px] p-5 text-white shadow-[0_10px_26px_rgba(2,6,23,0.22)] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none" />
             <div className="flex justify-between items-start relative z-10">
                <div>
                   <p className="text-[10px] font-black text-sky-200 uppercase tracking-widest mb-1">{date} · {bus.departure}</p>
                   <h3 className="text-[18px] font-black leading-tight">{bus.operator}</h3>
                   <p className="text-[12px] font-bold text-slate-200 mt-1">{bus.type}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-sky-200 uppercase tracking-widest mb-1">Seats</p>
                   <p className="text-[16px] font-black">{selectedSeats.map(s => s.id).join(', ')}</p>
                </div>
             </div>
         </div>

         {/* Primary Passenger Form */}
         <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 space-y-4">
             <h3 className="text-[14px] font-black text-slate-900 mb-2">Primary Passenger</h3>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-sky-300 transition-colors">
                   <User size={16} className="text-slate-400" />
                   <input type="text" placeholder="As on ID card" value={name} onChange={e => setName(e.target.value)}
                      className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300" />
                </div>
             </div>
             
             <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                   <input type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 focus:outline-none focus:border-sky-300 transition-colors" />
                </div>
                <div className="flex-[2] space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                   <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1">
                      {['Male', 'Female'].map(g => (
                         <button key={g} type="button" onClick={() => setGender(g)}
                            className={`flex-1 py-2 text-[12px] font-black rounded-[12px] transition-all ${gender === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                            {g}
                         </button>
                      ))}
                   </div>
                </div>
             </div>
         </div>

         {/* Contact Details Form */}
         <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 space-y-4">
             <h3 className="text-[14px] font-black text-slate-900 mb-2 flex justify-between items-center">
               Contact Details
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 px-2 py-1 rounded-full">For Tickets</span>
             </h3>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-sky-300 transition-colors">
                   <Phone size={16} className="text-slate-400" />
                   <input type="tel" placeholder="10-digit number" value={phone} onChange={e => setPhone(e.target.value)}
                      className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300" />
                </div>
             </div>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email ID</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-sky-300 transition-colors">
                   <Mail size={16} className="text-slate-400" />
                   <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)}
                      className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300" />
                </div>
             </div>
         </div>
         
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <div className="bg-white/90 rounded-[20px] border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.06)] px-5 py-3 flex items-center justify-between mb-3">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amount to Pay</p>
              <p className="text-[22px] font-black text-slate-900 leading-none">₹{totalFare}</p>
           </div>
           <div className="flex items-center gap-1.5">
              <Check size={14} className="text-green-500" strokeWidth={3} />
              <p className="text-[11px] font-bold text-slate-600">Taxes inc.</p>
           </div>
        </div>

        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleContinue}
            className="w-full bg-slate-900 text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(15,23,42,0.2)] active:scale-95 transition-all"
        >
          Review & Pay <ChevronRight size={18} strokeWidth={3} className="opacity-80" />
        </motion.button>
      </div>

    </div>
  );
};

export default BusDetails;
