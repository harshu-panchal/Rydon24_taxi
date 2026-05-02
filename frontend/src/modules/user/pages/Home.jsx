import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronRight, Clock3, MapPin, ShieldCheck, User } from 'lucide-react';
import HeaderGreeting from '../components/HeaderGreeting';
import ServiceGrid from '../components/ServiceGrid';
import LocationMapSection from '../components/LocationMapSection';
import ActionsSection from '../components/ActionsSection';
import PromoBanners from '../components/PromoBanners';
import ExplorerSection from '../components/ExplorerSection';
import BottomNavbar from '../components/BottomNavbar';
import carIcon from '../../../assets/icons/car.png';
import bikeIcon from '../../../assets/icons/bike.png';
import autoIcon from '../../../assets/icons/auto.png';
import deliveryIcon from '../../../assets/icons/Delivery.png';
import api from '../../../shared/api/axiosInstance';
import { useSettings } from '../../../shared/context/SettingsContext';
import { userService } from '../services/userService';
import {
  CURRENT_RIDE_UPDATED_EVENT,
  getCurrentRide,
  isActiveCurrentRide,
  saveCurrentRide,
  clearCurrentRide,
} from '../services/currentRideService';

const Motion = motion;

const getCurrentRideIcon = (ride) => {
  const customIcon = String(
    ride?.vehicleIconUrl ||
    ride?.vehicle?.vehicleIconUrl ||
    ride?.vehicle?.icon ||
    ride?.driver?.vehicleIconUrl ||
    '',
  ).trim();

  if (customIcon) {
    return customIcon;
  }

  const serviceType = String(ride?.serviceType || ride?.type || '').toLowerCase();
  const iconType = String(ride?.vehicleIconType || ride?.driver?.vehicleIconType || ride?.driver?.vehicleType || '').toLowerCase();

  if (serviceType === 'parcel') {
    return deliveryIcon;
  }

  if (iconType.includes('bike')) {
    return bikeIcon;
  }

  if (iconType.includes('auto')) {
    return autoIcon;
  }

  return carIcon;
};

const unwrapApiPayload = (response) => response?.data?.data || response?.data || response;

const formatScheduledDateTime = (value) => {
  if (!value) {
    return 'Scheduled time pending';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Scheduled time pending';
  }

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getScheduledCountdownLabel = (value, now = Date.now()) => {
  const parsed = value ? new Date(value) : null;
  const time = parsed?.getTime?.() || NaN;

  if (!Number.isFinite(time)) {
    return '';
  }

  const diffMs = time - now;
  if (diffMs <= 0) {
    return 'Pickup window is opening now';
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `Starts in ${hours}h ${minutes}m`;
  }

  return `Starts in ${minutes}m`;
};

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'App';

  const [currentRide, setCurrentRide] = useState(() => {
    const ride = getCurrentRide();
    return isActiveCurrentRide(ride) ? ride : null;
  });
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [endingRide, setEndingRide] = useState(false);
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  const handleEndRide = async () => {
    if (!currentRide?.rideId) return;

    try {
      setEndingRide(true);
      const response = await userService.endRentalRide(currentRide.rideId);
      const payload = response?.data || null;
      const nextRideState = {
        ...currentRide,
        ...payload,
        rideId: payload?.id || currentRide.rideId,
        status: payload?.status || 'end_requested',
        liveStatus: payload?.status || 'end_requested',
      };
      saveCurrentRide(nextRideState);
      navigate(`${routePrefix}/rental/confirmed`, {
        state: nextRideState,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setEndingRide(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (!token) {
      navigate('/taxi/user/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000); // Updated to 1s for real-time ticking feel

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshCurrentRide = () => {
      const ride = getCurrentRide();
      setCurrentRide(isActiveCurrentRide(ride) ? ride : null);
    };

    refreshCurrentRide();
    window.addEventListener('storage', refreshCurrentRide);
    window.addEventListener(CURRENT_RIDE_UPDATED_EVENT, refreshCurrentRide);

    let cancelled = false;

    const syncCurrentRide = async () => {
      let rideData = null;

      try {
        rideData = unwrapApiPayload(await api.get('/rides/active/me'));
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        if (status !== 404) {
          throw error;
        }
      }

      if (rideData?._id || rideData?.rideId) {
        const normalizedRide = {
          rideId: rideData._id || rideData.rideId,
          pickup: rideData.pickupAddress || rideData.pickup,
          drop: rideData.dropAddress || rideData.drop,
          pickupCoords: rideData.pickupLocation?.coordinates || rideData.pickupCoords || null,
          dropCoords: rideData.dropLocation?.coordinates || rideData.dropCoords || null,
          fare: rideData.fare,
          baseFare: rideData.baseFare || rideData.fare || 0,
          status: rideData.status,
          liveStatus: rideData.liveStatus,
          serviceType: rideData.serviceType,
          scheduledAt: rideData.scheduledAt || null,
          acceptedAt: rideData.acceptedAt || null,
          arrivedAt: rideData.arrivedAt || null,
          estimatedDistanceMeters: rideData.estimatedDistanceMeters || 0,
          estimatedDurationMinutes: rideData.estimatedDurationMinutes || 0,
          paymentMethod: rideData.paymentMethod || 'Cash',
          pricingSnapshot: rideData.pricingSnapshot || null,
          otp: rideData.otp || '',
          driver: rideData.driverId || rideData.driver,
          vehicleIconUrl: rideData.vehicleIconUrl,
          vehicleIconType: rideData.vehicleIconType,
        };
        if (cancelled) return;
        saveCurrentRide(normalizedRide);
        return;
      }

      try {
        const rentalResponse = await userService.getActiveRentalBooking();
        const rentalRide = rentalResponse?.id ? rentalResponse : (rentalResponse?.data || null);

        if (rentalRide?.id) {
          const status = String(rentalRide.status || '').toLowerCase();
          const isTerminal = ['completed', 'cancelled', 'delivered'].includes(status);

          if (isTerminal) {
            if (cancelled) return;
            clearCurrentRide();
            return;
          }

          if (cancelled) return;
          saveCurrentRide({
            rideId: rentalRide.id,
            bookingReference: rentalRide.bookingReference,
            pickup: rentalRide.serviceLocation?.name || rentalRide.serviceLocation?.address || 'Rental pickup',
            drop: rentalRide.assignedVehicle?.name || rentalRide.vehicleName || 'Assigned vehicle',
            fare: rentalRide.rideMetrics?.currentCharge || rentalRide.payableNow || 0,
            totalCost: rentalRide.totalCost || 0,
            advancePaid: rentalRide.payableNow || 0,
            status: rentalRide.status,
            liveStatus: rentalRide.status,
            serviceType: 'rental',
            vehicle: {
              name: rentalRide.vehicleName,
              image: rentalRide.assignedVehicle?.image || rentalRide.vehicleImage,
            },
            driver: {
              name: rentalRide.assignedVehicle?.name || rentalRide.vehicleName || 'Rental Vehicle',
              vehicle: rentalRide.assignedVehicle?.vehicleCategory || rentalRide.vehicleCategory || 'Rental',
              vehicleType: rentalRide.assignedVehicle?.vehicleCategory || rentalRide.vehicleCategory || 'Rental',
              vehicleIconUrl: rentalRide.assignedVehicle?.image || rentalRide.vehicleImage,
            },
            vehicleIconUrl: rentalRide.assignedVehicle?.image || rentalRide.vehicleImage,
            assignedAt: rentalRide.assignedAt || rentalRide.createdAt,
            completionRequestedAt: rentalRide.completionRequestedAt,
            hourlyRate: rentalRide.rideMetrics?.hourlyRate || 0,
            elapsedMinutes: rentalRide.rideMetrics?.elapsedMinutes || 0,
            remainingDue: rentalRide.rideMetrics?.remainingDue || 0,
            requestedHours: rentalRide.requestedHours || rentalRide.selectedPackage?.durationHours || 0,
            paymentMethodLabel: rentalRide.paymentMethodLabel,
            serviceLocation: rentalRide.serviceLocation,
            assignedVehicle: rentalRide.assignedVehicle,
            finalCharge: rentalRide.finalCharge || 0,
            finalElapsedMinutes: rentalRide.finalElapsedMinutes || 0,
          });
          return;
        }
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        if (status !== 404) {
          // Keep the previous card on transient failures, but don't block normal cleanup on 404/not found.
          return;
        }
      }

      if (cancelled) return;
      clearCurrentRide();
    };

    const handleWindowFocus = () => {
      syncCurrentRide();
    };

    syncCurrentRide();
    const syncTimer = window.setInterval(syncCurrentRide, 4000);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
      window.removeEventListener('storage', refreshCurrentRide);
      window.removeEventListener(CURRENT_RIDE_UPDATED_EVENT, refreshCurrentRide);
    };
  }, []);

  const driverName = currentRide?.driver?.name || 'Captain';
  const serviceType = String(currentRide?.serviceType || currentRide?.type || 'ride').toLowerCase();
  const vehicleLabel = currentRide?.driver?.vehicle || currentRide?.driver?.vehicleType || (serviceType === 'parcel' ? 'Parcel' : serviceType === 'rental' ? 'Rental' : 'Taxi');
  const currentRideIcon = getCurrentRideIcon(currentRide);
  const trackingPath =
    serviceType === 'parcel'
      ? `${routePrefix}/parcel/tracking`
      : serviceType === 'rental'
        ? `${routePrefix}/rental/confirmed`
        : `${routePrefix}/ride/tracking`;
  const rideStage = String(currentRide?.liveStatus || currentRide?.status || 'accepted').toLowerCase();
  const hasAssignedDriver = Boolean(currentRide?.driver?._id || currentRide?.driver?.id || currentRide?.driver?.name);
  const scheduledTimestamp = currentRide?.scheduledAt ? new Date(currentRide.scheduledAt).getTime() : NaN;
  const isScheduledRide = Number.isFinite(scheduledTimestamp);
  const isScheduledUpcoming = isScheduledRide && scheduledTimestamp > clockNow;
  const isScheduledAcceptedRide = ['ride', 'intercity'].includes(serviceType) && isScheduledUpcoming && hasAssignedDriver && ['accepted', 'arriving'].includes(rideStage);
  const rideStageLabel =
    serviceType === 'rental'
      ? rideStage === 'end_requested'
        ? 'End ride review pending'
        : rideStage === 'assigned'
          ? 'Rental in progress'
          : 'Rental booking active'
      : rideStage === 'started'
        ? serviceType === 'parcel' ? 'Parcel in transit' : 'Ride in progress'
        : rideStage === 'arriving'
        ? serviceType === 'parcel' ? 'Driver reached sender' : 'Driver arrived'
        : serviceType === 'parcel'
          ? 'Parcel booked'
          : 'Ride booked';
  const rideStageContextLabel = isScheduledAcceptedRide
    ? 'Driver assigned for your scheduled trip'
    : rideStageLabel;
  const scheduledDateLabel = formatScheduledDateTime(currentRide?.scheduledAt);
  const scheduledCountdown = getScheduledCountdownLabel(currentRide?.scheduledAt, clockNow);
  const rentalElapsedSeconds = serviceType === 'rental' && currentRide?.assignedAt
    ? String(currentRide?.status || '').toLowerCase() === 'end_requested' && Number(currentRide?.finalElapsedMinutes || 0) > 0
      ? Number(currentRide.finalElapsedMinutes || 0) * 60
      : Math.max(1, Math.floor((clockNow - new Date(currentRide.assignedAt).getTime()) / 1000))
    : Number(currentRide?.elapsedMinutes || 0) * 60;

  const rentalElapsedHours = rentalElapsedSeconds / 3600;
  const rentalCurrentCharge = serviceType === 'rental'
    ? String(currentRide?.status || '').toLowerCase() === 'end_requested' && Number(currentRide?.finalCharge || 0) > 0
      ? Number(currentRide.finalCharge || 0)
      : Math.min(
          Number(currentRide?.totalCost || 0),
          Math.max(
            Number(currentRide?.advancePaid || 0),
            Number(currentRide?.hourlyRate || 0) * rentalElapsedHours,
          ),
        )
    : Number(currentRide?.fare || 0);

  const formatRentalTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const rentalTimerLabel = serviceType === 'rental' ? formatRentalTime(rentalElapsedSeconds) : '';

  const footerIllustrationBg = {
    backgroundImage: 'url(/home_footer_gemini.png)',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center calc(100% + 65px)',
    backgroundSize: 'cover',
  };

  const footerIllustrationFadeMask = {
    WebkitMaskImage:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
    maskImage:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  };

  const footerIllustrationEdgeBlurMask = {
    WebkitMaskImage:
      'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 16%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 100%)',
    maskImage:
      'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 16%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 100%)',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] pb-24 max-w-lg mx-auto relative overflow-hidden font-sans no-scrollbar">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />
      <div className="absolute top-52 left-[-60px] h-52 w-52 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-28 right-[-40px] h-40 w-40 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />


      <div className="relative z-10 space-y-4 pb-6">
        <HeaderGreeting />

        {isScheduledAcceptedRide && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate(trackingPath, { state: currentRide })}
            className="mx-5 block w-[calc(100%-2.5rem)] overflow-hidden rounded-[32px] border border-emerald-100/50 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 text-left shadow-[0_24px_48px_rgba(16,185,129,0.12)]"
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">
                <ShieldCheck size={12} strokeWidth={3} />
                Confirmed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Live Status</span>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div className="min-w-0">
                <h2 className="text-[32px] font-black tracking-tight text-slate-950 leading-none">
                  {scheduledCountdown}
                </h2>
                <p className="mt-2 text-[14px] font-bold text-slate-500">
                  {scheduledDateLabel}
                </p>
              </div>
              <div className="relative mb-1">
                <div className="absolute -inset-4 rounded-full bg-emerald-100/30 blur-xl animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 shadow-2xl shadow-slate-950/40 border border-slate-800">
                  <img src={currentRideIcon} alt="" className="h-10 w-10 object-contain" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/60 p-3 shadow-sm border border-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <User size={20} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Driver & Vehicle</p>
                  <p className="mt-1 truncate text-[13px] font-black text-slate-900">{driverName} • {vehicleLabel}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Fare</p>
                <p className="mt-1 text-[13px] font-black text-slate-900">₹{Number(currentRide?.fare || 0).toFixed(0)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3.5 text-white shadow-xl shadow-slate-950/20">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Trip Route</p>
                <div className="mt-1 flex items-center gap-2 text-[12px] font-bold">
                  <span className="truncate max-w-[100px] text-white/90">{(currentRide?.pickup || 'Pickup').split(',')[0]}</span>
                  <ChevronRight size={12} className="text-white/30" />
                  <span className="truncate max-w-[100px] text-emerald-400">{(currentRide?.drop || 'Drop').split(',')[0]}</span>
                </div>
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                <ChevronRight size={18} strokeWidth={3} className="text-white" />
              </div>
            </div>
          </motion.button>
        )}
        
        {/* Active Rental Dashboard - Only visible during active rentals */}
        {serviceType === 'rental' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 overflow-hidden rounded-[32px] border border-white/60 bg-white/50 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl relative"
          >
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-20 w-24 flex items-center justify-center shrink-0">
                  <img src={currentRideIcon} alt="" className="h-full w-full object-contain scale-110" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {rideStage === 'end_requested' ? 'Review Pending' : 'Live Rental'}
                  </p>
                  <h2 className="text-[24px] font-black tracking-tight text-slate-900 leading-none mt-1">
                    {rentalTimerLabel}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <p className="text-[12px] font-black text-slate-900">
                      {currentRide.vehicle?.name || 'Assigned Vehicle'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-right space-y-2.5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Current Fare</p>
                  <p className="text-[18px] font-black text-slate-900 tracking-tight">Rs {rentalCurrentCharge.toFixed(0)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEndRide();
                  }}
                  disabled={endingRide || rideStage === 'end_requested'}
                  className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-[0_8px_16px_rgba(15,23,42,0.2)] active:scale-95 disabled:opacity-50 disabled:grayscale transition-all"
                >
                  {endingRide ? 'Ending...' : rideStage === 'end_requested' ? 'Pending' : 'End Ride'}
                </button>
              </div>
            </div>
            
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />
          </motion.div>
        )}

        <ServiceGrid />
        <LocationMapSection />
        <ActionsSection />
        <PromoBanners />
        <ExplorerSection />
        <div
          className="relative w-full"
          style={{
            height: 360,
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              filter: 'grayscale(1) contrast(1.08)',
              ...footerIllustrationFadeMask,
            }}
          >
            <div className="absolute inset-0" style={footerIllustrationBg} />
            <div
              className="absolute inset-0 opacity-55"
              style={{
                ...footerIllustrationBg,
                filter: 'blur(3px)',
                ...footerIllustrationEdgeBlurMask,
              }}
            />
          </div>

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-white/80 via-white/35 to-transparent" />
            <div className="relative z-10 flex h-full items-center justify-center px-6 pt-16 text-left">
              <div className="flex max-w-[340px] flex-col items-start px-2 py-2 -translate-x-6 translate-y-12">
                <div className="text-[30px] font-serif font-extrabold tracking-[0.28em] text-slate-600 drop-shadow-[0_2px_10px_rgba(255,255,255,0.85)]">
                  #{appName.toUpperCase()}
                </div>
                <div className="mt-1 text-[12px] font-sans italic font-semibold tracking-wide text-slate-600 drop-shadow-[0_1px_8px_rgba(255,255,255,0.8)]">
                  Your Trusted Journey Partner
                </div>
                <div className="mt-2 text-[10px] font-sans font-semibold tracking-[0.22em] text-slate-500 drop-shadow-[0_1px_8px_rgba(255,255,255,0.8)]">
                  Made for Everyone, Crafted for You.
                  <img
                    src="/flag-in.svg"
                    alt="India"
                    className="ml-0.5 inline-block h-[2.2em] w-[1.2em] align-[-0.88em]"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-24 left-0 right-0 h-24 opacity-70 pointer-events-none">
        <img
          src="/city_skyline_footer.png"
          alt="City"
          className="w-full h-full object-cover object-bottom mix-blend-multiply contrast-125"
        />
      </div>

      <AnimatePresence>
        {currentRide && (
          <Motion.button
            type="button"
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.96 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(trackingPath, { state: currentRide })}
            className="fixed bottom-24 left-4 right-4 z-[60] mx-auto flex max-w-[calc(32rem-2rem)] items-center gap-3 rounded-[20px] border border-white/80 bg-white/95 px-4 py-3 text-left shadow-[0_12px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-slate-900 shadow-lg">
              <img src={currentRideIcon} alt={vehicleLabel} className="h-8 w-8 object-contain" draggable={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-600">
                  {isScheduledAcceptedRide
                    ? 'Scheduled ride ready'
                    : serviceType === 'parcel'
                      ? 'Parcel in progress'
                      : serviceType === 'rental'
                        ? (rideStage === 'end_requested' ? 'Rental end review' : 'Rental in progress')
                        : 'Current Ride'}
                </p>
              </div>
              <p className="mt-0.5 truncate text-[14px] font-black leading-tight text-slate-900">
                {rideStageContextLabel}
              </p>
              {isScheduledAcceptedRide ? (
                <div className="mt-1 flex items-center gap-2 text-[10px] font-black text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    <CalendarClock size={11} />
                    {scheduledDateLabel}
                  </span>
                  {scheduledCountdown ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {scheduledCountdown}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <MapPin size={12} className="shrink-0 text-emerald-500" strokeWidth={2.5} />
                <span className="truncate">{currentRide.pickup || 'Pickup location'}</span>
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <MapPin size={12} className="shrink-0 text-orange-500" strokeWidth={2.5} />
                <span className="truncate">{currentRide.drop || 'Drop location'}</span>
              </div>
              {serviceType === 'rental' ? (
                <div className="mt-1 flex items-center gap-2 text-[10px] font-black text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                    <Clock3 size={11} className="text-slate-500" />
                    {rentalTimerLabel}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    Live charge Rs {rentalCurrentCharge.toFixed(0)}
                  </span>
                </div>
              ) : isScheduledAcceptedRide ? (
                <div className="mt-1 flex items-center gap-2 text-[10px] font-black text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                    <User size={11} />
                    {driverName}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    Live tracking unlocks soon
                  </span>
                </div>
              ) : null}
            </div>
            <div className="shrink-0 text-right flex flex-col items-end gap-1">
              <p className="text-[11px] font-black text-slate-900 px-2 py-0.5 rounded-lg bg-slate-100">
                Rs {Number(serviceType === 'rental' ? rentalCurrentCharge : currentRide.fare || 0).toFixed(0)}
              </p>
              <div className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-slate-900 text-white shadow-md">
                <ChevronRight size={18} strokeWidth={3} />
              </div>
            </div>
          </Motion.button>
        )}
      </AnimatePresence>

      <BottomNavbar />
    </div>
  );
};

export default Home;
