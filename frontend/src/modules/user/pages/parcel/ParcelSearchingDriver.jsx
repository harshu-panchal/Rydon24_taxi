import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ShieldCheck, 
  Phone, 
  MessageCircle, 
  Shield, 
  CheckCircle2, 
  Navigation, 
  AlertTriangle, 
  Star, 
  Package,
  Locate,
  Zap,
  MapPin,
  Clock,
  ChevronRight
} from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';
import { socketService } from '../../../../shared/api/socket';
import { getLocalUserToken, userAuthService } from '../../services/authService';
import { getCurrentRide, isActiveCurrentRide, saveCurrentRide } from '../../services/currentRideService';

const Motion = motion;

const generateOTP = () => String(Math.floor(1000 + Math.random() * 9000));
const unwrap = (response) => response?.data?.data || response?.data || response;
const unwrapLoginPayload = (response) => {
  const payload = unwrap(response);
  return payload?.token ? payload : payload?.data || {};
};
const DRIVER_PLACEHOLDER = { name: 'Delivery Captain', rating: '4.9', vehicle: 'Bike', plate: 'Assigned', phone: '', eta: 2 };
const STAGES = { SEARCHING: 'searching', ACCEPTED: 'accepted' };
const ACTIVE_DELIVERY_POLL_MS = 1500;
const SEARCH_TIMEOUT_MS = 20000;
const CONSUMED_SEARCH_NONCE_PREFIX = 'rydon24_consumed_parcel_search_nonce:';
const ACTIVE_SEARCH_NONCES = new Set();
const ACTIVE_SEARCH_NONCE_CLEANUPS = new Map();

const withUserAuthorization = (token) => (
  token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {}
);

const normalizeDriver = (driver = {}) => ({
  name: driver.name || 'Delivery Captain',
  rating: driver.rating || '4.9',
  vehicle: driver.vehicleType || 'Bike',
  plate: driver.vehicleNumber || 'Assigned',
  phone: driver.phone || '',
  eta: driver.eta || 2,
});

const normalizeLabel = (value = '') => String(value).trim().toLowerCase();

const normalizePreferredVehicleTypes = (value = '') =>
  String(value || '')
    .split(',')
    .map((entry) => normalizeLabel(entry))
    .filter(Boolean);

const normalizeVehicleLabel = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const getVehicleTokens = (vehicle = {}) =>
  [
    vehicle.name,
    vehicle.vehicle_type,
    vehicle.label,
    vehicle.icon_types,
    vehicle.transport_type,
  ]
    .map(normalizeVehicleLabel)
    .filter(Boolean);

const findVehicleMatch = (types, preferredLabel) => {
  const exactMatch = types.find((type) => normalizeLabel(type.name || type.vehicle_type || type.label) === preferredLabel);
  if (exactMatch) return exactMatch;
  const transportMatch = types.find((type) => normalizeLabel(type.transport_type) === preferredLabel);
  if (transportMatch) return transportMatch;
  return types.find((type) => {
    const haystack = `${type.name || ''} ${type.vehicle_type || ''} ${type.label || ''} ${type.icon_types || ''} ${type.transport_type || ''}`.toLowerCase();
    return haystack.includes(preferredLabel);
  });
};

const pickParcelVehicles = (types = [], preferredType = '') => {
  const activeTypes = types.filter((type) => type.active !== false && Number(type.status ?? 1) !== 0);
  const preferredLabels = normalizePreferredVehicleTypes(preferredType).filter((entry) => entry !== 'both');
  const matches = [];
  for (const preferredLabel of preferredLabels) {
    const match = findVehicleMatch(activeTypes, preferredLabel);
    if (match && !matches.some((item) => String(item._id || item.id) === String(match._id || match.id))) {
      matches.push(match);
    }
  }
  if (matches.length > 0) return matches;
  if (!preferredLabels.length) {
    const parcelMatches = activeTypes.filter((type) => {
      const value = `${type.name || ''} ${type.icon_types || ''} ${type.transport_type || ''}`.toLowerCase();
      return value.includes('bike') || value.includes('delivery') || value.includes('parcel') || value.includes('car');
    });
    if (parcelMatches.length > 0) return parcelMatches;
    return activeTypes;
  }
  const parcelFirst = activeTypes.find((type) => {
    const value = `${type.name || ''} ${type.icon_types || ''} ${type.transport_type || ''}`.toLowerCase();
    return value.includes('bike') || value.includes('delivery') || value.includes('parcel');
  });
  return parcelFirst ? [parcelFirst] : activeTypes.slice(0, 1);
};

const findVehicleById = (types = [], vehicleId = '') =>
  types.find((type) => String(type?._id || type?.id) === String(vehicleId || '')) || null;

const isVehicleCompatibleWithGoodsType = (vehicle, goodsTypeFor = '') => {
  const allowedLabels = String(goodsTypeFor || 'both')
    .split(',')
    .map(normalizeVehicleLabel)
    .filter(Boolean);

  if (!allowedLabels.length || allowedLabels.includes('both') || allowedLabels.includes('all')) {
    return true;
  }

  const tokens = getVehicleTokens(vehicle);
  return allowedLabels.some((label) => tokens.some((token) => token.includes(label) || label.includes(token)));
};

const ActionBtn = ({ icon, label, onClick, color = 'bg-gray-50 text-gray-700' }) => (
  <Motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-gray-100 transition-all ${color}`}
  >
    {React.createElement(icon, { size: 18, strokeWidth: 2.5 })}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </Motion.button>
);

const DriverCard = ({ driver, banner, bannerGradient, children }) => (
  <div className="rounded-[40px] bg-white shadow-[0_32px_64px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden">
    <div className={`px-6 py-4 flex items-center gap-3 ${bannerGradient}`}>
      {banner}
    </div>
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-[24px] bg-indigo-50 overflow-hidden border-2 border-white shadow-sm">
            <img 
              src={`https://ui-avatars.com/api/?name=${driver.name.replace(' ', '+')}&background=4f46e5&color=fff&bold=true&size=128`} 
              className="w-full h-full object-cover" 
              alt="Driver" 
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1 shadow-sm">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-black text-gray-900">{driver.rating}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 leading-tight tracking-tight">{driver.name}</h3>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tight">{driver.vehicle} • {driver.plate}</p>
          <div className="flex items-center gap-1.5 mt-2 text-indigo-600">
            <Clock size={12} strokeWidth={3} />
            <span className="text-[11px] font-black uppercase tracking-wider">Arriving in {driver.eta} mins</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  </div>
);

const ParcelSearchingDriver = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = useMemo(() => location.state || {}, [location.state]);
  const [stage, setStage] = useState(STAGES.SEARCHING);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [otp] = useState(generateOTP);
  const [driver, setDriver] = useState(DRIVER_PLACEHOLDER);
  const [searchStatus, setSearchStatus] = useState('Preparing dispatch...');
  const [bookingError, setBookingError] = useState('');
  const activeRidePollRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const requestStartedRef = useRef(false);
  const cleanupSearchRef = useRef(null);
  const cleanupDelayRef = useRef(null);
  const trackingStartedRef = useRef(false);
  const driverRef = useRef(driver);
  const activeRideIdRef = useRef('');
  const searchNonce = String(routeState.searchNonce || '');
  const preferredVehicleType = String(
    routeState.goodsTypeFor ||
    routeState.selectedGoodsType?.goodsTypeFor ||
    routeState.selectedGoodsType?.goods_types_for ||
    routeState.selectedGoodsType?.goods_type_for ||
    '',
  ).trim();

  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  useEffect(() => {
    if (!searchNonce) {
      navigate('/', { replace: true });
      return;
    }

    const nonceKey = `${CONSUMED_SEARCH_NONCE_PREFIX}${searchNonce}`;
    const pendingCleanup = ACTIVE_SEARCH_NONCE_CLEANUPS.get(searchNonce);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      ACTIVE_SEARCH_NONCE_CLEANUPS.delete(searchNonce);
    }

    if (ACTIVE_SEARCH_NONCES.has(searchNonce)) return;

    if (sessionStorage.getItem(nonceKey)) {
      const activeRide = getCurrentRide();
      if (isActiveCurrentRide(activeRide)) {
        navigate('/parcel/tracking', { replace: true, state: activeRide });
        return;
      }
      navigate('/', { replace: true });
      return;
    }

    sessionStorage.setItem(nonceKey, '1');
    ACTIVE_SEARCH_NONCES.add(searchNonce);

    return () => {
      const cleanupId = setTimeout(() => {
        ACTIVE_SEARCH_NONCES.delete(searchNonce);
        ACTIVE_SEARCH_NONCE_CLEANUPS.delete(searchNonce);
      }, 0);
      ACTIVE_SEARCH_NONCE_CLEANUPS.set(searchNonce, cleanupId);
    };
  }, [navigate, searchNonce]);

  useEffect(() => {
    if (cleanupDelayRef.current) {
      clearTimeout(cleanupDelayRef.current);
      cleanupDelayRef.current = null;
    }

    if (requestStartedRef.current) {
      return () => {
        cleanupDelayRef.current = setTimeout(() => {
          cleanupSearchRef.current?.();
        }, 0);
      };
    }

    if (!searchNonce) {
      navigate('/', { replace: true });
      return undefined;
    }

    requestStartedRef.current = true;
    let disposed = false;

    const moveToTracking = ({ acceptedDriver, rideId, rideSnapshot }) => {
      if (disposed || trackingStartedRef.current) return;
      const nextDriver = normalizeDriver(acceptedDriver);
      driverRef.current = nextDriver;
      setDriver(nextDriver);
      setStage(STAGES.ACCEPTED);
      setSearchStatus('Captain assigned!');
      activeRideIdRef.current = String(rideId || activeRideIdRef.current || '');
      trackingStartedRef.current = true;

      const nextRide = {
        ...routeState,
        type: 'parcel',
        serviceType: 'parcel',
        pickup: rideSnapshot?.pickupAddress || routeState.pickup,
        drop: rideSnapshot?.dropAddress || routeState.drop,
        rideId: activeRideIdRef.current,
        otp,
        driver: nextDriver,
        fare: rideSnapshot?.fare || routeState.fare || routeState.estimatedFare?.min || 45,
        paymentMethod: routeState.paymentMethod || 'Cash',
        status: 'accepted',
        parcel: rideSnapshot?.parcel || routeState.parcel || null,
      };

      saveCurrentRide(nextRide);
      clearInterval(activeRidePollRef.current);
      clearTimeout(searchTimeoutRef.current);
      setTimeout(() => {
        navigate('/parcel/tracking', { replace: true, state: nextRide });
      }, 1800);
    };

    const hydrateAcceptedDelivery = async (token) => {
      if (disposed) return null;
      const activeResponse = await api.get('/deliveries/active/me', {
        ...withUserAuthorization(token),
        params: { t: Date.now() },
      });
      const activeDelivery = unwrap(activeResponse);
      if (!activeDelivery?.rideId) return null;
      return activeDelivery;
    };

    const onRideSearchUpdate = ({ matchedDrivers, radius }) => {
      const radiusKm = radius ? (Number(radius) / 1000).toFixed(1) : '';
      setSearchStatus(
        matchedDrivers > 0
          ? `${matchedDrivers} Captain${matchedDrivers > 1 ? 's' : ''} notified within ${radiusKm}km`
          : `Scanning nearby agents (${radiusKm}km)...`,
      );
    };

    const onRideAccepted = ({ driver: acceptedDriver, rideId, parcel }) => {
      moveToTracking({ acceptedDriver, rideId, rideSnapshot: { fare: routeState.fare, parcel } });
    };

    const onRideState = (payload) => {
      if (!payload || String(payload.rideId || '') !== String(activeRideIdRef.current || '')) return;
      if (payload.status === 'accepted' || payload.liveStatus === 'accepted') {
        moveToTracking({ acceptedDriver: payload.driver, rideId: payload.rideId, rideSnapshot: payload });
      }
    };

    const onRideStatusUpdated = async (payload) => {
      if (!payload || String(payload.rideId || '') !== String(activeRideIdRef.current || '')) return;
      if (payload.status === 'accepted' || payload.liveStatus === 'accepted') {
        const activeDelivery = await hydrateAcceptedDelivery(getLocalUserToken()).catch(() => null);
        moveToTracking({
          acceptedDriver: activeDelivery?.driver || driverRef.current,
          rideId: payload.rideId,
          rideSnapshot: activeDelivery || payload,
        });
      }
    };

    const onRideCancelled = ({ reason }) => {
      setBookingError(reason || 'Search timed out.');
      setSearchStatus(reason || 'Search timed out.');
      setStage(STAGES.SEARCHING);
      clearTimeout(searchTimeoutRef.current);
    };

    const onError = ({ message }) => {
      setBookingError(message || 'Error occurred.');
      setSearchStatus(message || 'Error occurred.');
      clearTimeout(searchTimeoutRef.current);
    };

    socketService.on('rideSearchUpdate', onRideSearchUpdate);
    socketService.on('rideAccepted', onRideAccepted);
    socketService.on('ride:state', onRideState);
    socketService.on('ride:status:updated', onRideStatusUpdated);
    socketService.on('rideCancelled', onRideCancelled);
    socketService.on('errorMessage', onError);

    cleanupSearchRef.current = () => {
      if (disposed) return;
      disposed = true;
      requestStartedRef.current = false;
      clearInterval(activeRidePollRef.current);
      clearTimeout(searchTimeoutRef.current);
      activeRidePollRef.current = null;
      socketService.off('rideSearchUpdate', onRideSearchUpdate);
      socketService.off('rideAccepted', onRideAccepted);
      socketService.off('ride:state', onRideState);
      socketService.off('ride:status:updated', onRideStatusUpdated);
      socketService.off('rideCancelled', onRideCancelled);
      socketService.off('errorMessage', onError);
    };

    (async () => {
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
        if (disposed) return;

        setSearchStatus('Optimizing route...');
        const vehicleCatalogResponse = await api.get('/users/vehicle-types');
        if (disposed) return;

        const vehicleCatalog = unwrap(vehicleCatalogResponse);
        const vehicleTypes = vehicleCatalog?.vehicle_types || vehicleCatalog?.results || (Array.isArray(vehicleCatalog) ? vehicleCatalog : []);
        const requestedVehicle = findVehicleById(vehicleTypes, routeState.selectedVehicleId);
        const selectedVehicleTypes = requestedVehicle && isVehicleCompatibleWithGoodsType(requestedVehicle, preferredVehicleType)
          ? [requestedVehicle]
          : pickParcelVehicles(vehicleTypes, preferredVehicleType);
        const selectedVehicleType = selectedVehicleTypes[0];
        const selectedVehicleTypeIds = selectedVehicleTypes.map((type) => type?._id || type?.id).filter(Boolean);

        if (selectedVehicleTypeIds.length === 0) throw new Error('No vehicles available.');

        const rideRequestConfig = userToken ? { headers: { Authorization: `Bearer ${userToken}` } } : {};
        const parcelPayload = {
          ...(routeState.parcel || {}),
          category: routeState.parcel?.category || routeState.parcelType || 'Parcel',
          weight: routeState.parcel?.weight || routeState.weight || 'Under 5kg',
          description: routeState.parcel?.description || routeState.description || '',
          deliveryScope: routeState.parcel?.deliveryScope || routeState.deliveryScope || 'city',
          isOutstation: Boolean(routeState.parcel?.isOutstation || routeState.isOutstation || routeState.deliveryScope === 'outstation'),
          senderName: routeState.parcel?.senderName || routeState.senderName || '',
          senderMobile: routeState.parcel?.senderMobile || routeState.senderMobile || '',
          receiverName: routeState.parcel?.receiverName || routeState.receiverName || '',
          receiverMobile: routeState.parcel?.receiverMobile || routeState.receiverMobile || '',
          goodsTypeFor: preferredVehicleType || routeState.parcel?.goodsTypeFor || 'both',
        };

        const socket = socketService.connect({ role: 'user', token: userToken });
        const response = await api.post('/deliveries', {
          pickup: routeState.pickupCoords || [75.9048, 22.7039],
          drop: routeState.dropCoords || [75.8937, 22.7533],
          pickupAddress: routeState.pickup || '',
          dropAddress: routeState.drop || '',
          fare: routeState.fare || routeState.estimatedFare?.min || 45,
          vehicleTypeId: selectedVehicleTypeIds[0],
          vehicleTypeIds: selectedVehicleTypeIds,
          vehicleIconType: selectedVehicleType.icon_types || 'bike',
          vehicleIconUrl: selectedVehicleType.map_icon || selectedVehicleType.icon || selectedVehicleType.image || '',
          paymentMethod: routeState.paymentMethod || 'Cash',
          type: 'parcel',
          parcel: parcelPayload,
        }, rideRequestConfig);

        if (disposed) return;

        const payload = unwrap(response);
        const rideId = payload?.rideId || payload?.realtime?.rideId || payload?.ride?._id || payload?._id || payload?.id;
        activeRideIdRef.current = String(rideId || '');

        if (socket && rideId) {
          socketService.emit('joinRide', { rideId });
          socketService.emit('ride:join', { rideId });
        }

        const pollActiveRide = async () => {
          if (disposed) return;
          try {
            const activeRide = await hydrateAcceptedDelivery(userToken);
            if (disposed || !activeRide?.rideId) return;
            const isThisRide = String(activeRide.rideId || '') === String(rideId || '');
            const rideState = String(activeRide.status || activeRide.liveStatus || '').toLowerCase();
            const isAcceptedRide = ['accepted', 'arriving', 'started', 'ongoing'].includes(rideState);

            if (isThisRide && ['searching', 'pending'].includes(rideState)) {
              setStage(STAGES.SEARCHING);
              setSearchStatus('Broadcasted to nearby Captains...');
            }
            if (isThisRide && isAcceptedRide) {
              moveToTracking({ acceptedDriver: activeRide.driver || driverRef.current, rideId: activeRide.rideId, rideSnapshot: activeRide });
            }
          } catch { /* Socket stays primary */ }
        };

        clearInterval(activeRidePollRef.current);
        activeRidePollRef.current = setInterval(pollActiveRide, ACTIVE_DELIVERY_POLL_MS);
        pollActiveRide();
        if (!disposed) setSearchStatus('Searching nearby Captains...');

        searchTimeoutRef.current = setTimeout(async () => {
          if (disposed || trackingStartedRef.current) return;
          const activeRide = await hydrateAcceptedDelivery(userToken).catch(() => null);
          const rideState = String(activeRide?.status || activeRide?.liveStatus || '').toLowerCase();
          if (!activeRide?.rideId || rideState === 'cancelled') {
            setBookingError('No response from captains.');
            setSearchStatus('Try again in a moment.');
            clearInterval(activeRidePollRef.current);
            return;
          }
          if (['accepted', 'arriving', 'started', 'ongoing'].includes(rideState)) {
            moveToTracking({ acceptedDriver: activeRide.driver || driverRef.current, rideId: activeRide.rideId, rideSnapshot: activeRide });
            return;
          }
        }, SEARCH_TIMEOUT_MS);
      } catch (error) {
        if (disposed) return;
        const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Dispatch failed.';
        setBookingError(errorMessage);
        setSearchStatus('Error creating booking.');
        clearTimeout(searchTimeoutRef.current);
      }
    })();

    return () => {
      cleanupDelayRef.current = setTimeout(() => {
        cleanupSearchRef.current?.();
      }, 0);
    };
  }, [navigate, otp, preferredVehicleType, routeState, searchNonce]);

  const handleCancel = () => {
    clearInterval(activeRidePollRef.current);
    navigate('/');
  };

  const isSearching = stage === STAGES.SEARCHING;
  const isAccepted = stage === STAGES.ACCEPTED;

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative font-sans overflow-hidden">
      {/* Dynamic Map Background with Overlays */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[1px] z-10" />
        <img 
          src="/map image.avif" 
          className="w-full h-full object-cover scale-110 grayscale-[0.3] opacity-60" 
          alt="Map Background" 
        />
        
        {/* Animated Radial Gradients for Depth */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-white/80 via-transparent to-white" />
      </div>

      {/* Header Overlay */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-8 left-4 right-4 z-20 flex items-center gap-3"
      >
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-[28px] p-4 shadow-xl shadow-black/5 border border-white/80 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Package size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Parcel Trip</p>
            <div className="flex items-center gap-2 text-xs font-black text-gray-900 truncate">
              <span className="truncate">{routeState.pickup || 'Source'}</span>
              <ChevronRight size={10} className="text-gray-300 shrink-0" />
              <span className="truncate">{routeState.drop || 'Destination'}</span>
            </div>
          </div>
        </div>
        
        {isSearching && (
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => setShowCancelConfirm(true)} 
            className="w-12 h-12 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/5 border border-white/80 flex items-center justify-center text-gray-900"
          >
            <X size={20} strokeWidth={2.5} />
          </motion.button>
        )}
      </motion.div>

      {/* Center Search Animation */}
      <AnimatePresence>
        {isSearching && (
          <Motion.div 
            key="search-core"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="relative">
              <Motion.div 
                animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }} 
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/10 rounded-full border border-indigo-500/20" 
              />
              <Motion.div 
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }} 
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }} 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/20 rounded-full border border-indigo-500/30" 
              />
              
              <div className="relative w-20 h-20 bg-white rounded-[32px] shadow-2xl flex items-center justify-center border-4 border-indigo-50 group">
                <Motion.div 
                  animate={{ 
                    y: [0, -5, 0],
                    rotate: [0, 5, -5, 0]
                  }} 
                  transition={{ 
                    repeat: Infinity, 
                    duration: 4, 
                    ease: "easeInOut" 
                  }}
                >
                  <Package size={32} className="text-indigo-600" strokeWidth={2.5} />
                </Motion.div>
                
                {/* Scanning Light Effect */}
                <Motion.div 
                  animate={{ y: [-30, 30, -30] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent blur-[1px] opacity-50"
                />
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Status Card */}
      <div className="absolute bottom-8 left-4 right-4 z-20">
        <AnimatePresence mode="wait">
          {isSearching && (
            <Motion.div 
              key="searching-card"
              initial={{ y: 60, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 40, opacity: 0 }} 
              className="rounded-[40px] bg-white shadow-[0_32px_64px_rgba(0,0,0,0.15)] p-8 border border-gray-100"
            >
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">Broadcasting...</h1>
                  <p className="text-sm font-bold text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                    {searchStatus}
                  </p>
                </div>

                <div className="flex justify-center gap-2">
                  {[0, 1, 2].map((index) => (
                    <Motion.div 
                      key={index} 
                      animate={{ scale: [1, 1.4, 1], backgroundColor: ['#E5E7EB', '#6366F1', '#E5E7EB'] }} 
                      transition={{ repeat: Infinity, duration: 1, delay: index * 0.2 }} 
                      className="w-2.5 h-2.5 rounded-full" 
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
                  <div className="flex flex-col items-center gap-1">
                    <Zap size={18} className="text-amber-500 fill-amber-500/20" strokeWidth={2.5} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Priority</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 border-l border-gray-50">
                    <ShieldCheck size={18} className="text-emerald-500 fill-emerald-500/20" strokeWidth={2.5} />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Insured</span>
                  </div>
                </div>

                {bookingError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span className="text-[11px] font-black text-red-600">{bookingError}</span>
                  </motion.div>
                )}

                <button 
                  onClick={() => setShowCancelConfirm(true)} 
                  className="w-full py-2 text-[11px] font-black text-gray-300 hover:text-red-400 transition-colors uppercase tracking-widest"
                >
                  Cancel Dispatch
                </button>
              </div>
            </Motion.div>
          )}

          {isAccepted && (
            <Motion.div 
              key="accepted-card"
              initial={{ y: 60, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 40, opacity: 0 }}
            >
              <DriverCard 
                driver={driver} 
                bannerGradient="bg-gradient-to-r from-indigo-600 to-violet-600" 
                banner={
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                      <CheckCircle2 size={20} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-black text-sm uppercase tracking-tight">Captain Confirmed</p>
                      <p className="text-indigo-100 text-[10px] font-bold">Your delivery agent is on the way</p>
                    </div>
                  </>
                }
              >
                <div className="flex gap-4">
                  <ActionBtn icon={Phone} label="Call" onClick={() => window.open(`tel:${driver.phone}`)} />
                  <ActionBtn icon={MessageCircle} label="Chat" onClick={() => navigate('/ride/chat', { state: { driver } })} />
                  <ActionBtn icon={Shield} label="Safety" onClick={() => navigate('/support')} color="bg-indigo-50 text-indigo-600 border-indigo-100" />
                </div>

                <Motion.div 
                  initial={{ y: 10, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  transition={{ delay: 0.3 }}
                  className="rounded-[32px] bg-slate-900 p-6 flex items-center justify-between shadow-xl"
                >
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Pickup OTP</p>
                    <p className="text-[11px] font-bold text-slate-400">Share only with your captain</p>
                  </div>
                  <div className="flex gap-1.5">
                    {otp.split('').map((digit, index) => (
                      <Motion.div 
                        key={index} 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className="w-10 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center backdrop-blur-md"
                      >
                        <span className="text-xl font-black text-white">{digit}</span>
                      </Motion.div>
                    ))}
                  </div>
                </Motion.div>
              </DriverCard>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Modals */}
      <AnimatePresence>
        {showCancelConfirm && (
          <>
            <Motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowCancelConfirm(false)} 
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] max-w-lg mx-auto" 
            />
            <Motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 40 }} 
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-sm bg-white rounded-[40px] p-8 z-[101] shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-red-500">
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Cancel Dispatch?</h3>
              <p className="text-sm font-bold text-gray-400 mb-8 leading-relaxed">
                We've almost found a captain for your parcel. Are you sure you want to stop?
              </p>
              <div className="flex flex-col gap-3">
                <Motion.button 
                  whileTap={{ scale: 0.96 }} 
                  onClick={handleCancel} 
                  className="w-full bg-red-500 text-white py-5 rounded-[24px] text-sm font-black uppercase tracking-widest shadow-xl shadow-red-500/20"
                >
                  Yes, Stop Search
                </Motion.button>
                <button 
                  onClick={() => setShowCancelConfirm(false)} 
                  className="w-full py-4 text-sm font-black text-gray-400 uppercase tracking-widest"
                >
                  Wait for Captain
                </button>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParcelSearchingDriver;
