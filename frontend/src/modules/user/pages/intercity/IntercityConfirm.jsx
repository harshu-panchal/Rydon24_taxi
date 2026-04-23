import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Home, LoaderCircle, MapPin, Calendar, Users, Car, Share2 } from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';
import { getLocalUserToken, userAuthService } from '../../services/authService';

const generateBookingId = () => 'IC-' + Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(6, '0');
const DEFAULT_VEHICLE = { name: 'Mini Cab' };
const DEFAULT_PICKUP_COORDS = [75.8577, 22.7196];
const DEFAULT_DROP_COORDS = [77.4126, 23.2599];
const unwrap = (response) => response?.data?.data || response?.data || response;

const unwrapLoginPayload = (response) => {
  const payload = unwrap(response);
  return payload?.token ? payload : payload?.user ? payload : payload?.data || payload;
};

const IntercityConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => location.state || {}, [location.state]);

  const [bookingId] = useState(() => state.bookingId || generateBookingId());
  const [shareToast, setShareToast] = useState(false);
  const [bookingStatus, setBookingStatus] = useState('creating');
  const [bookingError, setBookingError] = useState('');
  const [rideId, setRideId] = useState('');
  const requestStartedRef = useRef(false);

  const fromCity    = state.fromCity    || 'Indore';
  const toCity      = state.toCity      || 'Bhopal';
  const tripType    = state.tripType    || 'One Way';
  const date        = state.date        || 'Not specified';
  const passengers  = state.passengers  || 1;
  const vehicle     = useMemo(() => state.vehicle || DEFAULT_VEHICLE, [state.vehicle]);
  const fare        = state.fare        || state.estimatedFare || 0;
  const pickup      = state.pickup      || 'Not specified';
  const drop        = state.drop        || 'Not specified';
  const pickupCoords = useMemo(() => state.pickupCoords || DEFAULT_PICKUP_COORDS, [state.pickupCoords]);
  const dropCoords = useMemo(() => state.dropCoords || DEFAULT_DROP_COORDS, [state.dropCoords]);

  useEffect(() => {
    if (requestStartedRef.current) {
      return;
    }

    requestStartedRef.current = true;

    const createIntercityRide = async () => {
      if (!state.pickup || !state.drop || !state.vehicle) {
        setBookingStatus('error');
        setBookingError('Missing intercity booking details. Please start again from Intercity Travel.');
        return;
      }

      setBookingStatus('creating');
      setBookingError('');

      try {
        let userToken = getLocalUserToken();

        if (!userToken) {
          const loginResponse = await userAuthService.loginDemoUser();
          const loginPayload = unwrapLoginPayload(loginResponse);

          if (loginPayload?.token) {
            userToken = loginPayload.token;
            localStorage.setItem('token', userToken);
            localStorage.setItem('userToken', userToken);
            localStorage.setItem('role', 'user');
            localStorage.setItem('userInfo', JSON.stringify(loginPayload.user || {}));
          }
        }

        const rideRequestConfig = userToken
          ? { headers: { Authorization: `Bearer ${userToken}` } }
          : {};

        const response = await api.post('/rides', {
          pickup: pickupCoords,
          drop: dropCoords,
          pickupAddress: pickup,
          dropAddress: drop,
          fare: Number(fare || 0),
          vehicleTypeId: vehicle.vehicleTypeId || vehicle.id || '',
          vehicleIconType: vehicle.iconType || vehicle.raw?.icon_types || vehicle.name || 'car',
          vehicleIconUrl: vehicle.vehicleIconUrl || vehicle.icon || vehicle.raw?.map_icon || vehicle.raw?.icon || vehicle.raw?.image || '',
          paymentMethod: 'Cash',
          serviceType: 'intercity',
          transport_type: 'intercity',
          intercity: {
            bookingId,
            fromCity,
            toCity,
            tripType,
            travelDate: date,
            passengers,
            distance: state.distance || 0,
            vehicleName: vehicle.name || vehicle.id || 'Intercity Cab',
          },
        }, rideRequestConfig);

        const payload = unwrap(response);
        const ride = payload?.ride || payload;
        const nextRideId = ride?._id || ride?.id || payload?.realtime?.rideId;

        setRideId(nextRideId ? String(nextRideId) : '');
        setBookingStatus('created');
      } catch (error) {
        setBookingStatus('error');
        setBookingError(error?.message || 'Could not send this booking to drivers.');
      }
    };

    createIntercityRide();
  }, [bookingId, date, drop, dropCoords, fare, fromCity, passengers, pickup, pickupCoords, state, toCity, tripType, vehicle]);

  const handleShare = async () => {
    const text = `Intercity booking confirmed!\nID: ${bookingId}\n${fromCity} → ${toCity}\nDate: ${date}\nVehicle: ${vehicle.name}\nPassengers: ${passengers}\nFare: ₹${fare.toLocaleString()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rydon24 Intercity Booking', text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="min-h-screen bg-[#1C2833] max-w-lg mx-auto font-sans flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-yellow-400/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-blue-400/5 blur-3xl pointer-events-none" />

      {/* Share toast */}
      {shareToast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-900 px-5 py-3 rounded-2xl text-[12px] font-black shadow-2xl whitespace-nowrap">
          📋 Booking details copied!
        </motion.div>
      )}

      {/* Checkmark */}
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
        className="w-24 h-24 rounded-full bg-yellow-400 flex items-center justify-center shadow-[0_0_60px_rgba(250,204,21,0.3)] mb-6">
        <CheckCircle2 size={48} className="text-[#1C2833]" strokeWidth={2.5} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="text-center mb-6">
        <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Booking Confirmed</p>
        <h1 className="text-[28px] font-black text-white leading-tight">You're all set!</h1>
        <p className="text-[13px] font-bold text-white/50 mt-1">
          {bookingStatus === 'created' ? 'Your intercity cab request is live for drivers' : 'Preparing your intercity cab request'}
        </p>
      </motion.div>

      {/* Booking ID */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
        className="bg-yellow-400 px-6 py-2.5 rounded-full mb-6 shadow-[0_4px_20px_rgba(250,204,21,0.3)]">
        <p className="text-[14px] font-black text-[#1C2833] tracking-[0.2em]">{bookingId}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        className={`w-full rounded-[18px] border px-4 py-3 mb-4 flex items-center gap-3 ${
          bookingStatus === 'error'
            ? 'bg-rose-500/10 border-rose-400/20 text-rose-100'
            : 'bg-white/10 border-white/10 text-white'
        }`}>
        {bookingStatus === 'creating' ? (
          <LoaderCircle size={18} className="animate-spin text-yellow-400 shrink-0" />
        ) : bookingStatus === 'error' ? (
          <AlertTriangle size={18} className="text-rose-300 shrink-0" />
        ) : (
          <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-black leading-tight">
            {bookingStatus === 'creating' ? 'Sending request to drivers...' : bookingStatus === 'error' ? 'Driver request failed' : 'Driver request sent'}
          </p>
          <p className="text-[10px] font-bold opacity-60 mt-0.5 truncate">
            {bookingStatus === 'error' ? bookingError : rideId ? `Ride ID: ${rideId}` : 'Drivers can accept this intercity trip from their home screen.'}
          </p>
        </div>
      </motion.div>

      {/* Details card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="w-full rounded-[24px] bg-white/10 border border-white/10 p-5 space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <MapPin size={16} className="text-yellow-400 shrink-0" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Route</p>
            <p className="text-[14px] font-black text-white">{fromCity} → {toCity}</p>
          </div>
          <span className="text-[10px] font-black text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{tripType}</span>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col gap-2 pt-1 pb-1">
           <div className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div>
                 <p className="text-[9px] font-black text-white/40 uppercase tracking-wider leading-none">Pickup</p>
                 <p className="text-[12px] font-bold text-white mt-0.5 leading-snug">{pickup}</p>
              </div>
           </div>
           <div className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
              <div>
                 <p className="text-[9px] font-black text-white/40 uppercase tracking-wider leading-none">Drop</p>
                 <p className="text-[12px] font-bold text-white mt-0.5 leading-snug">{drop}</p>
              </div>
           </div>
        </div>

        <div className="h-px bg-white/10" />
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-white/40" strokeWidth={2} />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-wider">Date</p>
            </div>
            <p className="text-[12px] font-black text-white">{date}</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Users size={11} className="text-white/40" strokeWidth={2} />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-wider">Pax</p>
            </div>
            <p className="text-[12px] font-black text-white">{passengers}</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Car size={11} className="text-white/40" strokeWidth={2} />
              <p className="text-[9px] font-black text-white/40 uppercase tracking-wider">Vehicle</p>
            </div>
            <p className="text-[12px] font-black text-white truncate">{vehicle.name || vehicle.id}</p>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-wider">Total Fare</p>
          <p className="text-[22px] font-black text-yellow-400">₹{Number(fare).toLocaleString()}</p>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="w-full space-y-3">
        <button onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] border border-white/20 text-white text-[13px] font-black uppercase tracking-widest active:bg-white/10 transition-all">
          <Share2 size={15} strokeWidth={2.5} /> Share Booking
        </button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/')}
          className="w-full bg-yellow-400 text-[#1C2833] py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(250,204,21,0.25)]">
          <Home size={16} strokeWidth={2.5} /> Back to Home
        </motion.button>
      </motion.div>
    </div>
  );
};

export default IntercityConfirm;
