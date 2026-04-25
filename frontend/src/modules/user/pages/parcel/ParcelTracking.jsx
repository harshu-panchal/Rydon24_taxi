import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  MessageCircle, 
  AlertTriangle, 
  Shield, 
  Star, 
  ChevronLeft, 
  Share2, 
  Package, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Zap,
  Navigation,
  ChevronRight
} from 'lucide-react';
import { GoogleMap, MarkerF, OverlayView, OverlayViewF, PolylineF } from '@react-google-maps/api';
import { HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../../admin/utils/googleMaps';
import { socketService } from '../../../../shared/api/socket';
import api from '../../../../shared/api/axiosInstance';
import { BACKEND_ORIGIN } from '../../../../shared/api/runtimeConfig';
import { clearCurrentRide, getCurrentRide, saveCurrentRide } from '../../services/currentRideService';

// Assets (Using the same icons as RideTracking)
import carIcon from '../../../../assets/icons/car.png';
import bikeIcon from '../../../../assets/icons/bike.png';
import autoIcon from '../../../../assets/icons/auto.png';
import deliveryIcon from '../../../../assets/icons/Delivery.png';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 22.7196, lng: 75.8577 };
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'delivered']);
const ACTIVE_RIDE_VALIDATE_MS = 15000;
const COMPLETED_TRACKING_STATUSES = new Set(['completed', 'delivered']);

const toLatLng = (coords, fallback = DEFAULT_CENTER) => {
  const [lng, lat] = coords || [];
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }
  return fallback;
};

const arePositionsNearlyEqual = (first, second, threshold = 0.0002) => (
  Math.abs(Number(first?.lat ?? 0) - Number(second?.lat ?? 0)) < threshold &&
  Math.abs(Number(first?.lng ?? 0) - Number(second?.lng ?? 0)) < threshold
);

const normalizeHeading = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return ((numeric % 360) + 360) % 360;
};

const calculateBearing = (from, to, fallback = 0) => {
  if (!from || !to || arePositionsNearlyEqual(from, to, 0.00001)) return fallback;
  const fromLat = Number(from.lat) * (Math.PI / 180);
  const toLat = Number(to.lat) * (Math.PI / 180);
  const deltaLng = (Number(to.lng) - Number(from.lng)) * (Math.PI / 180);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return normalizeHeading(Math.atan2(y, x) * (180 / Math.PI), fallback);
};

const getRouteHeading = (position, path = [], fallback = 0) => {
  const nextPoint = path.find((point) => !arePositionsNearlyEqual(position, point, 0.00001));
  return nextPoint ? calculateBearing(position, nextPoint, fallback) : fallback;
};

const RotatingVehicleMarker = ({ position, iconUrl = deliveryIcon, heading = 0, title = 'Delivery Captain' }) => (
  <OverlayViewF
    position={position}
    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
  >
    <div title={title} className="pointer-events-none flex h-14 w-14 items-center justify-center">
      <div
        className="flex h-11 w-11 items-center justify-center transition-transform duration-500 ease-out"
        style={{ transform: `rotate(${normalizeHeading(heading)}deg)` }}
      >
        <img
          src={iconUrl || deliveryIcon}
          alt={title}
          className="h-12 w-12 object-contain drop-shadow-[0_8px_10px_rgba(15,23,42,0.35)]"
          draggable={false}
        />
      </div>
    </div>
  </OverlayViewF>
);

const getTrackingVehicleIcon = (ride, driver) => {
  const customIcon = String(
    ride?.vehicleIconUrl ||
    ride?.vehicle?.vehicleIconUrl ||
    ride?.vehicle?.icon ||
    driver?.vehicleIconUrl ||
    driver?.map_icon ||
    driver?.icon ||
    '',
  ).trim();
  if (customIcon) return customIcon;
  const iconType = String(ride?.vehicleIconType || driver?.vehicleIconType || driver?.vehicleType || '').toLowerCase();
  if (iconType.includes('bike')) return bikeIcon;
  if (iconType.includes('auto')) return autoIcon;
  if (iconType.includes('car')) return carIcon;
  return deliveryIcon;
};

const resolveAssetUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:image\/|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${BACKEND_ORIGIN}${raw}`;
  return `${BACKEND_ORIGIN}/${raw.replace(/^\/+/, '')}`;
};

const mergeDriverSnapshot = (baseDriver = {}, incomingDriver = {}) => ({
  ...baseDriver,
  ...incomingDriver,
  profileImage: incomingDriver.profileImage || baseDriver.profileImage || '',
  vehicleImage: incomingDriver.vehicleImage || baseDriver.vehicleImage || '',
  name: incomingDriver.name || baseDriver.name || 'Delivery Captain',
  phone: incomingDriver.phone || baseDriver.phone || '',
  rating: incomingDriver.rating || baseDriver.rating || '4.9',
  plate: incomingDriver.plate || baseDriver.plate || incomingDriver.vehicleNumber || baseDriver.vehicleNumber || 'Assigned',
});

const ParcelTracking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const storedRide = useMemo(() => getCurrentRide(), []);
  const state = useMemo(() => location.state || storedRide || {}, [location.state, storedRide]);
  const [rideRealtime, setRideRealtime] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [map, setMap] = useState(null);
  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  const rideId = state.rideId || '';
  const tripStatus = String(rideRealtime?.status || state.liveStatus || state.status || 'accepted').toLowerCase();
  
  const pickupPosition = useMemo(() => toLatLng(rideRealtime?.pickup?.coordinates || state.pickupCoords || [75.9048, 22.7039]), [rideRealtime?.pickup?.coordinates, state.pickupCoords]);
  const dropPosition = useMemo(() => toLatLng(rideRealtime?.drop?.coordinates || state.dropCoords || [75.8937, 22.7533], pickupPosition), [pickupPosition, rideRealtime?.drop?.coordinates, state.dropCoords]);
  const driverPosition = useMemo(() => toLatLng(rideRealtime?.driverLocation?.coordinates, pickupPosition), [pickupPosition, rideRealtime?.driverLocation?.coordinates]);
  const activeDestination = useMemo(() => (tripStatus === 'started' ? dropPosition : pickupPosition), [dropPosition, pickupPosition, tripStatus]);

  const driver = useMemo(() => mergeDriverSnapshot(state.driver || {}, rideRealtime?.driver || {}), [state.driver, rideRealtime?.driver]);
  const vehicleIcon = getTrackingVehicleIcon(state, driver);
  const fare = rideRealtime?.fare || state.fare || 45;
  const otp = String(rideRealtime?.otp || state.otp || '');

  // Socket & Polling
  useEffect(() => {
    if (!rideId) return;
    const socket = socketService.connect({ role: 'user' });
    if (!socket) return;

    const onRideState = (payload) => {
      if (String(payload.rideId) === String(rideId)) setRideRealtime(payload);
    };
    const onLocationUpdated = (payload) => {
      if (String(payload.rideId) === String(rideId)) {
        setRideRealtime(prev => ({
          ...prev,
          driverLocation: { coordinates: payload.coordinates, heading: payload.heading }
        }));
      }
    };
    const onStatusUpdated = (payload) => {
      if (String(payload.rideId) === String(rideId)) {
        const nextStatus = String(payload.liveStatus || payload.status).toLowerCase();
        if (COMPLETED_TRACKING_STATUSES.has(nextStatus)) {
          navigate('/ride/complete', { state: { ...state, ...payload, status: nextStatus } });
        }
        setRideRealtime(prev => ({ ...prev, status: nextStatus }));
      }
    };

    socketService.on('ride:state', onRideState);
    socketService.on('ride:driver-location:updated', onLocationUpdated);
    socketService.on('ride:status:updated', onStatusUpdated);
    socketService.emit('ride:join', { rideId });

    return () => {
      socketService.off('ride:state', onRideState);
      socketService.off('ride:driver-location:updated', onLocationUpdated);
      socketService.off('ride:status:updated', onStatusUpdated);
    };
  }, [rideId, navigate, state]);

  // Route Path Update
  useEffect(() => {
    if (!isLoaded || !window.google) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: driverPosition,
      destination: activeDestination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') {
        setRoutePath(result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })));
      }
    });
  }, [isLoaded, driverPosition, activeDestination]);

  const handleCall = () => {
    if (driver.phone) window.open(`tel:${driver.phone}`, '_self');
  };

  const handleShare = () => {
    const text = `Tracking my delivery! Driver: ${driver.name}, Vehicle: ${driver.plate}. Destination: ${state.drop}`;
    if (navigator.share) navigator.share({ title: 'Parcel Tracking', text });
    else {
      navigator.clipboard.writeText(text);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative font-sans overflow-hidden">
      {/* Map Content */}
      <div className="absolute inset-0 z-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={driverPosition}
            zoom={15}
            onLoad={setMap}
            options={{
              disableDefaultUI: true,
              styles: [
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] }
              ]
            }}
          >
            {routePath.length > 0 && (
              <PolylineF
                path={routePath}
                options={{ strokeColor: '#4f46e5', strokeOpacity: 0.8, strokeWeight: 6 }}
              />
            )}
            <RotatingVehicleMarker position={driverPosition} iconUrl={vehicleIcon} />
            <MarkerF position={activeDestination} />
          </GoogleMap>
        ) : (
          <div className="h-full w-full bg-slate-200 animate-pulse" />
        )}
      </div>

      {/* Header Overlays */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-8 left-4 right-4 z-10 flex gap-3">
        <button onClick={() => navigate('/')} className="w-12 h-12 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/80 flex items-center justify-center text-gray-900">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl p-3 shadow-xl border border-white/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Package size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-900 truncate">
              <span>{state.pickup || 'Pickup'}</span>
              <ChevronRight size={10} className="text-gray-300" />
              <span>{state.drop || 'Drop'}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Toast Notification */}
      <AnimatePresence>
        {shareToast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-full text-xs font-black shadow-2xl">
            Tracking link copied!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Tracking Card */}
      <motion.div
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.1)] p-6 pb-8 border-t border-gray-100"
      >
        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />

        <div className="space-y-6">
          {/* Driver Info Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-[24px] bg-indigo-50 overflow-hidden border-2 border-white shadow-sm">
                  <img src={`https://ui-avatars.com/api/?name=${driver.name.replace(' ', '+')}&background=4f46e5&color=fff&bold=true`} alt="Driver" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1 shadow-sm">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-black text-gray-900">{driver.rating}</span>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-gray-900 leading-tight tracking-tight">{driver.name}</h3>
                <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-tight">{driver.plate} • {driver.vehicle || 'Delivery Agent'}</p>
                <div className="flex items-center gap-1.5 mt-2 text-indigo-600">
                  <Clock size={12} strokeWidth={3} />
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {tripStatus === 'started' ? 'Heading to Drop' : 'Arriving Shortly'}
                  </span>
                </div>
              </div>
            </div>

            {/* OTP Display */}
            {otp && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 flex flex-col items-center">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">OTP</span>
                <span className="text-xl font-black text-indigo-700 leading-none">{otp}</span>
              </div>
            )}
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-4 gap-3">
            <ActionButton icon={Phone} label="Call" onClick={handleCall} />
            <ActionButton icon={MessageCircle} label="Chat" onClick={() => navigate('/ride/chat', { state: { rideId, peer: driver } })} />
            <ActionButton icon={Share2} label="Share" onClick={handleShare} />
            <ActionButton icon={ShieldCheck} label="Safety" onClick={() => navigate('/support')} color="indigo" />
          </div>

          {/* Trip Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-50">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estimated Fare</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-gray-900">₹{fare}</span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">{state.paymentMethod || 'Cash'}</span>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCancelConfirm(true)}
              className="px-6 py-3 rounded-2xl border border-red-100 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
            >
              Cancel
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)} className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] max-w-lg mx-auto" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-sm bg-white rounded-[40px] p-8 z-[101] shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-red-500">
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Cancel Delivery?</h3>
              <p className="text-sm font-bold text-gray-400 mb-8 leading-relaxed">Your delivery agent is already moving. Cancellation may incur charges.</p>
              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    api.patch(`/rides/${rideId}/cancel`).finally(() => {
                      clearCurrentRide();
                      navigate('/');
                    });
                  }}
                  className="w-full bg-red-500 text-white py-5 rounded-[24px] text-sm font-black uppercase tracking-widest shadow-xl shadow-red-500/20"
                >
                  Yes, Cancel
                </motion.button>
                <button onClick={() => setShowCancelConfirm(false)} className="w-full py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Keep Tracking</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, color = 'gray' }) => (
  <motion.button
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 py-4 rounded-[24px] border ${color === 'indigo' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-700'}`}
  >
    <Icon size={20} strokeWidth={2.5} />
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </motion.button>
);

export default ParcelTracking;
