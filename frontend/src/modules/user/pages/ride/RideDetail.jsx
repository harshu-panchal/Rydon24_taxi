import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bike, HelpCircle, Repeat, Share2, Star } from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';

const unwrap = (response) => response?.data || response;

const formatLongDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Trip details';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const coordLabel = (location, fallback) => {
  const [lng, lat] = location?.coordinates || [];
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
  }

  return fallback;
};

const RideDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [shareToast, setShareToast] = useState(false);
  const [ride, setRide] = useState(location.state?.ride || null);
  const [loading, setLoading] = useState(!location.state?.ride);
  const [error, setError] = useState('');
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  useEffect(() => {
    if (ride || !id) return undefined;

    let active = true;

    const loadRide = async () => {
      try {
        const response = await api.get(`/rides/${id}`);
        const payload = unwrap(response);
        if (active) setRide(payload);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Could not load trip details.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRide();

    return () => {
      active = false;
    };
  }, [id, ride]);

  const details = useMemo(() => {
    const driver = ride?.driver || ride?.driverId || {};
    const timeSource = ride?.completedAt || ride?.startedAt || ride?.acceptedAt || ride?.createdAt || ride?.updatedAt;
    const fare = Number(ride?.fare || 0);
    const taxes = Math.max(Math.round(fare * 0.18), 0);
    const status = String(ride?.status || ride?.liveStatus || 'trip').toLowerCase();

    return {
      pickup: coordLabel(ride?.pickupLocation, 'Pickup location'),
      drop: coordLabel(ride?.dropLocation, 'Drop location'),
      fare,
      taxes,
      baseFare: Math.max(fare - taxes, 0),
      timeSource,
      startTime: ride?.startedAt || ride?.acceptedAt || timeSource,
      endTime: ride?.completedAt || timeSource,
      statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
      driverName: driver.name || 'Captain',
      rating: driver.rating || '4.9',
      plate: driver.vehicleNumber || 'Assigned',
      vehicle: driver.vehicleType || ride?.vehicleIconType || 'Taxi',
    };
  }, [ride]);

  const handleShare = () => {
    const text = `My Rydon24 Trip #RDG${id || 'ride'} - ${details.pickup} to ${details.drop} | Rs ${details.fare}.00`;
    if (navigator.share) {
      navigator.share({ title: 'Rydon24 Trip', text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] max-w-lg mx-auto flex flex-col font-sans relative">
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-2xl whitespace-nowrap"
          >
            Trip details copied!
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white p-5 flex items-center justify-between border-b border-gray-50 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 active:scale-95 transition-all">
            <ArrowLeft size={24} className="text-gray-900" strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-[17px] font-black text-gray-900 leading-none">Trip ID: #RDG{id || 'ride'}</h1>
            <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
              {details.statusLabel}: {formatLongDate(details.timeSource)}
            </p>
          </div>
        </div>
        <button onClick={handleShare} className="active:scale-90 transition-all">
          <Share2 size={20} className="text-gray-400 hover:text-gray-900 transition-colors" />
        </button>
      </header>

      <div className="flex-1 p-5 space-y-8 overflow-y-auto no-scrollbar">
        {loading && (
          <div className="rounded-[24px] border border-gray-50 bg-white p-5 text-center text-[13px] font-black text-gray-500 shadow-sm">
            Loading trip details...
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-red-100 bg-red-50 p-5 text-center text-[13px] font-black text-red-600 shadow-sm">
            {error}
          </div>
        )}

        <div className="h-40 bg-gray-100 rounded-[32px] overflow-hidden relative shadow-sm">
          <img src="/map image.avif" className="w-full h-full object-cover opacity-60" alt="Map View" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent" />
        </div>

        <div className="relative pl-8 space-y-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-gray-100" />

          <div className="relative">
            <div className="absolute -left-9 top-0.5 w-4 h-4 rounded-full border-2 border-green-500 bg-white shadow-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            </div>
            <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1">Pickup</h4>
            <p className="text-[15px] font-black text-gray-800 leading-tight">{details.pickup}</p>
            <span className="text-[11px] font-bold text-gray-400 block mt-1">{formatTime(details.startTime)}</span>
          </div>

          <div className="relative">
            <div className="absolute -left-9 top-0.5 w-4 h-4 rounded-full border-2 border-orange-500 bg-white shadow-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            </div>
            <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1">Drop</h4>
            <p className="text-[15px] font-black text-gray-800 leading-tight">{details.drop}</p>
            <span className="text-[11px] font-bold text-gray-400 block mt-1">{formatTime(details.endTime)}</span>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-6 border border-gray-50 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-900 shadow-sm border border-gray-100">
              <Bike size={22} />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-gray-900">{details.vehicle} Ride</h3>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Payment by Cash</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-[13px] font-bold text-gray-500">
              <span>Base Fare</span>
              <span className="text-gray-900">Rs {details.baseFare}.00</span>
            </div>
            <div className="flex justify-between items-center text-[13px] font-bold text-gray-500">
              <span>Taxes & Fees</span>
              <span className="text-gray-900">Rs {details.taxes}.00</span>
            </div>
            <div className="flex justify-between items-center text-[16px] font-black text-gray-900 border-t border-gray-50 pt-3">
              <span>Total Paid</span>
              <span>Rs {details.fare}.00</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 bg-orange-50/50 rounded-[28px] border border-orange-50">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white rounded-2xl p-0.5 overflow-hidden border border-orange-100">
              <img
                src={`https://ui-avatars.com/api/?name=${String(details.driverName).replace(' ', '+')}&background=f0f0f0&color=000`}
                className="w-full h-full rounded-[14px]"
                alt={details.driverName}
              />
            </div>
            <div>
              <h4 className="text-[14px] font-black text-gray-900">{details.driverName}</h4>
              <div className="flex items-center gap-1 text-[11px] font-black text-orange-600">
                <Star size={12} className="fill-orange-600" />
                <span>{details.rating} - {details.plate}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${routePrefix}/support`)}
            className="bg-white px-4 py-2 rounded-full text-[12px] font-black text-gray-900 border border-orange-100 active:scale-95 transition-all"
          >
            Support
          </button>
        </div>
      </div>

      <div className="p-6 border-t border-gray-50 flex gap-4 bg-white pb-10">
        <button
          type="button"
          onClick={() => navigate(`${routePrefix}/ride/select-location`)}
          className="flex-[2] bg-[#1C2833] text-white py-5 rounded-[24px] text-[14px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Repeat size={18} />
          <span>Rebook Ride</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`${routePrefix}/support`)}
          className="flex-1 bg-gray-50 text-gray-900 py-5 rounded-[24px] text-[14px] font-black uppercase tracking-widest border border-gray-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <HelpCircle size={18} />
          <span>Help</span>
        </button>
      </div>
    </div>
  );
};

export default RideDetail;
