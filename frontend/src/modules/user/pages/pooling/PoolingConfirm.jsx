import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Armchair,
  Car,
  CreditCard,
  Zap,
  Ticket,
  CalendarDays,
  MapPin,
  Receipt,
  CircleCheckBig,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

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

const formatTravelDate = (value) => {
  if (!value) return 'Today';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const unwrapPayload = (response) => response?.data?.data || response?.data || response || {};

const formatDateTime = (dateValue, scheduleLabel = '') => {
  const parsed = new Date(dateValue);
  const formattedDate = Number.isNaN(parsed.getTime())
    ? formatTravelDate(dateValue)
    : parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  return scheduleLabel ? `${formattedDate} • ${scheduleLabel}` : formattedDate;
};

const PoolingConfirm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { route, vehicle, selectedSeats, totalFare, travelDate, schedule, pickupStop, dropStop } = location.state || {};

  const [isBooking, setIsBooking] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  if (!route || !vehicle || !schedule?.id || !pickupStop?.id || !dropStop?.id) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white p-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Ticket size={40} />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-900">Session Expired</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Your booking session has timed out. Please select your seats again.
        </p>
        <button
          type="button"
          onClick={() => navigate('/taxi/user/pooling')}
          className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95"
        >
          Restart Booking
        </button>
      </div>
    );
  }

  const handleConfirm = async () => {
    setIsBooking(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load');
      }

      const orderResponse = await userService.createPoolingBookingOrder({
        routeId: route._id,
        vehicleId: vehicle._id,
        scheduleId: schedule.id,
        travelDate,
        selectedSeats,
        pickupStopId: pickupStop.id,
        dropStopId: dropStop.id,
      });
      const order = unwrapPayload(orderResponse);

      if (!order.keyId || !order.orderId) {
        throw new Error('Unable to start pooling payment');
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Pooling Booking',
        description: `${route.originLabel} to ${route.destinationLabel}`,
        order_id: order.orderId,
        modal: {
          ondismiss: () => {
            setIsBooking(false);
          },
        },
        theme: {
          color: '#0f172a',
        },
        handler: async (response) => {
          try {
            const verifyResponse = await userService.verifyPoolingBookingPayment({
              ...response,
              routeId: route._id,
              vehicleId: vehicle._id,
              scheduleId: schedule.id,
              travelDate,
              selectedSeats,
              pickupStopId: pickupStop.id,
              dropStopId: dropStop.id,
            });
            const booking = unwrapPayload(verifyResponse);

            setConfirmedBooking(booking);
            setIsBooked(true);
            toast.success('Pooling booking confirmed');
          } catch (verifyError) {
            const message =
              verifyError?.response?.data?.message ||
              verifyError?.message ||
              'Payment verification failed. Please contact support if payment was deducted.';
            toast.error(message);
            setIsBooking(false);
          }
        },
      });

      rzp.on('payment.failed', (event) => {
        const message = event?.error?.description || event?.error?.reason || 'Payment failed';
        toast.error(message);
        setIsBooking(false);
      });

      rzp.open();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to continue with Razorpay payment';
      toast.error(message);
      setIsBooking(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 pb-32 font-sans">
      <AnimatePresence>
        {isBooked ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-slate-50 px-5 pb-10 pt-8"
          >
            <div className="overflow-hidden rounded-[36px] border border-emerald-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-500 px-6 pb-8 pt-7 text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-md"
                >
                  <CircleCheckBig size={34} />
                </motion.div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Booking Confirmed</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight">Pooling ride secured</h1>
                    <p className="mt-3 max-w-[250px] text-sm font-semibold leading-relaxed text-emerald-50">
                      Your seat reservation and online payment are confirmed for this shared ride.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-md">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Booking ID</p>
                    <p className="mt-1 text-sm font-black">{confirmedBooking?.bookingId || 'CONFIRMED'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Travel Slot</p>
                    <div className="mt-3 flex items-start gap-3">
                      <CalendarDays size={18} className="mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {formatDateTime(confirmedBooking?.travelDate || travelDate, confirmedBooking?.scheduleId || schedule?.departureTime || '')}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">Departure timing saved in your booking</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Payment</p>
                    <div className="mt-3 flex items-start gap-3">
                      <Receipt size={18} className="mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-sm font-black text-slate-900">Rs {confirmedBooking?.fare || totalFare}</p>
                        <p className="mt-1 text-[11px] font-bold text-emerald-600">
                          {(confirmedBooking?.paymentStatus || 'paid').toUpperCase()} via Razorpay
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Car size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vehicle Assigned</p>
                      <p className="mt-2 text-lg font-black text-slate-900">{vehicle.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{vehicle.vehicleNumber}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-600">
                          Seats: {(confirmedBooking?.selectedSeats || selectedSeats).join(', ')}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                          {confirmedBooking?.seatsBooked || selectedSeats.length} Reserved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trip Route</p>
                  <div className="mt-4 flex items-start gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-white" />
                      <div className="h-12 w-0.5 border-l-2 border-dashed border-slate-200" />
                      <div className="h-3.5 w-3.5 rounded-full bg-slate-900" />
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</p>
                        <p className="mt-1 text-sm font-black leading-relaxed text-slate-900">
                          {confirmedBooking?.pickupLabel || pickupStop?.name || route.originLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop</p>
                        <p className="mt-1 text-sm font-black leading-relaxed text-slate-900">
                          {confirmedBooking?.dropLabel || dropStop?.name || route.destinationLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-100 bg-slate-50 p-5">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="mt-0.5 text-slate-500" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">What happens next</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                        Reach the pickup point before departure, keep your booking ID handy, and check your activity tab for this confirmed pooling trip.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/taxi/user/activity')}
                    className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-900 shadow-sm transition-all active:scale-[0.98]"
                  >
                    View Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/taxi/user')}
                    className="rounded-[22px] bg-slate-900 px-4 py-4 text-sm font-black text-white shadow-xl transition-all active:scale-[0.98]"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="sticky top-0 z-30 border-b border-slate-100 bg-white px-5 pb-6 pt-12 shadow-sm">
              <div className="mb-6 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-900 shadow-sm transition-all active:scale-95"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black text-slate-900">Review Booking</h1>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                      Step 3/3
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Online payment only</p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2">
                <div className="h-1.5 flex-1 rounded-full bg-indigo-600" />
                <div className="h-1.5 flex-1 rounded-full bg-indigo-600" />
                <div className="h-1.5 flex-1 rounded-full animate-pulse bg-indigo-600" />
              </div>
            </div>

            <div className="space-y-6 px-5 pt-8">
              <div className="relative overflow-hidden rounded-[40px] border border-slate-100 bg-white shadow-2xl shadow-slate-200/50">
                <div className="bg-slate-900 p-8 text-white">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md">
                      <ShieldCheck size={12} className="text-indigo-400" />
                      Confirmed Slot
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Seats</p>
                      <p className="text-sm font-black">{selectedSeats.length} Selected</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {formatTravelDate(travelDate)}
                        {schedule?.departureTime ? ` • ${schedule.departureTime}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5">
                    <div className="relative flex flex-col items-center pt-1">
                      <div className="z-10 h-4 w-4 rounded-full border-2 border-indigo-500 bg-slate-900" />
                      <div className="h-16 w-0.5 border-l-2 border-dashed border-slate-700 bg-dashed" />
                      <div className="z-10 h-4 w-4 rounded-full bg-indigo-500" />
                    </div>
                    <div className="flex-1 space-y-8">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup Location</p>
                        <p className="truncate text-base font-black">{route.originLabel}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop Location</p>
                        <p className="truncate text-base font-black">{route.destinationLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative h-4 bg-slate-900">
                  <div className="absolute left-0 right-0 top-0 flex h-4 items-center justify-around">
                    {[...Array(12)].map((_, index) => (
                      <div key={index} className="h-2 w-2 rounded-full bg-slate-50" />
                    ))}
                  </div>
                </div>

                <div className="space-y-6 bg-white p-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                        <Car size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Vehicle</p>
                        <p className="truncate text-xs font-black text-slate-900">{vehicle.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                        <Armchair size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Seat ID</p>
                        <p className="truncate text-xs font-black text-slate-900">{selectedSeats.join(', ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Pickup Point</p>
                      <p className="mt-1 text-xs font-black leading-relaxed text-slate-900">
                        {pickupStop?.name || route.originLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Drop Point</p>
                      <p className="mt-1 text-xs font-black leading-relaxed text-slate-900">
                        {dropStop?.name || route.destinationLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-2">
                  <Ticket size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Price Breakdown</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Base Fare ({selectedSeats.length} x Rs {route.farePerSeat})</span>
                    <span className="text-slate-900">Rs {totalFare}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Platform Service Fee</span>
                    <span className="font-black uppercase text-emerald-500">Rs 0</span>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Amount</p>
                      <p className="text-2xl font-black text-slate-900">Rs {totalFare}</p>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-600">
                        <Zap size={10} />
                        Best Price
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-900">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Mode</p>
                      <p className="text-sm font-black text-slate-900">Online Only</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">
                        Razorpay checkout will open for this pooling booking.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    Razorpay
                  </div>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 border-t border-slate-100 bg-white/80 px-5 pb-8 pt-4 backdrop-blur-md">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isBooking}
                className="flex w-full items-center justify-center gap-3 rounded-[24px] bg-slate-900 py-5 text-sm font-black text-white shadow-2xl shadow-slate-300 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isBooking ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Pay Online & Secure Ride
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PoolingConfirm;
