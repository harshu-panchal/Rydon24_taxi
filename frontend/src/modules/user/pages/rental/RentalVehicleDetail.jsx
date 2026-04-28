import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Image as ImageIcon,
  Luggage,
  Loader2,
  MapPin,
  Navigation,
  Shield,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../../../../shared/context/SettingsContext';
import { userService } from '../../services/userService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/60';

const SeatPreview = ({ blueprint }) => {
  const rows = blueprint?.lowerDeck || [];

  if (!rows.length) {
    return (
      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] font-semibold text-slate-400">
        No seating blueprint available
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-2">
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, row.length)}, minmax(0, 1fr))` }}
          >
            {row.map((cell, cellIndex) => (
              <div
                key={`${rowIndex}-${cellIndex}`}
                className={`h-11 rounded-2xl ${
                  cell?.kind === 'seat'
                    ? cell.status === 'blocked'
                      ? 'border border-rose-200 bg-rose-50'
                      : 'border border-slate-200 bg-white'
                    : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const packageSuffix = (hours) => {
  const value = Number(hours || 0);
  if (value <= 1) return '/hr';
  if (value <= 12) return `/${value}hr`;
  return '/day';
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const calculateDistanceKm = (from, to) => {
  if (!from || !to) return null;

  const fromLat = Number(from.latitude);
  const fromLng = Number(from.longitude);
  const toLat = Number(to.latitude);
  const toLng = Number(to.longitude);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (value) => {
  if (!Number.isFinite(value)) return null;
  if (value < 1) return `${Math.max(100, Math.round(value * 1000))} m away`;
  return `${value.toFixed(value < 10 ? 1 : 0)} km away`;
};

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeId = (value) =>
  String(value?._id || value?.id || value?.service_location_id || value || '').trim();

const resolveStoreServiceLocationId = (store = {}) =>
  normalizeId(store.service_location_id);

const getCurrentCoordinates = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });

const RentalVehicleDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'App';
  const { vehicle, duration } = location.state || {};

  const [selectedImage, setSelectedImage] = useState(vehicle?.gallery?.[0] || vehicle?.image || '');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectionStep, setSelectionStep] = useState('package');
  const [serviceLocations, setServiceLocations] = useState([]);
  const [selectedServiceLocationId, setSelectedServiceLocationId] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    requestedHours: duration === 'Hourly' ? 4 : duration === 'Half-Day' ? 8 : 24,
    pickupLocation: '',
    dropLocation: '',
    seatsNeeded: Math.min(Number(vehicle?.capacity || 1), 4) || 1,
    luggageNeeded: Number(vehicle?.luggageCapacity || 0) || 0,
    pickupDateTime: '',
    returnDateTime: '',
    specialRequirements: '',
  });
  const [submittingQuote, setSubmittingQuote] = useState(false);

  if (!vehicle) {
    navigate('/rental');
    return null;
  }

  const gallery = vehicle.gallery?.length ? vehicle.gallery : vehicle.image ? [vehicle.image] : [];
  const pricingRows = Array.isArray(vehicle.rawPricing)
    ? [...vehicle.rawPricing].sort(
        (a, b) => Number(a.durationHours || 0) - Number(b.durationHours || 0),
      )
    : [];

  const defaultPackage = useMemo(() => {
    if (!pricingRows.length) return null;

    if (duration === 'Daily') {
      return (
        pricingRows.find((row) => Number(row.durationHours || 0) >= 24) ||
        pricingRows[pricingRows.length - 1]
      );
    }

    if (duration === 'Half-Day') {
      return (
        pricingRows.find((row) => {
          const hours = Number(row.durationHours || 0);
          return hours >= 6 && hours <= 12;
        }) || pricingRows[Math.min(1, pricingRows.length - 1)]
      );
    }

    return (
      pricingRows.find((row) => Number(row.durationHours || 0) <= 6) ||
      pricingRows[0]
    );
  }, [duration, pricingRows]);

  const selectedPackage = useMemo(
    () =>
      pricingRows.find((row) => String(row.id) === String(selectedPackageId)) ||
      defaultPackage ||
      null,
    [defaultPackage, pricingRows, selectedPackageId],
  );

  const selectedServiceLocation = useMemo(
    () =>
      serviceLocations.find(
        (item) => String(item.id) === String(selectedServiceLocationId),
      ) || null,
    [selectedServiceLocationId, serviceLocations],
  );

  const summaryBadges = useMemo(
    () => [
      { icon: Users, label: `${vehicle.capacity || 0} seats` },
      { icon: Luggage, label: `${vehicle.luggageCapacity || 0} bags` },
      { icon: Fuel, label: vehicle.vehicleCategory || 'Vehicle' },
    ],
    [vehicle],
  );

  useEffect(() => {
    if (defaultPackage?.id) {
      setSelectedPackageId(String(defaultPackage.id));
    }
  }, [defaultPackage]);

  useEffect(() => {
    let mounted = true;

    const loadServiceLocations = async () => {
      setLocationsLoading(true);
      setLocationError('');
      setIsLocatingUser(true);

      try {
        const [locationsResponse, storesResponse, coords] = await Promise.all([
          userService.getServiceLocations(),
          userService.getServiceStores(),
          getCurrentCoordinates(),
        ]);

        if (!mounted) return;

        setUserCoordinates(coords);
        setIsLocatingUser(false);

        const allLocations = normalizeListResponse(locationsResponse).filter(
          (item) => item.active !== false && item.status !== 'inactive',
        );
        const allStores = normalizeListResponse(storesResponse).filter(
          (item) => item.active !== false && item.status !== 'inactive',
        );

        const allowedStoreIds = new Set(
          Array.isArray(vehicle.serviceStoreIds)
            ? vehicle.serviceStoreIds.map((item) => String(item))
            : [],
        );

        const scopedStores = allowedStoreIds.size
          ? allStores.filter((store) => allowedStoreIds.has(String(store._id || store.id)))
          : allStores;

        const allowedLocationIds = new Set(
          scopedStores
            .map((store) => resolveStoreServiceLocationId(store))
            .filter(Boolean),
        );

        const scopedLocations = allowedLocationIds.size
          ? allLocations.filter((item) => allowedLocationIds.has(normalizeId(item)))
          : allLocations;

        const options = scopedLocations
          .map((item) => {
            const id = normalizeId(item);
            const locationStores = scopedStores.filter(
              (store) => resolveStoreServiceLocationId(store) === id,
            );

            const distanceCandidates = [
              calculateDistanceKm(coords, {
                latitude: item.latitude,
                longitude: item.longitude,
              }),
              ...locationStores.map((store) =>
                calculateDistanceKm(coords, {
                  latitude: store.latitude,
                  longitude: store.longitude,
                }),
              ),
            ].filter((value) => Number.isFinite(value));

            const nearestDistanceKm = distanceCandidates.length
              ? Math.min(...distanceCandidates)
              : null;

            return {
              id,
              name: item.name || item.service_location_name || 'Service location',
              address:
                item.address ||
                locationStores.find((store) => store.address)?.address ||
                '',
              latitude: Number(item.latitude),
              longitude: Number(item.longitude),
              distanceKm: nearestDistanceKm,
              distanceLabel: formatDistance(nearestDistanceKm),
              storeCount: locationStores.length,
            };
          })
          .sort((left, right) => {
            const leftDistance = left.distanceKm;
            const rightDistance = right.distanceKm;

            if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance)) {
              return leftDistance - rightDistance;
            }

            if (Number.isFinite(leftDistance)) return -1;
            if (Number.isFinite(rightDistance)) return 1;

            return left.name.localeCompare(right.name);
          });

        setServiceLocations(options);
        setSelectedServiceLocationId(options[0]?.id || '');
      } catch (error) {
        if (!mounted) return;
        setIsLocatingUser(false);
        setLocationError(error?.message || 'Could not load available service locations.');
      } finally {
        if (mounted) setLocationsLoading(false);
      }
    };

    loadServiceLocations();

    return () => {
      mounted = false;
    };
  }, [vehicle.serviceStoreIds]);

  const submitQuote = async () => {
    if (!quoteForm.contactName.trim() || !quoteForm.contactPhone.trim()) {
      toast.error('Contact name and phone are required');
      return;
    }

    setSubmittingQuote(true);
    try {
      await userService.createRentalQuoteRequest({
        vehicleTypeId: vehicle.id,
        vehicleName: vehicle.name,
        contactName: quoteForm.contactName,
        contactPhone: quoteForm.contactPhone,
        contactEmail: quoteForm.contactEmail,
        requestedHours: Number(quoteForm.requestedHours || 0),
        pickupLocation: quoteForm.pickupLocation,
        dropLocation: quoteForm.dropLocation,
        seatsNeeded: Number(quoteForm.seatsNeeded || 1),
        luggageNeeded: Number(quoteForm.luggageNeeded || 0),
        pickupDateTime: quoteForm.pickupDateTime || null,
        returnDateTime: quoteForm.returnDateTime || null,
        specialRequirements: quoteForm.specialRequirements,
      });
      toast.success('Custom quote request sent to admin for review');
      setShowQuoteForm(false);
      setQuoteForm((current) => ({
        ...current,
        pickupLocation: '',
        dropLocation: '',
        specialRequirements: '',
      }));
    } catch (error) {
      toast.error(error?.message || 'Could not submit quote request.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleProceed = () => {
    if (!selectedPackage) {
      toast.error('Select an hourly rental package first.');
      return;
    }

    if (selectionStep === 'package') {
      setSelectionStep('location');
      return;
    }

    if (!selectedServiceLocation) {
      toast.error('Select a service location to continue.');
      return;
    }

    navigate('/rental/schedule', {
      state: {
        vehicle,
        duration,
        selectedPackage,
        serviceLocation: selectedServiceLocation,
        userCoordinates,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-36 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] shrink-0"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Vehicle Details</p>
            <h1 className="text-[18px] font-black tracking-tight text-slate-900 leading-tight truncate">
              {vehicle.name}
            </h1>
          </div>
        </div>
      </motion.header>

      <div className="px-5 pt-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[24px] border border-white/80 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden"
        >
          <div
            className="px-6 py-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${vehicle.gradientFrom} 0%, ${vehicle.gradientTo} 100%)` }}
          >
            {selectedImage ? (
              <img src={selectedImage} alt={vehicle.name} className="h-36 object-contain drop-shadow-xl" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center text-slate-300">
                <Car size={48} />
              </div>
            )}
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${vehicle.tagBg} ${vehicle.tagColor} mb-1.5`}
                >
                  {vehicle.tag}
                </span>
                <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-tight">
                  {vehicle.name}
                </h2>
                {vehicle.shortDescription ? (
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">
                    {vehicle.shortDescription}
                  </p>
                ) : null}
                <div className="flex items-center gap-1.5 mt-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-400" />
                  <span className="text-[13px] font-black text-slate-700">{vehicle.rating}</span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {selectedPackage
                      ? `- ${selectedPackage.includedKm} km included`
                      : `- ${vehicle.kmLimit?.[duration] || 'Flexible km'} limit`}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Rate
                </p>
                <p className="text-[24px] font-black text-slate-900 leading-none">
                  Rs.{selectedPackage?.price || vehicle.prices?.[duration] || 0}
                </p>
                <p className="text-[11px] font-bold text-slate-400">
                  {selectedPackage
                    ? packageSuffix(selectedPackage.durationHours)
                    : { Hourly: '/hr', 'Half-Day': '/6hr', Daily: '/day' }[duration] || '/hr'}
                </p>
              </div>
            </div>

            {gallery.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl border ${
                      selectedImage === image ? 'border-slate-900' : 'border-slate-200'
                    }`}
                  >
                    <img src={image} alt="Vehicle gallery" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-3 gap-3"
        >
          {summaryBadges.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-[18px] border border-white/80 bg-white/90 px-3 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
            >
              <Icon size={15} className="text-slate-400" />
              <p className="mt-2 text-[12px] font-black text-slate-900">{label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            What's included
          </p>
          <div className="space-y-2">
            {(vehicle.amenities?.length ? vehicle.amenities : vehicle.features).map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                <span className="text-[13px] font-bold text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
          {vehicle.description ? (
            <p className="text-[12px] font-semibold text-slate-500 leading-relaxed">
              {vehicle.description}
            </p>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Choose Hourly Rental
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black text-orange-600">
              {selectionStep === 'package' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </span>
          </div>

          <div className="space-y-3">
            {pricingRows.map((row) => {
              const isSelected = String(selectedPackageId) === String(row.id);

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedPackageId(String(row.id))}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {row.label}
                      </p>
                      <p className={`text-[11px] font-semibold ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                        {row.durationHours} hours - {row.includedKm} km included
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        Rs.{row.price}
                      </p>
                      <p className={`text-[11px] font-semibold ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                        {packageSuffix(row.durationHours)}
                      </p>
                    </div>
                  </div>
                  <div className={`mt-2 text-[11px] font-semibold ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    Extra hour: Rs.{row.extraHourPrice || 0} - Extra km: Rs.{row.extraKmPrice || 0}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {selectionStep === 'location' ? (
            <motion.div
              key="location-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Available Service Locations
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-slate-700">
                    Select where you want to pick up your rental.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectionStep('package')}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-500"
                >
                  <span className="inline-flex items-center gap-1">
                    <ChevronLeft size={12} /> Back
                  </span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-500">
                {isLocatingUser
                  ? 'Finding your current location to sort the closest service points...'
                  : userCoordinates
                    ? 'Service locations are sorted by distance from your current location. The nearest option is preselected.'
                    : 'Location access was unavailable, so service locations are shown in fallback order.'}
              </div>

              {locationsLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-[12px] font-bold text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading service locations...
                </div>
              ) : locationError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-[12px] font-bold text-rose-500">
                  {locationError}
                </div>
              ) : serviceLocations.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-[12px] font-bold text-slate-500">
                  No active service locations are available for this rental right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceLocations.map((item, index) => {
                    const isSelected = String(selectedServiceLocationId) === String(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedServiceLocationId(String(item.id))}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-200 bg-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.10)]'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[14px] font-black text-slate-900">{item.name}</p>
                              {index === 0 && userCoordinates ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                                  Closest
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex items-start gap-2">
                              <MapPin size={13} className="mt-0.5 shrink-0 text-orange-400" />
                              <div>
                                <p className="text-[12px] font-bold text-slate-600">
                                  {item.address || `${appName} pickup point`}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                  {item.storeCount > 0
                                    ? `${item.storeCount} pickup point${item.storeCount === 1 ? '' : 's'} available`
                                    : 'Pickup available'}
                                  {item.distanceLabel ? ` - ${item.distanceLabel}` : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                          {isSelected ? (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <CheckCircle2 size={16} />
                            </div>
                          ) : (
                            <Navigation size={16} className="mt-1 shrink-0 text-slate-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-[20px] border border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] px-5 py-4 space-y-3"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Seats Layout
          </p>
          <SeatPreview blueprint={vehicle.blueprint} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="flex items-center gap-3 rounded-[16px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
        >
          <div className="w-8 h-8 rounded-[10px] bg-slate-50 flex items-center justify-center shrink-0">
            <Shield size={15} className="text-slate-400" strokeWidth={2} />
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
            Valid driving license required. Refundable security deposit collected at booking.
          </p>
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowQuoteForm((current) => !current)}
          className="w-full rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-[14px] font-black text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          Request Custom Quote
        </motion.button>

        <AnimatePresence>
          {showQuoteForm ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] space-y-4"
            >
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Custom Quote Request
                </p>
              </div>
              <p className="text-[12px] font-semibold text-slate-500">
                Send your custom requirement and the admin team can review and quote a special price for this vehicle.
              </p>
              <div className="grid gap-4">
                <input
                  value={quoteForm.contactName}
                  onChange={(event) =>
                    setQuoteForm((current) => ({ ...current, contactName: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Your name"
                />
                <input
                  value={quoteForm.contactPhone}
                  onChange={(event) =>
                    setQuoteForm((current) => ({ ...current, contactPhone: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Phone number"
                />
                <input
                  value={quoteForm.contactEmail}
                  onChange={(event) =>
                    setQuoteForm((current) => ({ ...current, contactEmail: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Email (optional)"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={quoteForm.requestedHours}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        requestedHours: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Hours needed"
                  />
                  <input
                    type="number"
                    value={quoteForm.seatsNeeded}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        seatsNeeded: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Seats needed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={quoteForm.luggageNeeded}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        luggageNeeded: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Bags needed"
                  />
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
                    Vehicle cap: {vehicle.capacity || 0} seats - {vehicle.luggageCapacity || 0} bags
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={quoteForm.pickupDateTime}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      pickupDateTime: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
                <input
                  type="datetime-local"
                  value={quoteForm.returnDateTime}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      returnDateTime: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
                <input
                  value={quoteForm.pickupLocation}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      pickupLocation: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Pickup location"
                />
                <input
                  value={quoteForm.dropLocation}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      dropLocation: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Drop location"
                />
                <textarea
                  value={quoteForm.specialRequirements}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      specialRequirements: event.target.value,
                    }))
                  }
                  rows="4"
                  className={inputClass}
                  placeholder="Special requirement, route plan, driver need, wedding/event usage, custom timing, or anything else"
                />
                <button
                  type="button"
                  onClick={submitQuote}
                  disabled={submittingQuote}
                  className="w-full rounded-[16px] bg-[#2e3c78] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {submittingQuote ? 'Sending Request...' : 'Send To Admin For Review'}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleProceed}
          disabled={
            !selectedPackage ||
            (selectionStep === 'location' &&
              (locationsLoading || !selectedServiceLocation))
          }
          className={`pointer-events-auto w-full py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center justify-center gap-2 transition-all ${
            !selectedPackage ||
            (selectionStep === 'location' && (locationsLoading || !selectedServiceLocation))
              ? 'bg-slate-300'
              : 'bg-slate-900'
          }`}
        >
          {selectionStep === 'package' ? 'Proceed to Service Location' : 'Select Date & Time'}
          <ChevronRight size={17} strokeWidth={3} className="opacity-50" />
        </motion.button>
      </div>
    </div>
  );
};

export default RentalVehicleDetail;
