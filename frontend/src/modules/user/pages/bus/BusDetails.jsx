import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Phone, Mail, ChevronRight, Check, Loader2 } from 'lucide-react';
import userBusService from '../../services/busService';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const BusDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const state = location.state || {};
  const { bus, fromCity, toCity, date, selectedSeats, totalFare } = state;
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const unwrapPayload = (response) => response?.data?.data || response?.data || response || {};

  if (!bus || !selectedSeats?.length) {
    navigate(`${routePrefix}/bus`, { replace: true });
    return null;
  }

  const handleContinue = async () => {
    if (isPaying) return;

    if (!name || !age || !phone || !email) {
      setError('Please fill in all passenger details.');
      return;
    }

    setError('');
    setIsPaying(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load');
      }

      const passenger = { name, age, gender, phone, email };
      const orderResponse = await userBusService.createBookingOrder({
        busServiceId: bus.busServiceId,
        scheduleId: bus.scheduleId,
        travelDate: date,
        seatIds: selectedSeats.map((seat) => seat.id),
        passenger,
      });
      const order = unwrapPayload(orderResponse);

      if (!order.keyId || !order.orderId) {
        throw new Error('Unable to start bus payment');
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: bus.operator || 'Bus Booking',
        description: `${fromCity} to ${toCity}`,
        order_id: order.orderId,
        prefill: {
          name,
          email,
          contact: phone,
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
        theme: {
          color: '#C2410C',
        },
        handler: async (response) => {
          try {
            const verifyResponse = await userBusService.verifyBookingPayment(response);
            const booking = unwrapPayload(verifyResponse);
            navigate(`${routePrefix}/bus/confirm`, {
              replace: true,
              state: {
                booking,
                fromCity,
                toCity,
                date,
              },
            });
          } catch (verifyError) {
            setError(verifyError?.message || 'Payment verification failed');
            setIsPaying(false);
          }
        },
      });

      rzp.on('payment.failed', (event) => {
        const message = event?.error?.description || event?.error?.reason || 'Payment failed';
        setError(message);
        setIsPaying(false);
      });

      rzp.open();
    } catch (err) {
      setError(err?.message || 'Unable to continue with payment');
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_18%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-32">
      <div className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">Passenger Details</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {selectedSeats.length} Seat(s) | {fromCity} to {toCity}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">
        <div className="bg-gradient-to-br from-[#7c2d12] via-[#c2410c] to-[#f97316] rounded-[24px] p-5 text-white shadow-[0_10px_26px_rgba(124,45,18,0.24)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] font-black text-orange-100 uppercase tracking-widest mb-1">{date} • {bus.departure}</p>
              <h3 className="text-[18px] font-black leading-tight">{bus.operator}</h3>
              <p className="text-[12px] font-bold text-orange-50/80 mt-1">{bus.type}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-orange-100 uppercase tracking-widest mb-1">Seats</p>
              <p className="text-[16px] font-black">{selectedSeats.map((seat) => seat.label || seat.id).join(', ')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 space-y-4">
          <h3 className="text-[14px] font-black text-slate-900 mb-2">Primary Passenger</h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-orange-300 transition-colors">
              <User size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="As on ID card"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
              <input
                type="number"
                placeholder="25"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 focus:outline-none focus:border-orange-300 transition-colors"
              />
            </div>
            <div className="flex-[2] space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
              <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1">
                {['Male', 'Female', 'Other'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setGender(item)}
                    className={`flex-1 py-2 text-[12px] font-black rounded-[12px] transition-all ${gender === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 space-y-4">
          <h3 className="text-[14px] font-black text-slate-900 mb-2 flex justify-between items-center">
            Contact Details
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 px-2 py-1 rounded-full">For Tickets</span>
          </h3>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-orange-300 transition-colors">
              <Phone size={16} className="text-slate-400" />
              <input
                type="tel"
                placeholder="10-digit number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email ID</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus-within:border-orange-300 transition-colors">
              <Mail size={16} className="text-slate-400" />
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flex-1 bg-transparent border-none text-[14px] font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <div className="bg-white/90 rounded-[20px] border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.06)] px-5 py-3 flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amount to Pay</p>
            <p className="text-[22px] font-black text-slate-900 leading-none">₹{Number(totalFare || 0)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Check size={14} className="text-green-500" strokeWidth={3} />
            <p className="text-[11px] font-bold text-slate-600">Taxes inc.</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={isPaying}
          className="w-full bg-slate-900 text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(15,23,42,0.2)] active:scale-95 transition-all disabled:opacity-70"
        >
          {isPaying ? <Loader2 size={18} className="animate-spin" /> : 'Pay with Razorpay'}
          {!isPaying ? <ChevronRight size={18} strokeWidth={3} className="opacity-80" /> : null}
        </motion.button>
      </div>
    </div>
  );
};

export default BusDetails;
