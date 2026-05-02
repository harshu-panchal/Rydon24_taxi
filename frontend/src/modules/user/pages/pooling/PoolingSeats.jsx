import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Armchair,
  Info,
  ShieldCheck,
  Zap,
  Car,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

const SEAT_LEGEND = [
  { key: 'available', label: 'Available', color: 'bg-white border-slate-200' },
  { key: 'selected', label: 'Selected', color: 'bg-slate-900 border-slate-900' },
  { key: 'booked', label: 'Booked', color: 'bg-slate-100 border-slate-100' },
  { key: 'driver', label: 'Driver', color: 'bg-indigo-100 border-indigo-100' },
];

const unwrapPayload = (response) => response?.data?.data || response?.data || response || {};

const PoolingSeats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const travelDate = location.state?.travelDate || '';

  const [route, setRoute] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeatIds, setBookedSeatIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRouteDetails();
  }, [id, travelDate]);

  const fetchRouteDetails = async () => {
    setLoading(true);
    try {
      const response = await userService.getPoolingRouteDetails(id, travelDate ? { travelDate } : undefined);
      const routeData = unwrapPayload(response);
      setRoute(routeData);

      const nextVehicle =
        (Array.isArray(routeData?.assignedVehicleTypeIds) && routeData.assignedVehicleTypeIds[0]) ||
        (Array.isArray(routeData?.assignedVehicles) && routeData.assignedVehicles[0]) ||
        null;
      setSelectedVehicle(nextVehicle);

      const activeSchedules = Array.isArray(routeData?.schedules) ? routeData.schedules : [];
      const selectedSchedule =
        activeSchedules.find((item) => String(item?.status || 'active') === 'active') ||
        activeSchedules[0] ||
        null;

      const seatAvailability = routeData?.seatAvailability || {};
      const availabilityKey =
        nextVehicle?._id && selectedSchedule?.id
          ? `${String(nextVehicle._id)}:${String(selectedSchedule.id)}`
          : '';
      const nextBookedSeatIds =
        availabilityKey && Array.isArray(seatAvailability[availabilityKey])
          ? seatAvailability[availabilityKey]
          : [];

      setBookedSeatIds(nextBookedSeatIds);
      setSelectedSeats((current) => current.filter((seatId) => !nextBookedSeatIds.includes(seatId)));
    } catch {
      toast.error('Failed to load route details');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seatId) => {
    if (bookedSeatIds.includes(seatId)) {
      toast.error('This seat is already booked by another user');
      return;
    }

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats((current) => current.filter((idValue) => idValue !== seatId));
      return;
    }

    if (selectedSeats.length >= (route?.maxSeatsPerBooking || 1)) {
      toast.error(`Maximum ${route?.maxSeatsPerBooking} seats allowed`);
      return;
    }

    setSelectedSeats((current) => [...current, seatId]);
  };

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }

    const activeSchedules = Array.isArray(route?.schedules) ? route.schedules : [];
    const selectedSchedule =
      activeSchedules.find((item) => String(item?.status || 'active') === 'active') ||
      activeSchedules[0] ||
      null;
    if (!selectedSchedule?.id) {
      toast.error('No active schedule is available for this route');
      return;
    }

    const pickupStop =
      (Array.isArray(route?.pickupPoints) && route.pickupPoints[0]) ||
      (Array.isArray(route?.stops) && route.stops[0]) ||
      null;
    const dropStop =
      (Array.isArray(route?.dropPoints) && route.dropPoints[0]) ||
      (Array.isArray(route?.stops) && route.stops[route.stops.length - 1]) ||
      null;
    if (!pickupStop?.id || !dropStop?.id) {
      toast.error('Route pickup or drop point is missing');
      return;
    }

    navigate('/taxi/user/pooling/confirm', {
      state: {
        route,
        vehicle: selectedVehicle,
        selectedSeats,
        totalFare: selectedSeats.length * route.farePerSeat,
        travelDate,
        schedule: selectedSchedule,
        pickupStop,
        dropStop,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white">
        <div className="relative flex items-center justify-center">
          <div className="h-20 w-20 animate-spin rounded-full border-[6px] border-slate-100 border-t-slate-900" />
          <Car className="absolute text-slate-900" size={24} />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Initializing Flow</p>
      </div>
    );
  }

  const blueprint = selectedVehicle?.blueprint || { cols: 0, layout: [] };
  const maxSeats = route?.maxSeatsPerBooking || 1;
  const bookedCount = bookedSeatIds.length;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 pb-40 font-sans">
      <div className="sticky top-0 z-30 border-b border-slate-100 bg-white px-5 pb-6 pt-10 shadow-sm">
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
              <h1 className="text-lg font-black text-slate-900">Choose Seats</h1>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                Step 2/3
              </span>
            </div>
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {route?.originLabel} to {route?.destinationLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              <Car size={16} className="text-slate-900" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Vehicle</p>
              <p className="truncate text-xs font-black text-slate-900">{selectedVehicle?.name || 'Assigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
              <Zap size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Price</p>
              <p className="text-xs font-black text-slate-900">
                Rs {route?.farePerSeat}
                <span className="text-[10px] font-bold text-slate-400">/seat</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-8">
        <div className="mb-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Live availability</p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-700">
            {bookedCount > 0
              ? `${bookedCount} ${bookedCount === 1 ? 'seat is' : 'seats are'} already booked by other users for ${travelDate || 'this trip'}.`
              : 'No paid seats are booked yet for this date.'}
          </p>
        </div>

        <div className="mb-8 flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Info size={20} />
            </div>
            <p className="text-xs font-bold leading-tight text-slate-600">
              You can book up to{' '}
              <span className="font-black text-slate-900">
                {maxSeats} {maxSeats === 1 ? 'seat' : 'seats'}
              </span>{' '}
              for this trip.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-10 grid w-full grid-cols-2 gap-4 px-4">
            {SEAT_LEGEND.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded-md border-2 ${item.color}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="relative w-full max-w-[320px] rounded-[60px] border-4 border-slate-100 bg-white p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)]">
            <div className="mb-10 flex items-center justify-between px-4">
              <div className="h-1.5 w-12 rounded-full bg-slate-100" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-slate-100">
                <div className="h-6 w-6 rounded-full border-2 border-slate-100" />
                <div className="absolute top-0 h-3 w-1 rounded-full bg-slate-200" />
              </div>
            </div>

            {!blueprint.layout?.length ? (
              <div className="py-20 text-center text-slate-400">
                <p className="text-xs font-bold uppercase tracking-widest">No layout available</p>
              </div>
            ) : (
              <div
                className="grid gap-x-6 gap-y-8"
                style={{
                  gridTemplateColumns: `repeat(${blueprint.cols || 2}, minmax(0, 1fr))`,
                }}
              >
                {blueprint.layout.map((item, idx) => {
                  const seatId = `${item.r}-${item.c}`;
                  const isSelected = selectedSeats.includes(seatId);
                  const isBooked = item.status === 'booked' || bookedSeatIds.includes(seatId);

                  if (item.type === 'empty' || item.type === 'gap') {
                    return <div key={`gap-${idx}`} className="h-14 w-full" />;
                  }

                  return (
                    <motion.div
                      key={seatId}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="relative flex justify-center"
                    >
                      <button
                        type="button"
                        disabled={isBooked || item.type === 'driver'}
                        onClick={() => item.type === 'seat' && toggleSeat(seatId)}
                        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                          item.type === 'driver'
                            ? 'border-2 border-indigo-100 bg-indigo-100 text-indigo-500'
                            : isBooked
                              ? 'cursor-not-allowed border-2 border-slate-100 bg-slate-100 text-slate-300'
                              : isSelected
                                ? 'border-2 border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-200'
                                : 'border-2 border-slate-200 bg-white text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {item.type === 'driver' ? <User size={20} /> : <Armchair size={22} />}

                        {item.type === 'seat' && !isSelected && !isBooked ? (
                          <div className="absolute -top-1 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-slate-100" />
                        ) : null}

                        {isSelected ? (
                          <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                            <CheckCircle2 size={10} className="text-white" />
                          </div>
                        ) : null}

                        {isBooked ? (
                          <div className="absolute -bottom-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-rose-600">
                            Booked
                          </div>
                        ) : null}
                      </button>

                      <span className="absolute -bottom-5 text-[9px] font-bold uppercase tracking-tighter text-slate-400">
                        {item.label || (item.type === 'driver' ? 'DRV' : `S${idx + 1}`)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="mt-16 flex h-4 w-full justify-center border-t-2 border-slate-50">
              <div className="mt-4 h-1.5 w-24 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="mb-8 mt-12 flex items-center gap-4 rounded-3xl border border-emerald-100/50 bg-emerald-50/50 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Safe Pooling</p>
            <p className="text-xs font-bold text-slate-600">
              Paid seats lock instantly, so once another user books a seat it becomes unavailable here.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-slate-100 bg-white px-5 pb-8 pt-4 shadow-[0_-20px_40px_rgba(15,23,42,0.05)]">
        <AnimatePresence>
          {selectedSeats.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-4 flex items-center justify-between rounded-3xl bg-slate-900 p-5 text-white shadow-2xl shadow-slate-300"
            >
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Fare Breakdown</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black">Rs {selectedSeats.length * (route?.farePerSeat || 0)}</span>
                  <span className="text-xs font-bold text-slate-400">
                    / {selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-lg transition-all active:scale-95"
              >
                <ChevronRight size={24} />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <AlertCircle size={18} className="text-slate-400" />
              <p className="text-xs font-bold italic text-slate-400">Select a seat to proceed with the booking</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PoolingSeats;
