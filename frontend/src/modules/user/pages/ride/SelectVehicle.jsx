import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, X, Banknote, CreditCard, ChevronDown, ChevronRight, Clock3, LoaderCircle, Eye } from 'lucide-react';
import { GoogleMap, MarkerF, PolylineF } from '@react-google-maps/api';
import api from '../../../../shared/api/axiosInstance';
import { HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../../admin/utils/googleMaps';
import BikeIcon from '../../../../assets/icons/bike.png';
import AutoIcon from '../../../../assets/icons/auto.png';
import CarIcon from '../../../../assets/icons/car.png';
import PremiumIcon from '../../../../assets/icons/Premium.png';
import LuxuryIcon from '../../../../assets/icons/Luxury.png';
import SuvIcon from '../../../../assets/icons/SUV.png';
import TruckIcon from '../../../../assets/icons/truck.png';
import LcvIcon from '../../../../assets/icons/LCV.png';
import McvIcon from '../../../../assets/icons/mcv.png';
import HcvIcon from '../../../../assets/icons/hcv.png';
import EhcvIcon from '../../../../assets/icons/ehcv.png';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const toLatLng = (coords, fallback = { lat: 22.7196, lng: 75.8577 }) => {
  const [lng, lat] = coords || [];

  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }

  return fallback;
};

const getDriverPosition = (driver) => toLatLng(driver?.location?.coordinates, null);

const buildFallbackRoute = (origin, destination) => {
  if (!origin || !destination) {
    return [];
  }

  const latDelta = destination.lat - origin.lat;
  const lngDelta = destination.lng - origin.lng;
  const bendScale = Math.abs(latDelta) > Math.abs(lngDelta) ? 0.28 : -0.28;
  const latBend = latDelta * bendScale;
  const lngBend = lngDelta * bendScale;

  return [
    origin,
    { lat: origin.lat + latDelta * 0.18, lng: origin.lng + lngDelta * 0.08 },
    { lat: origin.lat + latDelta * 0.36 + latBend, lng: origin.lng + lngDelta * 0.34 - lngBend },
    { lat: origin.lat + latDelta * 0.62 - latBend, lng: origin.lng + lngDelta * 0.58 + lngBend },
    { lat: origin.lat + latDelta * 0.84, lng: origin.lng + lngDelta * 0.9 },
    destination,
  ];
};

const VehicleMapPreview = ({ center, dropPosition, stops = [], drivers, selectedVehicle, isLoaded, loadError }) => {
  const [routePath, setRoutePath] = useState([]);
  const [routeError, setRouteError] = useState('');
  const waypointRequests = useMemo(
    () =>
      (Array.isArray(stops) ? stops : [])
        .map((stop) => String(stop || '').trim())
        .filter(Boolean)
        .map((stop) => ({ location: stop, stopover: true })),
    [stops],
  );

  useEffect(() => {
    if (!isLoaded || !dropPosition || !window.google?.maps?.DirectionsService) {
      setRoutePath([]);
      setRouteError('');
      return;
    }

    let active = true;
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: center,
        destination: dropPosition,
        waypoints: waypointRequests,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (!active) {
          return;
        }

        if (status === 'OK' && result?.routes?.[0]?.overview_path?.length) {
          setRoutePath(
            result.routes[0].overview_path.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            })),
          );
          setRouteError('');
          return;
        }

        setRoutePath(buildFallbackRoute(center, dropPosition));
        setRouteError(status || 'Directions unavailable');
      },
    );

    return () => {
      active = false;
    };
  }, [center, dropPosition, isLoaded, waypointRequests]);

  if (!HAS_VALID_GOOGLE_MAPS_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-200 px-6 text-center">
        <div className="rounded-[18px] bg-white/90 px-4 py-4 shadow-sm">
          <p className="text-[12px] font-bold text-slate-900">Google Maps key missing</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">Set `VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env`.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-200 px-6 text-center">
        <div className="rounded-[18px] bg-white/90 px-4 py-4 shadow-sm">
          <p className="text-[12px] font-bold text-slate-900">Google Maps failed to load</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">Check the browser key restrictions and reload.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-200">
        <div className="flex items-center gap-2 rounded-[16px] bg-white/90 px-4 py-3 shadow-sm">
          <LoaderCircle size={18} className="animate-spin text-slate-500" />
          <span className="text-[12px] font-bold text-slate-700">Loading map</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={13}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          gestureHandling: 'greedy',
        }}
      >
        <MarkerF
          position={center}
          title="Pickup"
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#f8e001',
            fillOpacity: 1,
            strokeColor: '#111827',
            strokeWeight: 2,
            scale: 8,
          }}
        />
        {dropPosition && (
          <MarkerF
            position={dropPosition}
            title="Drop"
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#fb923c',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 7,
            }}
          />
        )}
        {routePath.length > 1 && (
          <PolylineF
            path={routePath}
            options={{
              strokeColor: '#111827',
              strokeOpacity: 0.85,
              strokeWeight: 4,
            }}
          />
        )}
        {drivers.slice(0, 8).map((driver, index) => {
          const position = getDriverPosition(driver);

          if (!position) {
            return null;
          }

          return (
            <MarkerF
              key={driver.id || driver._id || index}
              position={position}
              title={`${driver.name || 'Driver'} - ${driver.vehicleNumber || selectedVehicle?.name || 'Vehicle'}`}
              icon={{
                url: selectedVehicle?.vehicleIconUrl || selectedVehicle?.icon || '/4_Taxi.png',
                scaledSize: new window.google.maps.Size(28, 28),
              }}
            />
          );
        })}
      </GoogleMap>

      <div className="pointer-events-none absolute bottom-24 left-4 rounded-[12px] border border-white/70 bg-white/90 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pickup</p>
        <p className="text-[11px] font-bold text-slate-800">{center.lat.toFixed(4)}, {center.lng.toFixed(4)}</p>
      </div>
      {routeError && (
        <div className="pointer-events-none absolute bottom-10 left-4 rounded-[12px] border border-amber-100 bg-white/90 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Route</p>
          <p className="text-[11px] font-bold text-slate-700">Using fallback path while directions load.</p>
        </div>
      )}
    </div>
  );
};

const unwrap = (response) => response?.data?.data || response?.data || response;
const PAYMENT_OPTIONS = [
  { id: 'cash', stateValue: 'Cash', label: 'Cash', sub: 'Pay after ride', Icon: Banknote, bg: 'bg-green-50', color: 'text-green-600' },
  { id: 'online', stateValue: 'Online Payment', label: 'Online Payment', sub: 'UPI, Cards or Wallets', Icon: CreditCard, bg: 'bg-blue-50', color: 'text-blue-600' },
];
const DEFAULT_AVAILABILITY = {
  drivers: [],
  totalDrivers: 0,
  closestDriverDistanceMeters: null,
  closestDriverEtaMinutes: null,
  allowedPaymentMethods: ['cash', 'online'],
};

const normalizeAllowedPaymentMethods = (value) => {
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((item) => String(item || '').trim().toLowerCase())
    .map((item) => (item === 'cash' ? 'cash' : item === 'online' ? 'online' : null))
    .filter(Boolean);

  return [...new Set(normalized)].length ? [...new Set(normalized)] : ['cash', 'online'];
};

const toPaymentStateValue = (methodId) => PAYMENT_OPTIONS.find((option) => option.id === methodId)?.stateValue || 'Cash';
const normalizeSelectedPaymentState = (value) => String(value || '').trim().toLowerCase() === 'cash' ? 'cash' : 'online';

const getVehicleTypes = (response) => {
  const data = unwrap(response);
  return data?.vehicle_types || data?.results || (Array.isArray(data) ? data : []);
};

const getTypeLabel = (type) => type?.name || type?.vehicle_type || type?.label || 'Vehicle';

const getIconValue = (type) => String(type?.icon_types || type?.vehicleIconType || type?.name || '').toLowerCase();

const getVehicleMapIcon = (type) => {
  const customIcon = String(type?.map_icon || type?.icon || type?.vehicleIconUrl || '').trim();
  if (customIcon) {
    return customIcon;
  }

  const value = getIconValue(type);

  if (value.includes('bike')) {
    return '/1_Bike.png';
  }

  if (value.includes('auto')) {
    return '/2_AutoRickshaw.png';
  }

  if (value.includes('ehc')) {
    return '/ehcv.png';
  }

  if (value.includes('hcv')) {
    return '/hcv.png';
  }

  if (value.includes('lcv')) {
    return '/LCV.png';
  }

  if (value.includes('mcv')) {
    return '/mcv.png';
  }

  if (value.includes('truck')) {
    return '/truck.png';
  }

  if (value.includes('lux')) {
    return '/Luxury.png';
  }

  if (value.includes('premium')) {
    return '/Premium.png';
  }

  if (value.includes('suv')) {
    return '/SUV.png';
  }

  return '/4_Taxi.png';
};

const getVehiclePreviewImage = (type) => {
  const previewImage = String(type?.image || type?.preview_image || type?.previewImage || '').trim();
  if (previewImage) {
    return previewImage;
  }

  const value = getIconValue(type);

  if (value.includes('bike')) return BikeIcon;
  if (value.includes('auto')) return AutoIcon;
  if (value.includes('ehc')) return EhcvIcon;
  if (value.includes('hcv')) return HcvIcon;
  if (value.includes('lcv')) return LcvIcon;
  if (value.includes('mcv')) return McvIcon;
  if (value.includes('truck')) return TruckIcon;
  if (value.includes('lux')) return LuxuryIcon;
  if (value.includes('premium')) return PremiumIcon;
  if (value.includes('suv')) return SuvIcon;

  return CarIcon;
};

const getCapacity = (type) => {
  const value = getIconValue(type);

  if (value.includes('bike')) {
    return 1;
  }

  if (value.includes('auto')) {
    return 3;
  }

  if (value.includes('suv')) {
    return 6;
  }

  return 4;
};

const AVERAGE_CITY_SPEED_KMPH = 24;

const calculateDistanceMeters = (fromCoords = [], toCoords = []) => {
  const [fromLng, fromLat] = fromCoords;
  const [toLng, toLat] = toCoords;

  if (![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(Number(value)))) {
    return 0;
  }

  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const startLat = toRadians(fromLat);
  const endLat = toRadians(toLat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
};

const estimateDurationMinutes = (distanceMeters = 0) => {
  if (!Number.isFinite(Number(distanceMeters)) || Number(distanceMeters) <= 0) {
    return 0;
  }

  const metersPerMinute = (AVERAGE_CITY_SPEED_KMPH * 1000) / 60;
  return Math.max(1, Math.round(Number(distanceMeters) / metersPerMinute));
};

const getFallbackVehicleEstimate = (type) => {
  const value = getIconValue(type);
  const label = getTypeLabel(type).toLowerCase();

  if (value.includes('bike') || label.includes('bike')) {
    return 22;
  }

  if (value.includes('auto') || label.includes('auto')) {
    return 40;
  }

  if (value.includes('premium') || value.includes('lux') || label.includes('premium') || label.includes('lux')) {
    return 130;
  }

  if (value.includes('suv') || label.includes('suv')) {
    return 150;
  }

  return 106;
};

const getSetPriceRows = (response) => {
  const data = unwrap(response);
  return (data?.paginator?.data || data?.results || []).filter((row) => {
    const scope = String(row?.pricing_scope || 'ride').trim().toLowerCase();
    return scope === 'ride';
  });
};

const normalizeId = (value) => String(value?._id || value?.id || value || '').trim();

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getRuleServiceLocationId = (rule) => normalizeId(
  rule?.service_location_id?._id
  || rule?.service_location_id?.id
  || rule?.service_location_id
  || rule?.zone?.service_location?._id
  || rule?.zone?.service_location?.id
  || rule?.zone?.service_location_id
  || '',
);

const sortPricingRules = (rules = []) => (
  [...rules].sort((first, second) => {
    const firstUpdatedAt = new Date(first?.updatedAt || first?.createdAt || 0).getTime();
    const secondUpdatedAt = new Date(second?.updatedAt || second?.createdAt || 0).getTime();
    return secondUpdatedAt - firstUpdatedAt;
  })
);

const isActiveRidePricingRule = (rule) => {
  const isActive = Number(rule?.active ?? 1) === 1 && String(rule?.status || 'active').toLowerCase() !== 'inactive';
  const scope = String(rule?.pricing_scope || 'ride').trim().toLowerCase();
  return isActive && scope === 'ride';
};

const matchesTransportType = (rule, transportType) => {
  const normalizedRuleTransport = String(rule?.transport_type || 'taxi').trim().toLowerCase();
  const normalizedTransportType = String(transportType || 'taxi').trim().toLowerCase() || 'taxi';

  return normalizedRuleTransport === normalizedTransportType
    || normalizedRuleTransport === 'both';
};

const findBestPricingRule = ({ rules, vehicleTypeId, serviceLocationId, transportType }) => {
  const normalizedVehicleTypeId = normalizeId(vehicleTypeId);
  const normalizedServiceLocationId = normalizeId(serviceLocationId);
  const normalizedTransportType = String(transportType || 'taxi').trim().toLowerCase() || 'taxi';

  const candidates = sortPricingRules(rules.filter((rule) => {
    const matchesVehicle = normalizeId(rule?.vehicle_type?._id || rule?.vehicle_type || rule?.type_id) === normalizedVehicleTypeId;
    return matchesVehicle && isActiveRidePricingRule(rule) && matchesTransportType(rule, normalizedTransportType);
  }));

  if (!candidates.length) {
    return null;
  }

  const exactTransportMatch = (rule) => String(rule?.transport_type || 'taxi').trim().toLowerCase() === normalizedTransportType;
  const exactServiceLocation = candidates.find((rule) => (
    normalizedServiceLocationId
    && getRuleServiceLocationId(rule) === normalizedServiceLocationId
    && exactTransportMatch(rule)
  ));

  if (exactServiceLocation) {
    return exactServiceLocation;
  }

  const exactServiceLocationAnyTransport = candidates.find((rule) => (
    normalizedServiceLocationId && getRuleServiceLocationId(rule) === normalizedServiceLocationId
  ));

  if (exactServiceLocationAnyTransport) {
    return exactServiceLocationAnyTransport;
  }

  const genericTransportMatch = candidates.find((rule) => (
    !getRuleServiceLocationId(rule) && exactTransportMatch(rule)
  ));

  if (genericTransportMatch) {
    return genericTransportMatch;
  }

  const genericBoth = candidates.find((rule) => !getRuleServiceLocationId(rule));
  return genericBoth || candidates[0];
};

const calculateEstimatedFare = ({ vehicle, pricingRule, distanceMeters, durationMinutes }) => {
  const fallbackFare = getFallbackVehicleEstimate(vehicle?.raw || vehicle);

  if (!pricingRule) {
    return fallbackFare;
  }

  const distanceKm = Math.max(0, Number(distanceMeters || 0) / 1000);
  const basePrice = toFiniteNumber(pricingRule.base_price, 0);
  const baseDistance = Math.max(0, toFiniteNumber(pricingRule.base_distance, 0));
  const pricePerDistance = toFiniteNumber(pricingRule.price_per_distance, 0);
  const timePrice = toFiniteNumber(pricingRule.time_price, 0);
  const serviceTax = toFiniteNumber(pricingRule.service_tax, 0);
  const isWithinBaseDistance = baseDistance > 0 && distanceKm <= baseDistance;
  const extraDistanceKm = Math.max(0, distanceKm - baseDistance);
  const subtotal = isWithinBaseDistance
    ? basePrice
    : basePrice + (extraDistanceKm * pricePerDistance) + (Math.max(0, Number(durationMinutes || 0)) * timePrice);

  if (subtotal <= 0) {
    return fallbackFare;
  }

  const total = subtotal + (subtotal * serviceTax) / 100;
  return Math.max(0, Math.round(total));
};

const getDropTime = (minutesAway = 0) => {
  const safeMinutes = Math.max(6, Number(minutesAway) || 0);
  const date = new Date(Date.now() + safeMinutes * 60 * 1000);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDistanceLabel = (distanceMeters) => {
  if (!Number.isFinite(Number(distanceMeters))) {
    return 'No distance yet';
  }

  const meters = Number(distanceMeters);

  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  }

  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
};

const formatCurrency = (amount) => `₹${Math.round(Number(amount) || 0)}`;

const getBidFareBounds = (vehicle, stepCount) => {
  const baseFare = Math.max(0, Math.round(Number(vehicle?.price) || 0));
  const maxSteps = Math.max(0, Number(vehicle?.maxBidSteps) || 0);
  const safeStepCount = Math.min(
    maxSteps,
    Math.max(0, Number.isFinite(Number(stepCount)) ? Number(stepCount) : maxSteps),
  );
  const stepAmount = Math.max(0, Math.round(Number(vehicle?.bidStepAmount) || 0));

  return {
    min: baseFare,
    max: baseFare + (safeStepCount * stepAmount),
  };
};

const formatVehicleFare = (vehicle, stepCount) => {
  if (!vehicle?.supportsBidding) {
    return formatCurrency(vehicle?.price);
  }

  const { min, max } = getBidFareBounds(vehicle, stepCount);
  return `${formatCurrency(min)}-${formatCurrency(max)}`;
};

const pad = (value) => String(value).padStart(2, '0');

const formatDateTimeInputValue = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getMinScheduledDateTime = () => {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  return formatDateTimeInputValue(next);
};

const getMaxScheduledDateTime = () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return formatDateTimeInputValue(nextWeek);
};

const formatScheduledDisplay = (value) => {
  if (!value) {
    return 'Pick date & time';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Pick date & time';
  }

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatAvailabilityLine = (availability) => {
  if (!availability?.totalDrivers) {
    return 'Not available right now';
  }

  const etaMinutes = availability.closestDriverEtaMinutes || 1;
  const dropTime = getDropTime(etaMinutes + 10);
  return `Closest driver ${formatDistanceLabel(availability.closestDriverDistanceMeters)} away - ${etaMinutes} mins away - Drop ${dropTime}`;
};

const formatDispatchLabel = (vehicle) => {
  if (vehicle?.supportsBidding) {
    return 'Bid or instant booking';
  }

  const dispatchType = String(vehicle?.dispatchType || '').toLowerCase();
  if (dispatchType === 'bidding') {
    return 'Bid booking';
  }

  return 'Instant booking';
};

const getAvailabilityBadge = (availability) => {
  if (!availability?.totalDrivers) {
    return 'NOT AVAILABLE';
  }

  if ((availability.closestDriverEtaMinutes || Number.POSITIVE_INFINITY) <= 2) {
    return 'FASTEST';
  }

  if (availability.totalDrivers >= 5) {
    return 'POPULAR';
  }

  return null;
};

const normalizeVehicleType = (type, index) => {
  const id = String(type?._id || type?.id || type?.name || index);
  const dispatchType = String(type?.dispatch_type || 'normal').trim().toLowerCase();

  return {
    id,
    vehicleTypeId: type?._id || type?.id || '',
    transportType: String(type?.transport_type || 'taxi').trim().toLowerCase() || 'taxi',
    iconType: type?.icon_types || 'car',
    icon: getVehiclePreviewImage(type),
    vehicleIconUrl: getVehicleMapIcon(type),
    name: getTypeLabel(type),
    capacity: getCapacity(type),
    badge: null,
    badgeColor: 'bg-orange-50 text-orange-500 border-orange-100',
    sublabel: type?.short_description || type?.description || 'Available ride',
    price: getFallbackVehicleEstimate(type),
    dispatchType,
    supportsBidding: dispatchType === 'bidding' || dispatchType === 'both',
    bidStepAmount: 10,
    maxBidSteps: 5,
    raw: type,
  };
};

const ScrollIndicator = ({ show }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="pointer-events-none absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center"
      >
        <div className="flex h-6 w-6 animate-bounce items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-400 shadow-[0_4px_12px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <ChevronDown size={14} strokeWidth={3} />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const SelectVehicle = () => {
  const location = useLocation();
  const routeState = location.state || {};
  const [vehicles, setVehicles] = useState([]);
  const [availabilityByVehicleId, setAvailabilityByVehicleId] = useState({});
  const [selected, setSelected] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [previewVehicleId, setPreviewVehicleId] = useState('');
  const [rideMode, setRideMode] = useState(() => (location.state?.rideMode === 'schedule' ? 'schedule' : 'now'));
  const [scheduledAt, setScheduledAt] = useState(() => (
    location.state?.scheduledAt ? String(location.state.scheduledAt).slice(0, 16) : getMinScheduledDateTime()
  ));
  const [scheduleError, setScheduleError] = useState('');
  const [showPromo, setShowPromo] = useState(true);
  const [bidStepCount, setBidStepCount] = useState(2);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [vehicleLoadError, setVehicleLoadError] = useState('');
  const [driverLoadError, setDriverLoadError] = useState('');
  const [pricingRules, setPricingRules] = useState([]);
  const [isLoadingPricingRules, setIsLoadingPricingRules] = useState(true);
  const [tripMetrics, setTripMetrics] = useState(() => {
    if (
      Number.isFinite(Number(routeState?.estimatedDistanceMeters))
      && Number.isFinite(Number(routeState?.estimatedDurationMinutes))
    ) {
      return {
        distanceMeters: Number(routeState.estimatedDistanceMeters),
        durationMinutes: Number(routeState.estimatedDurationMinutes),
      };
    }

    return { distanceMeters: 0, durationMinutes: 0 };
  });
  const [isResolvingTripMetrics, setIsResolvingTripMetrics] = useState(true);
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const scrollRef = React.useRef(null);
  const scheduledAtInputRef = useRef(null);
  const navigate = useNavigate();
  const pickup = routeState.pickup || 'Pipaliyahana, Indore';
  const drop = routeState.drop || 'Vijay Nagar, Indore';
  const pickupCoords = useMemo(() => routeState.pickupCoords || [75.9048, 22.7039], [routeState.pickupCoords]);
  const dropCoords = useMemo(() => routeState.dropCoords || [75.8937, 22.7533], [routeState.dropCoords]);
  const stops = useMemo(
    () => (Array.isArray(routeState.stops) ? routeState.stops : []),
    [routeState.stops],
  );
  const serviceLocationId = routeState.service_location_id || routeState.serviceLocationId || '';
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';
  const pickupPosition = useMemo(() => toLatLng(pickupCoords), [pickupCoords]);
  const dropPosition = useMemo(() => toLatLng(dropCoords, null), [dropCoords]);
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useAppGoogleMapsLoader();
  const minScheduledAt = useMemo(() => getMinScheduledDateTime(), []);
  const maxScheduledAt = useMemo(() => getMaxScheduledDateTime(), []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const hasMore = scrollTop + clientHeight < scrollHeight - 8;
    setShowScrollArrow(hasMore);
  };

  useEffect(() => {
    if (!scheduledAt) {
      return;
    }

    if (scheduledAt < minScheduledAt) {
      setScheduledAt(minScheduledAt);
      return;
    }

    if (scheduledAt > maxScheduledAt) {
      setScheduledAt(maxScheduledAt);
    }
  }, [maxScheduledAt, minScheduledAt, scheduledAt]);

  useEffect(() => {
    let active = true;

    const loadVehicleTypes = async () => {
      setIsLoadingVehicles(true);
      setVehicleLoadError('');

      try {
        const response = await api.get('/users/vehicle-types');

        if (!active) {
          return;
        }

        const nextVehicles = getVehicleTypes(response)
          .filter((type) => {
            const isActive = type.active !== false && Number(type.status ?? 1) !== 0;
            const transportType = String(type.transport_type || 'taxi').toLowerCase();
            return isActive && (transportType === 'taxi' || transportType === 'both');
          })
          .map(normalizeVehicleType);

        setVehicles(nextVehicles);
        setSelected((current) => current || nextVehicles[0]?.id || '');
      } catch (error) {
        if (active) {
          setVehicleLoadError(error.message || 'Could not load vehicle types.');
        }
      } finally {
        if (active) {
          setIsLoadingVehicles(false);
        }
      }
    };

    loadVehicleTypes();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPricingRules = async () => {
      setIsLoadingPricingRules(true);

      try {
        const response = await api.get('/admin/types/set-prices', {
          params: { scope: 'ride' },
        });

        if (!active) {
          return;
        }

        setPricingRules(getSetPriceRows(response));
      } catch {
        if (active) {
          setPricingRules([]);
        }
      } finally {
        if (active) {
          setIsLoadingPricingRules(false);
        }
      }
    };

    loadPricingRules();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fallbackDistanceMeters = calculateDistanceMeters(pickupCoords, dropCoords);
    const fallbackDurationMinutes = estimateDurationMinutes(fallbackDistanceMeters);

    if (!dropPosition) {
      setIsResolvingTripMetrics(false);
      setTripMetrics({
        distanceMeters: fallbackDistanceMeters,
        durationMinutes: fallbackDurationMinutes,
      });
      return;
    }

    if (mapLoadError || !HAS_VALID_GOOGLE_MAPS_KEY) {
      setIsResolvingTripMetrics(false);
      setTripMetrics({
        distanceMeters: fallbackDistanceMeters,
        durationMinutes: fallbackDurationMinutes,
      });
      return;
    }

    if (!isMapLoaded || !window.google?.maps?.DirectionsService) {
      setIsResolvingTripMetrics(true);
      return;
    }

    let active = true;
    setIsResolvingTripMetrics(true);
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: pickupPosition,
        destination: dropPosition,
        waypoints: stops
          .map((stop) => String(stop || '').trim())
          .filter(Boolean)
          .map((stop) => ({ location: stop, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (!active) {
          return;
        }

        const leg = result?.routes?.[0]?.legs?.[0];
        const distanceMeters = toFiniteNumber(leg?.distance?.value, fallbackDistanceMeters);
        const durationMinutes = Math.max(
          1,
          Math.round(toFiniteNumber(leg?.duration?.value, fallbackDurationMinutes * 60) / 60),
        );

        if (status === 'OK' && leg) {
          setIsResolvingTripMetrics(false);
          setTripMetrics({ distanceMeters, durationMinutes });
          return;
        }

        setIsResolvingTripMetrics(false);
        setTripMetrics({
          distanceMeters: fallbackDistanceMeters,
          durationMinutes: fallbackDurationMinutes,
        });
      },
    );

    return () => {
      active = false;
    };
  }, [dropCoords, dropPosition, isMapLoaded, mapLoadError, pickupCoords, pickupPosition, stops]);

  const pricedVehicles = useMemo(
    () =>
      vehicles.map((vehicle) => {
        const pricingRule = findBestPricingRule({
          rules: pricingRules,
          vehicleTypeId: vehicle.vehicleTypeId,
          serviceLocationId,
          transportType: vehicle.transportType || routeState.transport_type || routeState.transportType || 'taxi',
        });

        return {
          ...vehicle,
          pricingRule,
          price: calculateEstimatedFare({
            vehicle,
            pricingRule,
            distanceMeters: tripMetrics.distanceMeters,
            durationMinutes: tripMetrics.durationMinutes,
          }),
        };
      }),
    [pricingRules, serviceLocationId, tripMetrics.distanceMeters, tripMetrics.durationMinutes, vehicles],
  );

  const isFarePending = isResolvingTripMetrics || isLoadingPricingRules;

  const hasAvailabilityResults = Object.keys(availabilityByVehicleId).length > 0;

  const displayedVehicles = useMemo(() => {
    if (!hasAvailabilityResults) {
      return pricedVehicles;
    }

    return pricedVehicles
      .map((vehicle, index) => ({
        vehicle,
        index,
        availability: availabilityByVehicleId[vehicle.id] || DEFAULT_AVAILABILITY,
      }))
      .sort((a, b) => {
        const aAvailable = a.availability.totalDrivers > 0;
        const bAvailable = b.availability.totalDrivers > 0;

        if (aAvailable !== bAvailable) {
          return aAvailable ? -1 : 1;
        }

        if (aAvailable && bAvailable) {
          const driverDelta = (b.availability.totalDrivers || 0) - (a.availability.totalDrivers || 0);
          if (driverDelta !== 0) return driverDelta;

          const etaDelta = (a.availability.closestDriverEtaMinutes || Number.POSITIVE_INFINITY)
            - (b.availability.closestDriverEtaMinutes || Number.POSITIVE_INFINITY);
          if (etaDelta !== 0) return etaDelta;
        }

        return a.index - b.index;
      })
      .map(({ vehicle }) => vehicle);
  }, [availabilityByVehicleId, hasAvailabilityResults, pricedVehicles]);

  const selectedVehicle = useMemo(() => pricedVehicles.find((v) => v.id === selected), [pricedVehicles, selected]);
  const previewVehicle = useMemo(
    () => pricedVehicles.find((vehicle) => vehicle.id === previewVehicleId) || null,
    [previewVehicleId, pricedVehicles],
  );
  const selectedAvailability = selectedVehicle ? (availabilityByVehicleId[selectedVehicle.id] || DEFAULT_AVAILABILITY) : DEFAULT_AVAILABILITY;
  const previewAvailability = previewVehicle ? (availabilityByVehicleId[previewVehicle.id] || DEFAULT_AVAILABILITY) : DEFAULT_AVAILABILITY;
  const canProceed = Boolean(selectedVehicle) && !isFarePending && (rideMode === 'schedule' || Boolean(selectedAvailability.totalDrivers));
  const shouldUseDriverBidding = Boolean(
    routeState.intercity ||
    routeState.serviceType === 'intercity' ||
    routeState.transport_type === 'intercity' ||
    routeState.transportType === 'intercity',
  );
  const selectedBidStepAmount = Number(selectedVehicle?.bidStepAmount || 10);
  const selectedBidSteps = Number(selectedVehicle?.maxBidSteps || 5);
  const selectedBidIncrement = (selectedVehicle?.supportsBidding ? bidStepCount : 0) * selectedBidStepAmount;
  const selectedBidCeiling = Number(selectedVehicle?.price || 0) + selectedBidIncrement;
  const selectedFareDisplay = selectedVehicle?.supportsBidding && shouldUseDriverBidding
    ? formatVehicleFare(selectedVehicle, bidStepCount)
    : formatCurrency(selectedVehicle?.price);
  const allowedPaymentMethods = useMemo(
    () => normalizeAllowedPaymentMethods(selectedAvailability?.allowedPaymentMethods),
    [selectedAvailability?.allowedPaymentMethods],
  );
  const paymentOptions = useMemo(
    () => PAYMENT_OPTIONS.filter((option) => allowedPaymentMethods.includes(option.id)),
    [allowedPaymentMethods],
  );
  const onlineDrivers = selectedAvailability.drivers || [];

  useEffect(() => {
    if (!paymentOptions.length) {
      return;
    }

    const normalizedCurrent = normalizeSelectedPaymentState(paymentMethod);
    if (!paymentOptions.some((option) => option.id === normalizedCurrent)) {
      setPaymentMethod(paymentOptions[0].stateValue);
    }
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    const timer = setTimeout(handleScroll, 200);
    return () => clearTimeout(timer);
  }, [displayedVehicles, tripMetrics]);

  useEffect(() => {
    setBidStepCount(2);
  }, [selected]);

  useEffect(() => {
    if (!hasAvailabilityResults || !displayedVehicles.length) {
      return;
    }

    const currentAvailability = selected ? (availabilityByVehicleId[selected] || DEFAULT_AVAILABILITY) : DEFAULT_AVAILABILITY;
    const firstAvailable = displayedVehicles.find((vehicle) => (availabilityByVehicleId[vehicle.id]?.totalDrivers || 0) > 0);

    if (firstAvailable && (!selected || currentAvailability.totalDrivers <= 0)) {
      setSelected(firstAvailable.id);
    }
  }, [availabilityByVehicleId, displayedVehicles, hasAvailabilityResults, selected]);

  useEffect(() => {
    let active = true;

    const loadOnlineDrivers = async () => {
      if (!vehicles.length) {
        setAvailabilityByVehicleId({});
        return;
      }

      setIsLoadingDrivers(true);
      setDriverLoadError('');

      try {
        const responses = await Promise.all(
          vehicles
            .filter((vehicle) => vehicle.vehicleTypeId)
            .map(async (vehicle) => {
              const response = await api.get('/rides/available-drivers', {
                params: {
                  vehicleTypeId: vehicle.vehicleTypeId,
                  vehicleIconType: vehicle.iconType,
                  lng: pickupCoords[0],
                  lat: pickupCoords[1],
                  service_location_id: routeState.service_location_id || routeState.serviceLocationId || '',
                  transport_type: vehicle.transportType || routeState.transport_type || routeState.transportType || 'taxi',
                },
              });

              return [vehicle.id, { ...DEFAULT_AVAILABILITY, ...unwrap(response) }];
            }),
        );

        if (active) {
          setAvailabilityByVehicleId(Object.fromEntries(responses));
        }
      } catch (error) {
        if (active) {
          setAvailabilityByVehicleId({});
          setDriverLoadError(error.message || 'Could not load online drivers.');
        }
      } finally {
        if (active) {
          setIsLoadingDrivers(false);
        }
      }
    };

    loadOnlineDrivers();

    return () => {
      active = false;
    };
  }, [pickupCoords, vehicles]);

  const openPicker = (inputRef) => {
    if (typeof inputRef.current?.showPicker === 'function') {
      inputRef.current.showPicker();
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.click();
  };

  const proceedToBooking = () => {
    if (!selectedVehicle) {
      return;
    }

    setShowBidModal(false);
    navigate(`${routePrefix}/ride/searching`, {
      state: {
        pickup,
        drop,
        pickupCoords,
        dropCoords,
        stops,
        service_location_id: routeState.service_location_id || routeState.serviceLocationId || '',
        transport_type: selectedVehicle.transportType || routeState.transport_type || routeState.transportType || 'taxi',
        vehicle: selectedVehicle,
        vehicleTypeId: selectedVehicle.vehicleTypeId,
        vehicleIconType: selectedVehicle.iconType,
        vehicleIconUrl: selectedVehicle.vehicleIconUrl || selectedVehicle.icon,
        paymentMethod,
        fare: selectedVehicle.price,
        baseFare: selectedVehicle.price,
        bookingMode: selectedVehicle.supportsBidding ? 'bidding' : 'normal',
        pricingNegotiationMode: selectedVehicle.supportsBidding
          ? shouldUseDriverBidding
            ? 'driver_bid'
            : 'user_increment_only'
          : 'none',
        bidStepAmount: selectedBidStepAmount,
        userMaxBidFare: selectedVehicle.supportsBidding && shouldUseDriverBidding ? selectedBidCeiling : selectedVehicle.price,
        bidIncrement: selectedVehicle.supportsBidding && shouldUseDriverBidding ? selectedBidIncrement : 0,
        estimatedDistanceMeters: tripMetrics.distanceMeters,
        estimatedDurationMinutes: tripMetrics.durationMinutes,
        rideMode,
        scheduledAt: rideMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
        allowedPaymentMethods,
        searchNonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  };

  const handleBook = () => {
    if (!selectedVehicle) {
      return;
    }

    if (rideMode === 'schedule') {
      const parsedSchedule = new Date(scheduledAt);

      if (!scheduledAt || Number.isNaN(parsedSchedule.getTime())) {
        setScheduleError('Choose a valid schedule date and time.');
        return;
      }

      if (parsedSchedule.getTime() <= Date.now() + 60 * 1000) {
        setScheduleError('Schedule time must be at least 1 minute ahead.');
        return;
      }

      if (scheduledAt < minScheduledAt) {
        setScheduleError('Schedule time cannot be earlier than now.');
        return;
      }

      if (scheduledAt > maxScheduledAt) {
        setScheduleError('Advance booking is available for up to 7 days only.');
        return;
      }
    }

    setScheduleError('');

    if (selectedVehicle.supportsBidding && shouldUseDriverBidding) {
      setShowBidModal(true);
      return;
    }

    proceedToBooking();
  };

  return (
    <div className="h-[100dvh] bg-slate-50 max-w-lg mx-auto relative font-['Plus_Jakarta_Sans'] overflow-hidden">
      <div className="absolute inset-0 w-full bg-gray-200">
        <VehicleMapPreview
          center={pickupPosition}
          dropPosition={dropPosition}
          stops={stops}
          drivers={onlineDrivers}
          selectedVehicle={selectedVehicle}
          isLoaded={isMapLoaded}
          loadError={mapLoadError}
        />

        <div className="absolute top-6 left-4 right-4 z-20 flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/95 rounded-[14px] shadow-[0_4px_14px_rgba(15,23,42,0.12)] flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0 bg-white/95 rounded-[14px] px-4 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.10)] flex items-center gap-2">
            <span className="text-[14px] font-bold text-slate-800 truncate flex-1">{drop}</span>
            <button
              type="button"
              onClick={() =>
                navigate(`${routePrefix}/ride/select-location`, {
                  state: {
                    pickup,
                    drop,
                    pickupCoords,
                    dropCoords,
                    stops,
                  },
                })
              }
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Change destination"
            >
              <X size={15} className="shrink-0" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showPromo && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-20 left-4 right-4 bg-white/95 backdrop-blur-md border border-white/80 rounded-[18px] flex items-center overflow-hidden z-30 shadow-[0_8px_24px_rgba(15,23,42,0.10)] pr-3"
            >
              <div className="flex-1 px-4 py-3">
                <p className="text-[12px] font-bold text-slate-900 leading-tight">Going a few kms away?</p>
                <p className="text-[10px] font-semibold text-orange-500 mt-0.5 uppercase tracking-wider">Use GOFREE on 1st cab ride</p>
              </div>
              <img src="/ride_now_banner.png" className="h-12 w-16 object-cover rounded-[10px] shrink-0" alt="Promo" />
              <button onClick={() => setShowPromo(false)} className="ml-2.5 pl-2.5 border-l border-slate-100">
                <X size={13} className="text-slate-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute left-4 right-4 bottom-4 z-20 flex items-center justify-between gap-3">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(15,23,42,0.12)] border border-white/80">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Drivers Nearby</p>
            <p className="text-[16px] font-extrabold text-slate-900 leading-none mt-1">
              {isLoadingDrivers ? '...' : `${selectedAvailability.totalDrivers || 0} online`}
            </p>
          </div>
          {driverLoadError && (
            <div className="bg-red-50/95 rounded-[14px] px-3 py-2 border border-red-100 max-w-[190px]">
              <p className="text-[10px] font-bold text-red-500 leading-tight">{driverLoadError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-40 flex max-h-[66dvh] min-h-[260px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_44px_rgba(15,23,42,0.15)]">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="relative flex-1 overflow-hidden">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-2 space-y-2 max-h-[230px]"
          >
            {isLoadingVehicles && (
              <div className="min-h-[180px] flex flex-col items-center justify-center gap-3 text-slate-400">
                <LoaderCircle size={26} className="animate-spin" />
                <p className="text-[11px] font-bold uppercase tracking-widest">Finding available rides</p>
              </div>
            )}

            {!isLoadingVehicles && vehicleLoadError && (
              <div className="bg-white border border-red-50 rounded-[18px] px-4 py-5 text-center">
                <p className="text-[12px] font-black text-red-500">{vehicleLoadError}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Please try again later.</p>
              </div>
            )}

            {!isLoadingVehicles && !vehicleLoadError && displayedVehicles.length === 0 && (
              <div className="bg-white border border-slate-50 rounded-[18px] px-4 py-5 text-center">
                <p className="text-[13px] font-bold text-slate-900">No vehicles available</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1">Try changing your location or method.</p>
              </div>
            )}

          {!isLoadingVehicles && !vehicleLoadError && displayedVehicles.map((v, i) => {
            const isSelected = selected === v.id;
            const availability = availabilityByVehicleId[v.id] || DEFAULT_AVAILABILITY;
            const badge = getAvailabilityBadge(availability) || v.badge;
            const isUnavailable = !availability.totalDrivers;
            const canSelectVehicle = rideMode === 'schedule' || !isUnavailable;

            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[24px] border-2 transition-all text-left relative overflow-hidden min-h-[74px] ${
                  isSelected
                    ? 'bg-orange-50/50 border-orange-500 shadow-[0_12px_24px_-8px_rgba(249,115,22,0.22)]'
                    : isUnavailable && rideMode !== 'schedule'
                      ? 'bg-slate-100/60 border-transparent opacity-60'
                      : 'bg-white border-slate-50 shadow-[0_2px_8px_rgba(15,23,42,0.02)] hover:border-slate-200'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="selection-glow"
                    className="absolute inset-0 bg-gradient-to-r from-orange-50/0 via-orange-50/20 to-orange-50/0 pointer-events-none"
                  />
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (canSelectVehicle) {
                      setSelected(v.id);
                    }
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className={`w-16 h-14 rounded-[18px] flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isSelected ? 'bg-white shadow-sm scale-105' : isUnavailable ? 'bg-slate-200' : 'bg-slate-50'
                  }`}>
                    <img src={v.icon} alt={v.name} className="h-12 w-16 max-w-none object-contain drop-shadow-sm" draggable={false} />
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[13px] font-extrabold leading-tight ${isUnavailable ? 'text-slate-500' : 'text-slate-900'}`}>
                        {v.name}
                      </span>
                      <div className="flex items-center gap-1 text-slate-400 bg-slate-50 px-1 py-0.5 rounded-md">
                        <Users size={10} strokeWidth={3} />
                        <span className="text-[9px] font-bold">{v.capacity}</span>
                      </div>
                      {badge && (
                        <span className={`text-[7px] font-black px-1 py-0.5 rounded-md border uppercase tracking-tighter ${
                          isUnavailable
                            ? 'bg-white text-slate-300 border-slate-100'
                            : badge === 'FASTEST'
                              ? 'bg-orange-500 text-white border-orange-400'
                              : 'bg-orange-50 text-orange-600 border-orange-100'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 leading-tight truncate max-w-[140px]">{v.sublabel}</p>
                    <div className="flex items-center gap-1.5 mt-1 border-t border-slate-50 pt-0.5">
                      <div className={`w-1 h-1 rounded-full ${isUnavailable ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
                      <p className={`text-[9px] font-bold truncate flex-1 ${isUnavailable && rideMode !== 'schedule' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {isUnavailable
                          ? rideMode === 'schedule'
                            ? 'Can be scheduled for later'
                            : 'Unavailable'
                          : formatAvailabilityLine(availability)}
                      </p>
                      {(!isUnavailable || rideMode === 'schedule') && !isFarePending && tripMetrics.distanceMeters > 0 && (
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter shrink-0 bg-slate-100 px-1 py-0.5 rounded">
                          {tripMetrics.durationMinutes || 1}m
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex flex-col items-end gap-2 shrink-0 z-10">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewVehicleId(v.id)}
                      aria-label={`View details for ${v.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-orange-200 hover:text-orange-500"
                    >
                      <Eye size={15} strokeWidth={2.4} />
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => {
                          openPicker(scheduledAtInputRef);
                        }}
                        className={`flex h-8 min-w-[56px] items-center justify-center gap-1 rounded-full border px-2 transition-all ${
                          rideMode === 'schedule'
                            ? 'border-blue-100 bg-blue-50 text-blue-600 shadow-[0_10px_24px_-12px_rgba(59,130,246,0.6)]'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                        aria-label={rideMode === 'schedule' ? `Scheduled for ${formatScheduledDisplay(scheduledAt)}` : `Schedule ${v.name}`}
                        title={rideMode === 'schedule' ? formatScheduledDisplay(scheduledAt) : `Schedule ${v.name}`}
                      >
                        <Clock3 size={13} strokeWidth={2.4} />
                        <span className="text-[8px] font-black uppercase tracking-wider">
                          {rideMode === 'schedule' ? 'Set' : 'Later'}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-[15px] font-black tracking-tight block ${isUnavailable ? 'text-slate-300' : 'text-slate-900'}`}>
                      {isUnavailable ? 'N/A' : isFarePending ? '...' : formatVehicleFare(v)}
                    </span>
                    {!isUnavailable && (
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter opacity-70">
                        {isFarePending ? 'calc.' : (v.supportsBidding && shouldUseDriverBidding) ? 'bid range' : 'est.'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
          <ScrollIndicator show={showScrollArrow} />
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white/80 backdrop-blur-xl px-5 pb-6 pt-3.5 space-y-3.5 shadow-[0_-12px_40px_rgba(15,23,42,0.08)]">
          <input
            ref={scheduledAtInputRef}
            type="datetime-local"
            value={scheduledAt}
            min={minScheduledAt}
            max={maxScheduledAt}
            onChange={(event) => {
              setScheduledAt(event.target.value);
              setRideMode('schedule');
              setScheduleError('');
            }}
            className="sr-only"
          />

          <div className="flex items-stretch gap-3">
            <motion.button
              whileHover={canProceed ? { scale: 1.01, translateY: -2 } : {}}
              whileTap={canProceed ? { scale: 0.98 } : undefined}
              disabled={!canProceed}
              onClick={handleBook}
              className={`flex-1 py-4 rounded-[20px] text-[15px] font-extrabold shadow-xl transition-all duration-300 uppercase tracking-tight flex items-center justify-center gap-3 ${
                canProceed
                  ? 'bg-[#f8e001] text-slate-900 shadow-[0_12px_28px_-4px_rgba(248,224,1,0.4)] active:shadow-none'
                  : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              }`}
            >
              {selectedVehicle
                ? isFarePending
                  ? 'Calculating fare...'
                  : selectedVehicle.supportsBidding && shouldUseDriverBidding
                  ? (
                    <>
                      <span>{`Request Bid for ${selectedVehicle.name}`}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900/20" />
                      <span>{selectedFareDisplay}</span>
                    </>
                  )
                  : rideMode === 'schedule'
                  ? (
                    <>
                      <span>{`Schedule ${selectedVehicle.name}`}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900/20" />
                      <span>{formatCurrency(selectedVehicle.supportsBidding && shouldUseDriverBidding ? selectedBidCeiling : selectedVehicle.price)}</span>
                    </>
                  )
                  : selectedAvailability.totalDrivers
                  ? (
                    <>
                      <span>{`Book ${selectedVehicle.name}`}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900/20" />
                      <span>{formatCurrency(selectedVehicle.price)}</span>
                    </>
                  )
                  : `${selectedVehicle.name} Unavailable`
                : 'Select Vehicle'}
            </motion.button>

            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className={`flex h-auto min-h-[56px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-[20px] border transition-all ${
                paymentMethod === 'Cash'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-600 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.45)]'
                  : 'border-blue-100 bg-blue-50 text-blue-600 shadow-[0_10px_24px_-12px_rgba(59,130,246,0.45)]'
              }`}
              aria-label={`Payment method ${paymentMethod}`}
              title={`Payment method ${paymentMethod}`}
            >
              {paymentMethod === 'Cash' ? <Banknote size={18} strokeWidth={2.4} /> : <CreditCard size={18} strokeWidth={2.4} />}
              <span className="mt-1 text-[9px] font-black uppercase tracking-wider">{paymentMethod}</span>
            </button>
          </div>

          {rideMode === 'schedule' ? (
            scheduleError ? (
              <p className="text-[11px] font-bold text-rose-500">{scheduleError}</p>
            ) : (
              <p className="text-[11px] font-medium text-slate-500">
                Scheduled for {formatScheduledDisplay(scheduledAt)}. Drivers will be notified automatically.
              </p>
            )
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {previewVehicle && (
          <React.Fragment key="vehicle-preview-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewVehicleId('')}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] max-w-lg mx-auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[28px] px-5 pt-4 pb-8 z-[101]"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">Vehicle details</p>
                  <h3 className="text-[20px] font-extrabold text-slate-900">{previewVehicle.name}</h3>
                  <p className="mt-1 text-[12px] font-bold text-slate-500">
                    {previewVehicle.sublabel || 'Comfortable ride option for this route.'}
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-slate-50">
                  <img src={previewVehicle.icon} alt={previewVehicle.name} className="h-12 w-14 object-contain" draggable={false} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Estimated fare</p>
                  <p className="mt-1 text-[17px] font-extrabold text-slate-900">
                    {isFarePending ? 'Calculating...' : formatVehicleFare(previewVehicle)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Seats</p>
                  <p className="mt-1 text-[17px] font-extrabold text-slate-900">{previewVehicle.capacity}</p>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Booking type</p>
                  <p className="mt-1 text-[14px] font-extrabold text-slate-900">{formatDispatchLabel(previewVehicle)}</p>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Availability</p>
                  <p className="mt-1 text-[14px] font-extrabold text-slate-900">
                    {rideMode === 'schedule'
                      ? 'Can be scheduled'
                      : previewAvailability.totalDrivers
                        ? `${previewAvailability.totalDrivers} nearby`
                        : 'Unavailable now'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border border-orange-100 bg-orange-50/60 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-500">Trip snapshot</p>
                <p className="mt-2 text-[12px] font-bold leading-5 text-slate-700">
                  {rideMode === 'schedule'
                    ? 'This vehicle can be reserved for a later trip at your chosen time.'
                    : previewAvailability.totalDrivers
                      ? formatAvailabilityLine(previewAvailability)
                      : 'No driver is currently online for this vehicle around your pickup.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewVehicleId('')}
                className="mt-5 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[13px] font-black uppercase tracking-[0.14em] text-slate-700"
              >
                Close
              </button>
            </motion.div>
          </React.Fragment>
        )}

        {showBidModal && selectedVehicle?.supportsBidding && shouldUseDriverBidding && (
          <React.Fragment key="bid-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBidModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] max-w-lg mx-auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[28px] px-5 pt-4 pb-10 z-[101]"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">Bid fare</p>
              <h3 className="text-[18px] font-bold text-slate-900">Choose your max fare</h3>
              <p className="mt-1 text-[12px] font-bold text-slate-500">
                Drivers can send offers up to this amount for {selectedVehicle.name}.
              </p>

              <div className="mt-5 rounded-[20px] border border-orange-100 bg-orange-50/60 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-500">Bid Range</p>
                    <p className="mt-1 text-[13px] font-bold text-slate-900">Adjust the fare ceiling before sending the request.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Max fare</p>
                    <p className="mt-1 text-[20px] font-black text-slate-900">{formatCurrency(selectedBidCeiling)}</p>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={selectedBidSteps}
                  step={1}
                  value={Math.min(bidStepCount, selectedBidSteps)}
                  onChange={(event) => setBidStepCount(Number(event.target.value || 0))}
                  className="mt-4 h-2 w-full cursor-pointer accent-orange-500"
                />

                <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Base {formatCurrency(selectedVehicle.price)}</span>
                  <span>Increment {formatCurrency(selectedBidIncrement)}</span>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="flex-1 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[13px] font-black uppercase tracking-[0.14em] text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={proceedToBooking}
                  className="flex-1 rounded-[18px] bg-[#f8e001] px-4 py-3 text-[13px] font-black uppercase tracking-[0.14em] text-slate-900 shadow-[0_12px_28px_-4px_rgba(248,224,1,0.4)]"
                >
                  Send Bid
                </button>
              </div>
            </motion.div>
          </React.Fragment>
        )}

        <AnimatePresence>
        {showPaymentModal && (
          <React.Fragment key="payment-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] max-w-lg mx-auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-[28px] px-5 pt-4 pb-10 z-[101]"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payment</p>
              <h3 className="text-[18px] font-bold text-slate-900 mb-5">Select Method</h3>
              <div className="space-y-2.5">
                {paymentOptions.map(({ id, stateValue, label, sub, Icon, bg, color }) => (
                  <motion.button
                    key={stateValue}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setPaymentMethod(stateValue);
                      setShowPaymentModal(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-4 rounded-[18px] border-2 transition-all ${
                      paymentMethod === stateValue ? 'border-orange-200 bg-orange-50/40' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-[12px] ${bg} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={color} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-bold text-slate-900">{label}</p>
                      <p className="text-[11px] font-bold text-slate-400">{sub}</p>
                    </div>
                    {paymentMethod === stateValue && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </React.Fragment>
        )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
};

export default SelectVehicle;
