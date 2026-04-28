import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Contact,
  LocateFixed,
  MapPin,
  Mic,
  Navigation,
  PackageCheck,
  Phone,
  Plus,
  User,
  X,
} from 'lucide-react';
import { GoogleMap } from '@react-google-maps/api';
import { HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../../admin/utils/googleMaps';
import { userAuthService } from '../../services/authService';

const Motion = motion;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const LOCATION_COORDS = {
  'Pipaliyahana, Indore': [75.9048, 22.7039],
  'Vijay Nagar': [75.8937, 22.7533],
  'Vijay Nagar Square': [75.8947, 22.7518],
  Rajwada: [75.8553, 22.7187],
  Bhawarkua: [75.8586, 22.6926],
  'MG Road': [75.8721, 22.7196],
  'Palasia Square': [75.8863, 22.7242],
  'LIG Colony': [75.8904, 22.7322],
  'Scheme No 54': [75.8978, 22.7567],
  'AB Road': [75.8878, 22.7423],
  'Geeta Bhawan': [75.8834, 22.7208],
  'Sapna Sangeeta': [75.8587, 22.6984],
  'Mahalaxmi Nagar': [75.9114, 22.7676],
};
const POPULAR_LOCATIONS = Object.keys(LOCATION_COORDS);
const DEFAULT_COORDS = { lat: 22.7196, lng: 75.8577 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const getCoords = (title, fallback = [75.8577, 22.7196]) => LOCATION_COORDS[title] || fallback;

const readStoredUserInfo = () => {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.localStorage.getItem('userInfo') || '{}');
  } catch {
    return {};
  }
};

const coordPairToLatLng = (coords, fallback = DEFAULT_COORDS) => {
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return fallback;
};

const latLngToCoordPair = (position) => [Number(position.lng), Number(position.lat)];

const formatCoordLabel = (coords) => {
  const position = coordPairToLatLng(coords);
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
};

const formatLatLngLabel = (position) => `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
const COORDINATE_LABEL_REGEX = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;
const isCoordinateLabel = (value = '') => COORDINATE_LABEL_REGEX.test(String(value || '').trim());

const PhoneInput = ({ label, value, onChange, error, name, onClearError, disabled = false }) => (
  <div className="space-y-2">
    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</label>
    <div
      className={`flex items-center gap-3 rounded-[18px] border p-4 transition-all ${
        error
          ? 'border-red-200 bg-red-50'
          : value && PHONE_REGEX.test(value)
            ? 'border-emerald-100 bg-emerald-50'
            : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <Phone
        size={18}
        className={
          error ? 'text-red-500' : value && PHONE_REGEX.test(value) ? 'text-emerald-500' : 'text-slate-400'
        }
      />
      <input
        type="tel"
        maxLength={10}
        disabled={disabled}
        className="flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:text-slate-300"
        value={value}
        placeholder="10-digit mobile number"
        onChange={(event) => {
          const nextValue = event.target.value.replace(/\D/g, '');
          onChange(nextValue);
          if (onClearError) onClearError(name, nextValue);
        }}
      />
      {value && PHONE_REGEX.test(value) ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : null}
    </div>
    {error ? (
      <p className="ml-2 flex items-center gap-1 text-[11px] font-black text-red-500">
        <AlertCircle size={11} strokeWidth={3} />
        {error}
      </p>
    ) : null}
  </div>
);

const MapPickerSheet = ({ open, title, confirmLabel, value, initialCoords, onClose, onConfirm }) => {
  const { isLoaded, loadError } = useAppGoogleMapsLoader();
  const [center, setCenter] = useState(coordPairToLatLng(initialCoords));
  const [selectedAddress, setSelectedAddress] = useState(value || formatCoordLabel(initialCoords));
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const mapRef = useRef(null);
  const draggingRef = useRef(false);
  const geocodeTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const resetTimer = setTimeout(() => {
      setCenter(coordPairToLatLng(initialCoords));
      setSelectedAddress(value || formatCoordLabel(initialCoords));
    }, 0);

    return () => clearTimeout(resetTimer);
  }, [initialCoords, open, value]);

  useEffect(() => {
    if (!open || !isLoaded || !window.google?.maps?.Geocoder) return undefined;

    clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      setIsResolvingAddress(true);
      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ location: center }, (results, status) => {
        setIsResolvingAddress(false);

        if (status === 'OK' && results?.[0]?.formatted_address) {
          setSelectedAddress(results[0].formatted_address);
          return;
        }

        setSelectedAddress(formatLatLngLabel(center));
      });
    }, 450);

    return () => clearTimeout(geocodeTimerRef.current);
  }, [center, isLoaded, open]);

  const commitMapCenter = () => {
    if (!mapRef.current) return;
    const mapCenter = mapRef.current.getCenter();
    if (!mapCenter) return;

    setCenter({
      lat: mapCenter.lat(),
      lng: mapCenter.lng(),
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSelectedAddress('Location access is not available on this device.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setIsLocating(false);
        setCenter(next);
        if (mapRef.current) {
          mapRef.current.panTo(next);
          mapRef.current.setZoom(16);
        }
      },
      () => {
        setIsLocating(false);
        setSelectedAddress('Could not fetch your current location.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
        <Motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute inset-x-0 bottom-0 top-[10%] mx-auto flex max-w-lg flex-col overflow-hidden rounded-t-[34px] bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Map Picker</p>
              <h3 className="text-lg font-black tracking-tight text-slate-900">{title}</h3>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
              <X size={18} />
            </button>
          </div>

          <div className="relative flex-1 bg-slate-100">
            {HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={center}
                zoom={16}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                onUnmount={() => {
                  mapRef.current = null;
                }}
                onDragStart={() => {
                  draggingRef.current = true;
                }}
                onDragEnd={() => {
                  draggingRef.current = false;
                  commitMapCenter();
                }}
                onIdle={() => {
                  if (!mapRef.current || draggingRef.current) return;
                  commitMapCenter();
                }}
                options={{
                  disableDefaultUI: true,
                  zoomControl: false,
                  clickableIcons: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-500">
                {loadError ? 'Map could not be loaded right now.' : 'Loading map...'}
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-4">
              <div className="rounded-[22px] border border-white bg-white/92 px-4 py-4 shadow-xl backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {isResolvingAddress ? 'Resolving address...' : 'Selected location'}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-slate-700">{selectedAddress}</p>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-blue-600 shadow-xl">
                <MapPin size={18} className="text-white" />
              </div>
            </div>

            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={isLocating}
              className="absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-900 shadow-xl"
            >
              <LocateFixed size={20} className={isLocating ? 'animate-pulse text-blue-600' : ''} />
            </button>
          </div>

          <div className="bg-white px-5 pb-8 pt-5">
            <button
              type="button"
              onClick={() => onConfirm(latLngToCoordPair(center), selectedAddress)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
            >
              {confirmLabel}
              <ChevronRight size={16} />
            </button>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
};

const ContactDetailsSheet = ({
  open,
  onClose,
  senderName,
  setSenderName,
  senderMobile,
  setSenderMobile,
  useSelfForReceiver,
  setUseSelfForReceiver,
  receiverName,
  setReceiverName,
  receiverMobile,
  setReceiverMobile,
  errors,
  clearError,
}) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
        <Motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="absolute inset-x-0 bottom-0 mx-auto max-w-lg overflow-hidden rounded-t-[34px] bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Booking Details</p>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Sender & receiver</h3>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[75vh] space-y-6 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <User size={16} />
                </div>
                <p className="text-sm font-black text-slate-900">Sender</p>
              </div>

              <div className="space-y-2">
                <div className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${errors.senderName ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/80'}`}>
                  <User size={16} className="text-slate-400" />
                  <input
                    type="text"
                    value={senderName}
                    placeholder="Sender name"
                    onChange={(event) => {
                      setSenderName(event.target.value);
                      clearError('senderName');
                    }}
                    className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                  />
                </div>
                {errors.senderName ? <p className="text-[11px] font-black text-red-500">{errors.senderName}</p> : null}
              </div>

              <PhoneInput label="Mobile Number" value={senderMobile} onChange={setSenderMobile} error={errors.senderMobile} name="senderMobile" onClearError={clearError} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <Contact size={16} />
                </div>
                <p className="text-sm font-black text-slate-900">Receiver</p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                <input
                  type="checkbox"
                  checked={useSelfForReceiver}
                  onChange={(event) => setUseSelfForReceiver(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">Receiver is self</p>
                  <p className="text-[11px] font-medium text-slate-500">Auto-fill receiver details with your user details</p>
                </div>
              </label>

              <div className="space-y-2">
                <div className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${errors.receiverName ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/80'} ${useSelfForReceiver ? 'opacity-70' : ''}`}>
                  <User size={16} className="text-slate-400" />
                  <input
                    type="text"
                    value={receiverName}
                    placeholder="Receiver name"
                    disabled={useSelfForReceiver}
                    onChange={(event) => {
                      setReceiverName(event.target.value);
                      clearError('receiverName');
                    }}
                    className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                  />
                </div>
                {errors.receiverName ? <p className="text-[11px] font-black text-red-500">{errors.receiverName}</p> : null}
              </div>

              <PhoneInput label="Mobile Number" value={receiverMobile} onChange={setReceiverMobile} error={errors.receiverMobile} name="receiverMobile" onClearError={clearError} disabled={useSelfForReceiver} />
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <button type="button" onClick={onClose} className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-slate-900 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]">
              Save Details
              <ChevronRight size={16} />
            </button>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
};

const SenderReceiverDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded: isGoogleMapsLoaded } = useAppGoogleMapsLoader();
  const parcelState = location.state || {};
  const storedUser = useMemo(() => readStoredUserInfo(), []);
  const [senderName, setSenderName] = useState(() => parcelState.senderName || storedUser?.name || '');
  const [senderMobile, setSenderMobile] = useState(() => parcelState.senderMobile || storedUser?.phone || '');
  const [useSelfForReceiver, setUseSelfForReceiver] = useState(() => {
    const receiverNameSeed = String(parcelState.receiverName || '').trim();
    const receiverMobileSeed = String(parcelState.receiverMobile || '').trim();
    const userNameSeed = String(storedUser?.name || '').trim();
    const userPhoneSeed = String(storedUser?.phone || '').trim();
    return Boolean(
      receiverNameSeed &&
      receiverMobileSeed &&
      receiverNameSeed === userNameSeed &&
      receiverMobileSeed === userPhoneSeed,
    );
  });
  const [receiverName, setReceiverName] = useState(() => parcelState.receiverName || '');
  const [receiverMobile, setReceiverMobile] = useState(() => parcelState.receiverMobile || '');
  const [pickup, setPickup] = useState(() => parcelState.pickup || '');
  const [drop, setDrop] = useState(() => parcelState.drop || '');
  const [pickupCoords, setPickupCoords] = useState(() => parcelState.pickupCoords || getCoords(parcelState.pickup || '', [75.8577, 22.7196]));
  const [dropCoords, setDropCoords] = useState(() => parcelState.dropCoords || getCoords(parcelState.drop || '', [75.8577, 22.7196]));
  const [activeMapPicker, setActiveMapPicker] = useState(null);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);
  const [errors, setErrors] = useState({});
  const autoPickupRequestedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const hydrateSenderDetails = async () => {
      try {
        const response = await userAuthService.getCurrentUser();
        const user = response?.data?.user || response?.data?.data || {};

        if (!active || (!user?.name && !user?.phone)) return;

        const nextName = user.name || '';
        const nextPhone = user.phone || '';

        if (nextName || nextPhone) {
          window.localStorage.setItem('userInfo', JSON.stringify({ ...storedUser, ...user }));
        }

        setSenderName((current) => (!String(current || '').trim() || String(current || '').trim() === String(storedUser?.name || '').trim() ? nextName || current : current));
        setSenderMobile((current) => (!String(current || '').trim() || String(current || '').trim() === String(storedUser?.phone || '').trim() ? nextPhone || current : current));
      } catch {
        // ignore and keep fallback info
      }
    };

    hydrateSenderDetails();

    return () => {
      active = false;
    };
  }, [storedUser]);

  const pickupSuggestions = useMemo(
    () => POPULAR_LOCATIONS.filter((item) => item.toLowerCase().includes(String(pickup || '').toLowerCase())).slice(0, 4),
    [pickup],
  );
  const dropSuggestions = useMemo(
    () => POPULAR_LOCATIONS.filter((item) => item.toLowerCase().includes(String(drop || '').toLowerCase())).slice(0, 4),
    [drop],
  );

  const validate = () => {
    const nextErrors = {};
    if (!senderName.trim()) nextErrors.senderName = 'Sender name is required';
    if (!PHONE_REGEX.test(senderMobile)) nextErrors.senderMobile = 'Enter a valid 10-digit number';
    if (!receiverName.trim()) nextErrors.receiverName = 'Receiver name is required';
    if (!PHONE_REGEX.test(receiverMobile)) nextErrors.receiverMobile = 'Enter a valid 10-digit number';
    if (!pickup.trim()) nextErrors.pickup = 'Pickup location is required';
    if (!drop.trim()) nextErrors.drop = 'Drop location is required';
    setErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
      nextErrors,
    };
  };

  const clearError = (key) => {
    if (!errors[key]) return;
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const syncReceiverWithSelf = () => {
    const nextName = String(storedUser?.name || senderName || '').trim();
    const nextPhone = String(storedUser?.phone || senderMobile || '').trim();

    setReceiverName(nextName);
    setReceiverMobile(nextPhone);
    setErrors((prev) => ({
      ...prev,
      receiverName: '',
      receiverMobile: nextPhone && !PHONE_REGEX.test(nextPhone) ? 'Enter a valid 10-digit number' : '',
    }));
  };

  useEffect(() => {
    if (!useSelfForReceiver) return;
    const timer = setTimeout(() => {
      const nextName = String(storedUser?.name || senderName || '').trim();
      const nextPhone = String(storedUser?.phone || senderMobile || '').trim();

      setReceiverName(nextName);
      setReceiverMobile(nextPhone);
      setErrors((prev) => ({
        ...prev,
        receiverName: '',
        receiverMobile: nextPhone && !PHONE_REGEX.test(nextPhone) ? 'Enter a valid 10-digit number' : '',
      }));
    }, 0);

    return () => clearTimeout(timer);
  }, [senderMobile, senderName, storedUser, useSelfForReceiver]);

  const validatePhoneField = (key, value) => {
    const trimmedValue = String(value || '').trim();

    setErrors((prev) => {
      const nextError = trimmedValue && !PHONE_REGEX.test(trimmedValue) ? 'Enter a valid 10-digit number' : '';
      if (prev[key] === nextError) return prev;
      return { ...prev, [key]: nextError };
    });
  };

  const clearPhoneError = (key, value) => {
    validatePhoneField(key, value);
  };

  const resolveAddressFromCoords = useEffectEvent((position) =>
    new Promise((resolve) => {
      if (!isGoogleMapsLoaded || !window.google?.maps?.Geocoder) {
        resolve(formatLatLngLabel(position));
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results?.[0]?.formatted_address) {
          resolve(results[0].formatted_address);
          return;
        }
        resolve(formatLatLngLabel(position));
      });
    }));

  const requestCurrentPickupLocation = useEffectEvent(() => {
    if (!navigator.geolocation) {
      setErrors((prev) => ({ ...prev, pickup: 'Current location is not available' }));
      return;
    }

    setIsLocatingPickup(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        const coords = latLngToCoordPair(next);
        const address = await resolveAddressFromCoords(next);
        setPickupCoords(coords);
        setPickup(address || formatLatLngLabel(next));
        clearError('pickup');
        setIsLocatingPickup(false);
      },
      () => {
        setIsLocatingPickup(false);
        setErrors((prev) => ({ ...prev, pickup: 'Location permission denied' }));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });

  useEffect(() => {
    if (autoPickupRequestedRef.current || pickup.trim()) return;
    autoPickupRequestedRef.current = true;
    const timer = setTimeout(() => {
      requestCurrentPickupLocation();
    }, 0);

    return () => clearTimeout(timer);
  }, [pickup]);

  useEffect(() => {
    if (!pickupCoords || !pickup || !isCoordinateLabel(pickup) || !isGoogleMapsLoaded) {
      return;
    }

    let active = true;

    resolveAddressFromCoords(coordPairToLatLng(pickupCoords)).then((resolvedAddress) => {
      if (!active || !resolvedAddress || isCoordinateLabel(resolvedAddress)) {
        return;
      }

      setPickup((current) => (isCoordinateLabel(current) ? resolvedAddress : current));
    });

    return () => {
      active = false;
    };
  }, [isGoogleMapsLoaded, pickup, pickupCoords]);

  const applySuggestion = (type, value) => {
    if (type === 'pickup') {
      setPickup(value);
      setPickupCoords(getCoords(value));
      clearError('pickup');
      return;
    }

    setDrop(value);
    setDropCoords(getCoords(value));
    clearError('drop');
  };

  const handleProceed = () => {
    const { isValid, nextErrors } = validate();

    if (!isValid) {
      if (nextErrors.senderName || nextErrors.senderMobile || nextErrors.receiverName || nextErrors.receiverMobile) {
        setIsContactSheetOpen(true);
      }
      return;
    }

    navigate('/parcel/searching', {
      state: {
        ...parcelState,
        pickup,
        drop,
        pickupCoords,
        dropCoords,
        senderName,
        senderMobile,
        receiverName,
        receiverMobile,
        paymentMethod: 'Cash',
        fare: parcelState.estimatedFare?.min || 45,
        deliveryScope: parcelState.deliveryScope || 'city',
        isOutstation: Boolean(parcelState.isOutstation || parcelState.deliveryScope === 'outstation'),
        parcel: {
          category: parcelState.parcelType || 'Parcel',
          weight: parcelState.weight || 'Under 5kg',
          description: parcelState.description || '',
          deliveryScope: parcelState.deliveryScope || 'city',
          isOutstation: Boolean(parcelState.isOutstation || parcelState.deliveryScope === 'outstation'),
          senderName,
          senderMobile,
          receiverName,
          receiverMobile,
        },
        isParcel: true,
        searchNonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col overflow-x-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f7f9fc_100%)] font-sans">
      <MapPickerSheet
        open={activeMapPicker === 'pickup'}
        title="Set Pickup Location"
        value={pickup}
        initialCoords={pickupCoords}
        confirmLabel="Confirm Pickup"
        onClose={() => setActiveMapPicker(null)}
        onConfirm={(coords, address) => {
          setPickupCoords(coords);
          setPickup(address || formatCoordLabel(coords));
          clearError('pickup');
          setActiveMapPicker(null);
        }}
      />
      <MapPickerSheet
        open={activeMapPicker === 'drop'}
        title="Set Delivery Location"
        value={drop}
        initialCoords={dropCoords}
        confirmLabel="Confirm Drop"
        onClose={() => setActiveMapPicker(null)}
        onConfirm={(coords, address) => {
          setDropCoords(coords);
          setDrop(address || formatCoordLabel(coords));
          clearError('drop');
          setActiveMapPicker(null);
        }}
      />
      <ContactDetailsSheet
        open={isContactSheetOpen}
        onClose={() => setIsContactSheetOpen(false)}
        senderName={senderName}
        setSenderName={setSenderName}
        senderMobile={senderMobile}
        setSenderMobile={setSenderMobile}
        useSelfForReceiver={useSelfForReceiver}
        setUseSelfForReceiver={(checked) => {
          setUseSelfForReceiver(checked);
          if (!checked) {
            return;
          }
          syncReceiverWithSelf();
        }}
        receiverName={receiverName}
        setReceiverName={(value) => {
          if (useSelfForReceiver) {
            setUseSelfForReceiver(false);
          }
          setReceiverName(value);
        }}
        receiverMobile={receiverMobile}
        setReceiverMobile={(value) => {
          if (useSelfForReceiver) {
            setUseSelfForReceiver(false);
          }
          setReceiverMobile(value);
        }}
        errors={errors}
        clearError={(key, value) => {
          if (key === 'senderMobile' || key === 'receiverMobile') {
            clearPhoneError(key, value);
            return;
          }
          clearError(key);
        }}
      />

      <header className="sticky top-0 z-20 flex items-center px-4 py-4">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition-colors hover:bg-slate-100">
          <ArrowLeft size={24} />
        </button>
      </header>

      <main className="flex-1 px-4 pt-1 pb-28">
        <div className="rounded-[24px] bg-white p-5 shadow-sm border border-slate-100">
          <div className="flex gap-4">
            {/* Visual Route Indicator */}
            <div className="flex flex-col items-center pt-5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="h-14 border-l border-dashed border-slate-200 my-1" />
              <div className="h-2 w-2 rounded-full bg-rose-500" />
            </div>

            <div className="flex-1 min-w-0 space-y-6">
              {/* Pickup Section */}
              <button 
                type="button" 
                onClick={() => setActiveMapPicker('pickup')} 
                className="flex w-full items-center justify-between group text-left min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-bold text-slate-900 truncate">
                      {senderName || 'Sender Details'}
                    </p>
                    {senderMobile && (
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {senderMobile}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-slate-500 truncate">
                    {pickup || (isLocatingPickup ? 'Detecting current location...' : 'Set pickup location')}
                  </p>
                </div>
                <div className="ml-2 shrink-0">
                  {isLocatingPickup ? (
                    <Navigation size={16} className="text-blue-500 animate-pulse" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              </button>

              <hr className="border-slate-50" />

              {/* Drop Input Section */}
              <div className="flex items-center gap-3">
                <div className={`flex h-12 flex-1 items-center gap-3 rounded-xl border px-3 transition-all ${
                  errors.drop ? 'border-red-300 bg-red-50/30' : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'
                }`}>
                  <input
                    type="text"
                    value={drop}
                    onChange={(event) => {
                      setDrop(event.target.value);
                      clearError('drop');
                    }}
                    placeholder="Where is your Drop ?"
                    className="flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <Mic size={18} className="text-slate-400" />
                </div>

                <button
                  type="button"
                  onClick={() => setIsContactSheetOpen(true)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    receiverName && PHONE_REGEX.test(receiverMobile)
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Error messages */}
              {errors.pickup && <p className="text-[11px] font-medium text-red-500">Pickup: {errors.pickup}</p>}
              {errors.drop && <p className="text-[11px] font-medium text-red-500">Drop: {errors.drop}</p>}
            </div>
          </div>
        </div>

        {/* Action Link */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setActiveMapPicker(pickup ? 'drop' : 'pickup')}
            className="flex items-center gap-2 text-[13px] font-bold text-blue-600 hover:text-blue-700"
          >
            <MapPin size={16} />
            <span>Select on map</span>
          </button>
        </div>

        {/* Suggestions */}
        {(pickupSuggestions.length > 0 && !pickup) || (dropSuggestions.length > 0 && drop) ? (
          <div className="mt-6 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Quick Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {((!pickup ? pickupSuggestions : dropSuggestions) || []).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applySuggestion(!pickup ? 'pickup' : 'drop', item)}
                  className="rounded-full border border-slate-100 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="mt-8 rounded-[24px] bg-slate-900 px-4 py-4 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Approx. Delivery Fare</p>
              <p className="mt-1 text-lg font-black">Rs {parcelState.estimatedFare?.min || 45} - Rs {parcelState.estimatedFare?.max || 80}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <PackageCheck size={22} className="text-emerald-300" />
            </div>
          </div>
        </motion.section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 p-4">
        <div className="mx-auto max-w-lg">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F8FBFF] via-[#F8FBFF]/92 to-transparent" />
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleProceed}
            className="relative flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-slate-900 text-[15px] font-black text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]"
          >
            Find Delivery Agent
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SenderReceiverDetails;
