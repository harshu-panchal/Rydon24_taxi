import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoaderCircle, Navigation } from 'lucide-react';

const generateIntercityBookingId = () =>
  'IC-' + Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(6, '0');

const generateSearchNonce = () =>
  `intercity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const IntercityConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';
  const state = useMemo(() => location.state || {}, [location.state]);

  useEffect(() => {
    if (!state.pickup || !state.drop || !state.vehicle) {
      navigate(`${routePrefix}/intercity`, { replace: true });
      return;
    }

    const bookingId = state.bookingId || generateIntercityBookingId();

    navigate(`${routePrefix}/ride/searching`, {
      replace: true,
      state: {
        ...state,
        bookingId,
        searchNonce: state.searchNonce || generateSearchNonce(),
        vehicleTypeId: state.vehicleTypeId || state.vehicle?.vehicleTypeId || '',
        vehicleIconType: state.vehicleIconType || state.vehicle?.iconType || state.vehicle?.name || 'car',
        vehicleIconUrl: state.vehicleIconUrl || state.vehicle?.vehicleIconUrl || state.vehicle?.icon || '',
        paymentMethod: state.paymentMethod || 'Cash',
        serviceType: 'intercity',
        transport_type: 'intercity',
        intercity: {
          bookingId,
          fromCity: state.fromCity || '',
          toCity: state.toCity || '',
          tripType: state.tripType || 'One Way',
          travelDate: state.date || 'Ride Now',
          passengers: state.passengers || 1,
          distance: Number(state.distance || 0),
          vehicleName: state.vehicle?.name || state.vehicle?.id || 'Intercity Cab',
          packageId: state.vehicle?.packageId || '',
          packageTypeName: state.vehicle?.packageTypeName || 'Intercity',
        },
      },
    });
  }, [navigate, routePrefix, state]);

  return (
    <div className="min-h-screen max-w-lg mx-auto flex items-center justify-center bg-slate-950 px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-600/20 text-blue-400">
          <Navigation size={26} />
        </div>
        <h1 className="mt-5 text-[22px] font-black text-white">Opening live tracking</h1>
        <p className="mt-2 text-[13px] font-bold text-white/55">
          Sending this intercity booking into the active driver search flow.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-[12px] font-black uppercase tracking-[0.18em] text-blue-300">
          <LoaderCircle size={18} className="animate-spin" />
          Redirecting
        </div>
      </motion.div>
    </div>
  );
};

export default IntercityConfirm;
