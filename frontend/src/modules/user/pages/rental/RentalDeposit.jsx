import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, ShieldCheck, CreditCard, Wallet, Smartphone } from 'lucide-react';
import { userService } from '../../services/userService';

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

const RentalDeposit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [vehicleSnapshot, setVehicleSnapshot] = useState(state.vehicle || null);

  useEffect(() => {
    setVehicleSnapshot(state.vehicle || null);
  }, [state.vehicle]);

  useEffect(() => {
    let mounted = true;

    const refreshVehicle = async () => {
      const vehicleId = state.vehicle?.id;
      if (!vehicleId) return;

      try {
        const response = await userService.getRentalVehicles();
        const results = response?.data?.results || response?.results || [];
        const latestVehicle = results.find(
          (item) => String(item.id || item._id) === String(vehicleId),
        );

        if (mounted && latestVehicle) {
          setVehicleSnapshot((current) => ({
            ...(current || {}),
            ...latestVehicle,
          }));
        }
      } catch {
        // Keep the booking flow usable even if the refresh fails.
      }
    };

    refreshVehicle();

    return () => {
      mounted = false;
    };
  }, [state.vehicle?.id]);

  if (!vehicleSnapshot) {
    navigate('/rental');
    return null;
  }

  const { totalCost, selectedPackage, serviceLocation } = state;
  const vehicle = vehicleSnapshot;
  const advancePayment = vehicle.advancePayment || {};
  const payableNow = useMemo(
    () => (advancePayment.enabled ? Number(advancePayment.amount || 0) : 0),
    [advancePayment.amount, advancePayment.enabled],
  );
  const advancePaymentLabel = advancePayment.label || 'Advance booking payment';
  const [method, setMethod] = useState('upi');
  const [paying, setPaying] = useState(false);

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      navigate('/rental/confirmed', {
        state: { ...state, vehicle, deposit: payableNow },
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-28 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">
              Step 5 of 5 - Advance Payment
            </p>
            <h1 className="text-[18px] font-black tracking-tight text-slate-900 leading-tight">
              Pay Now
            </h1>
          </div>
        </div>
      </motion.header>

      <div className="px-5 pt-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Booking Summary
          </p>
          <div className="flex items-center gap-3">
            <img src={vehicle.image} alt={vehicle.name} className="h-14 w-16 object-contain drop-shadow-md shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-black text-slate-900 leading-tight">{vehicle.name}</p>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                {selectedPackage?.label || state.duration} - {state.pickup?.slice(0, 16).replace('T', ' ')}
              </p>
              {serviceLocation?.name ? (
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                  Pickup: {serviceLocation.name}
                </p>
              ) : null}
            </div>
          </div>
          <div className="border-t border-slate-50 pt-3 space-y-1.5">
            <div className="flex justify-between text-[12px] font-bold text-slate-500">
              <span>Rental cost</span>
              <span>Rs.{totalCost}</span>
            </div>
            <div className="flex justify-between text-[12px] font-bold text-slate-500">
              <span>
                {advancePaymentLabel}
              </span>
              <span>Rs.{payableNow}</span>
            </div>
            <div className="flex justify-between text-[14px] font-black text-slate-900 pt-1 border-t border-slate-50">
              <span>Total now</span>
              <span>Rs.{payableNow}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400">
              Rental cost Rs.{totalCost} is paid at pickup.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
        >
          <div className="w-8 h-8 rounded-[10px] bg-emerald-50 flex items-center justify-center shrink-0">
            <ShieldCheck size={15} className="text-emerald-500" strokeWidth={2} />
          </div>
          <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
            You are paying Rs.{payableNow} right now as the booking advance. The remaining rental cost is paid at pickup.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Payment Method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMethod(id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-[14px] border transition-all ${
                  method === id
                    ? 'border-orange-200 bg-orange-50 shadow-[0_4px_12px_rgba(249,115,22,0.12)]'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <Icon size={18} className={method === id ? 'text-orange-500' : 'text-slate-400'} strokeWidth={2} />
                <span className={`text-[11px] font-black ${method === id ? 'text-slate-900' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handlePay}
          disabled={paying}
          className="pointer-events-auto w-full bg-slate-900 py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2"
        >
          {paying ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CreditCard size={16} strokeWidth={2.5} /> Pay Rs.{payableNow} via Razorpay
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default RentalDeposit;
