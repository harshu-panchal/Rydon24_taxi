import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CreditCard,
  ChevronRight,
  CheckCircle2,
  Armchair,
  Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

const PoolingConfirm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { route, vehicle, selectedSeats, totalFare } = location.state || {};

  const [isBooking, setIsBooking] = useState(false);
  const [isBooked, setIsBooked] = useState(false);

  if (!route || !vehicle) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-black text-slate-900">Session Expired</h2>
        <p className="mt-2 text-sm text-slate-500">Please start your booking again.</p>
        <button 
          onClick={() => navigate('/taxi/user/pooling')}
          className="mt-6 rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-black text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleConfirm = async () => {
    setIsBooking(true);
    try {
      await userService.createPoolingBooking({
        routeId: route._id,
        vehicleId: vehicle._id,
        selectedSeats,
        fare: totalFare,
        pickupPoint: route.originLabel,
        dropPoint: route.destinationLabel
      });
      
      setIsBooked(true);
      toast.success('Booking Successful!');
      
      // Auto-navigate after 2 seconds
      setTimeout(() => {
        navigate('/taxi/user');
      }, 2500);
    } catch (error) {
      toast.error('Booking failed. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <AnimatePresence>
        {isBooked ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"
            >
              <CheckCircle2 size={64} />
            </motion.div>
            <h1 className="text-3xl font-black text-slate-900">Ride Confirmed!</h1>
            <p className="mt-4 max-w-xs text-base font-bold text-slate-500">Your carpool booking is successful. Driver will pick you up at the scheduled time.</p>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 flex items-center gap-2 text-sm font-black text-indigo-600"
            >
              Redirecting to home...
            </motion.div>
          </motion.div>
        ) : (
          <div className="pt-12 px-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-black text-slate-900">Booking Summary</h1>
            </div>

            {/* Ride Card */}
            <div className="mb-8 overflow-hidden rounded-[40px] bg-white shadow-xl shadow-slate-200/50">
              <div className="bg-indigo-600 p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                    <ShieldCheck size={12} />
                    Secured Ride
                  </div>
                  <p className="text-sm font-black">₹{totalFare}</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="relative flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-white" />
                    <div className="h-10 w-0.5 bg-white/30" />
                    <div className="h-3 w-3 rounded-full bg-white" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Pickup</p>
                      <p className="text-sm font-black truncate">{route.originLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Drop</p>
                      <p className="text-sm font-black truncate">{route.destinationLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                      <Car size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{vehicle.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{vehicle.vehicleNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                      <Armchair size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{selectedSeats.length} Seats</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{selectedSeats.join(', ')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="mb-8 rounded-[32px] bg-white p-8 border border-slate-100">
              <h3 className="mb-6 text-sm font-black uppercase tracking-widest text-slate-900">Price Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>Ride Fare ({selectedSeats.length} Seats)</span>
                  <span>₹{totalFare}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>Service Fee</span>
                  <span className="text-emerald-500 text-[10px] font-black uppercase">Free</span>
                </div>
                <div className="mt-4 border-t border-slate-50 pt-4 flex justify-between items-center">
                  <span className="text-base font-black text-slate-900">Total Payable</span>
                  <span className="text-xl font-black text-indigo-600">₹{totalFare}</span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-[32px] bg-slate-900 p-8 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black">Pay on Arrival</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cash or UPI</p>
                  </div>
                </div>
                <button className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Change</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Action Button */}
      {!isBooked && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md px-6 pt-6 pb-8">
          <button 
            onClick={handleConfirm}
            disabled={isBooking}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-2xl shadow-indigo-200 active:scale-95 transition-transform disabled:opacity-50"
          >
            {isBooking ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Confirm Booking
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolingConfirm;
