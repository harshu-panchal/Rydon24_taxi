import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MapPin, Navigation, ChevronRight, Map as MapIcon, LoaderCircle, AlertTriangle, X, Check } from 'lucide-react';
import { GoogleMap } from '@react-google-maps/api';
import { HAS_VALID_GOOGLE_MAPS_KEY, INDIA_CENTER, useAppGoogleMapsLoader } from '../../../admin/utils/googleMaps';

const CITY_CENTERS = {
  Indore: { lat: 22.7196, lng: 75.8577 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Ujjain: { lat: 23.1765, lng: 75.7885 },
  Jabalpur: { lat: 23.1815, lng: 79.9864 },
  Ratlam: { lat: 23.3315, lng: 75.0367 },
  Dewas: { lat: 22.9676, lng: 76.0534 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Pune: { lat: 18.5204, lng: 73.8567 },
};

const getCityCenter = (city) => CITY_CENTERS[city] || INDIA_CENTER;
const getCityCoords = (city) => {
  const center = getCityCenter(city);
  return [center.lng, center.lat];
};

const IntercityDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const { fromCity, toCity, vehicle } = state;

  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [activeMapField, setActiveMapField] = useState('pickup');
  const [mapCenter, setMapCenter] = useState(INDIA_CENTER);
  const [pickedAddress, setPickedAddress] = useState('Move the map to choose a location');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const mapInstanceRef = useRef(null);
  const lastCenterRef = useRef(INDIA_CENTER);
  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  if (!fromCity || !vehicle) {
    navigate('/intercity');
    return null;
  }

  const handleContinue = () => {
    if (!pickup.trim() || !drop.trim()) {
      alert("Please enter both exact pickup and drop locations within the selected cities.");
      return;
    }
    navigate('/intercity/confirm', {
      state: {
        ...state,
        pickup,
        drop,
        pickupCoords: pickupCoords || getCityCoords(fromCity),
        dropCoords: dropCoords || getCityCoords(toCity),
      }
    });
  };

  const openMapPicker = (field) => {
    const savedCoords = field === 'pickup' ? pickupCoords : dropCoords;
    const savedAddress = field === 'pickup' ? pickup : drop;
    const cityCenter = getCityCenter(field === 'pickup' ? fromCity : toCity);
    const center = Array.isArray(savedCoords)
      ? { lat: savedCoords[1], lng: savedCoords[0] }
      : cityCenter;

    setActiveMapField(field);
    setMapCenter(center);
    lastCenterRef.current = center;
    setPickedAddress(savedAddress || `${field === 'pickup' ? fromCity : toCity} location`);
    setShowMapPicker(true);
  };

  const handleMapIdle = () => {
    if (!mapInstanceRef.current || !window.google?.maps?.Geocoder) return;

    const center = mapInstanceRef.current.getCenter();
    const lat = center.lat();
    const lng = center.lng();
    const diff = Math.abs(lat - lastCenterRef.current.lat) + Math.abs(lng - lastCenterRef.current.lng);

    if (diff < 0.00001) {
      setIsDragging(false);
      return;
    }

    lastCenterRef.current = { lat, lng };
    setIsDragging(false);
    setIsGeocoding(true);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results?.[0]) {
        setPickedAddress(results[0].formatted_address);
        return;
      }

      setPickedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const nextCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(nextCenter);
          mapInstanceRef.current.setZoom(17);
        } else {
          setMapCenter(nextCenter);
        }
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const handleConfirmMapLocation = () => {
    const selectedCoords = [lastCenterRef.current.lng, lastCenterRef.current.lat];

    if (activeMapField === 'pickup') {
      setPickup(pickedAddress);
      setPickupCoords(selectedCoords);
    } else {
      setDrop(pickedAddress);
      setDropCoords(selectedCoords);
    }

    setShowMapPicker(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] max-w-lg mx-auto font-sans pb-32">
      <AnimatePresence>
        {showMapPicker && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-white flex flex-col max-w-lg mx-auto"
          >
            <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-10 pb-4 bg-gradient-to-b from-white via-white/85 to-transparent">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMapPicker(false)}
                  className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-slate-100 active:scale-95 transition-all"
                >
                  <ArrowLeft size={20} className="text-slate-900" strokeWidth={2.5} />
                </button>
                <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                    {activeMapField === 'pickup' ? `Pickup in ${fromCity}` : `Drop in ${toCity}`}
                  </p>
                  <p className="text-[14px] font-bold text-slate-900 truncate leading-tight">
                    {isGeocoding ? 'Finding address...' : pickedAddress}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 relative bg-slate-200">
              {!HAS_VALID_GOOGLE_MAPS_KEY ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 px-6 text-center">
                  <div className="rounded-3xl bg-white px-8 py-10 shadow-xl border border-slate-100">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X size={32} className="text-rose-400" />
                    </div>
                    <p className="text-[16px] font-black text-slate-900">Google Maps key missing</p>
                    <p className="mt-2 text-[13px] font-bold text-slate-500">
                      Add a valid maps key to select locations on the map.
                    </p>
                  </div>
                </div>
              ) : loadError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 px-6 text-center">
                  <div className="rounded-3xl bg-white px-8 py-10 shadow-xl border border-slate-100">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={32} className="text-rose-400" />
                    </div>
                    <p className="text-[16px] font-black text-slate-900">Map load failed</p>
                    <p className="mt-2 text-[13px] font-bold text-slate-500">
                      Please check the map API key and network connection.
                    </p>
                  </div>
                </div>
              ) : isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={15}
                  onLoad={(map) => (mapInstanceRef.current = map)}
                  onIdle={handleMapIdle}
                  onDragStart={() => setIsDragging(true)}
                  options={{
                    disableDefaultUI: true,
                    clickableIcons: false,
                    gestureHandling: 'greedy',
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-50">
                  <LoaderCircle size={44} className="animate-spin text-slate-300" />
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Loading map</p>
                </div>
              )}

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[100%] pointer-events-none z-10">
                <motion.div
                  animate={isDragging || isGeocoding ? { y: -12 } : { y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-10 h-10 bg-[#1C2833] rounded-2xl flex items-center justify-center shadow-2xl rotate-45 border-2 border-white">
                    <div className="-rotate-45">
                      <MapIcon size={18} className="text-yellow-400" />
                    </div>
                  </div>
                  <div className="w-1 h-5 bg-[#1C2833] -mt-2 shadow-2xl" />
                </motion.div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-1 bg-black/30 rounded-full blur-sm" />
              </div>

              <button
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="absolute bottom-6 right-5 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100 active:scale-90 transition-all z-20 disabled:opacity-70"
              >
                {isLocating ? (
                  <LoaderCircle size={20} className="animate-spin text-slate-400" />
                ) : (
                  <Navigation size={20} className="text-[#1C2833]" />
                )}
              </button>
            </div>

            <div className="px-5 pt-4 pb-10 bg-white border-t border-slate-50 space-y-4">
              <div className="flex items-center gap-3 py-1 px-1">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <MapPin size={20} className="text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[15px] font-black text-slate-900 leading-none">Confirm Exact Spot</h4>
                  <p className="text-[12px] font-bold text-slate-400 mt-1 line-clamp-1">{pickedAddress}</p>
                </div>
              </div>
              <button
                onClick={handleConfirmMapLocation}
                disabled={isGeocoding}
                className="w-full bg-yellow-400 py-4 rounded-3xl text-[#1C2833] font-black text-[15px] shadow-xl shadow-yellow-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <Check size={18} strokeWidth={3} />
                Use This Location
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

       {/* Header */}
       <div className="bg-white px-5 pt-10 pb-6 sticky top-0 z-20 shadow-sm border-b border-gray-50 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 active:scale-90 transition-all">
          <ArrowLeft size={24} className="text-gray-900" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-[22px] font-black text-gray-900 leading-none tracking-tight">Exact Addresses</h1>
          <p className="text-[12px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{fromCity} to {toCity}</p>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
         
         <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-50 flex flex-col gap-6 relative">
            {/* Connecting line */}
            <div className="absolute left-[33px] top-[48px] bottom-[48px] w-0.5 bg-gray-100 border-l border-dashed border-gray-300" />
            
            {/* Pickup */}
            <div className="relative">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 pl-8">Pickup in {fromCity}</label>
                <div className="mt-1.5 flex items-center gap-3">
                   <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0 border border-green-200 z-10">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                   </div>
                   <input 
                      type="text" 
                      placeholder="e.g. 102 Apollo Tower, MG Road"
                      value={pickup}
                      onChange={e => {
                        setPickup(e.target.value);
                        setPickupCoords(null);
                      }}
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-bold text-gray-900 focus:outline-none focus:border-yellow-400 transition-colors"
                   />
                </div>
                <button
                  type="button"
                  onClick={() => openMapPicker('pickup')}
                  className="ml-9 mt-3 inline-flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-2 text-[12px] font-black text-green-700 active:scale-95 transition-all"
                >
                  <MapIcon size={15} strokeWidth={2.8} />
                  Select pickup on map
                </button>
            </div>

            {/* Drop */}
            <div className="relative">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 pl-8">Drop in {toCity}</label>
                <div className="mt-1.5 flex items-center gap-3">
                   <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center shrink-0 border border-red-200 z-10">
                      <MapPin size={12} className="text-red-500" strokeWidth={3} />
                   </div>
                   <input 
                      type="text" 
                      placeholder="e.g. Railway Station Main Gate, Platform 1"
                      value={drop}
                      onChange={e => {
                        setDrop(e.target.value);
                        setDropCoords(null);
                      }}
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-bold text-gray-900 focus:outline-none focus:border-yellow-400 transition-colors"
                   />
                </div>
                <button
                  type="button"
                  onClick={() => openMapPicker('drop')}
                  className="ml-9 mt-3 inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-[12px] font-black text-red-600 active:scale-95 transition-all"
                >
                  <MapIcon size={15} strokeWidth={2.8} />
                  Select drop on map
                </button>
            </div>

         </div>

         <div className="bg-[#1C2833] rounded-[24px] p-4 flex items-center gap-4 text-white shadow-md">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
               <Navigation size={20} className="text-yellow-400" />
            </div>
            <div>
               <p className="text-[13px] font-black leading-tight">Door-to-Door Service</p>
               <p className="text-[10px] font-bold text-white/50 mt-0.5">Your driver will pick you up and drop you exactly at these locations.</p>
            </div>
         </div>
      </div>

      {/* Book CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8F9FB] via-[#F8F9FB]/95 to-transparent z-30">
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleContinue}
            className="w-full bg-yellow-400 text-[#1C2833] py-4 rounded-2xl text-[16px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
        >
          Confirm Details <ChevronRight size={18} strokeWidth={3} />
        </motion.button>
      </div>

    </div>
  );
};

export default IntercityDetails;
