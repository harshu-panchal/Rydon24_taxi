import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, LoaderCircle, Users } from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';

const getVehicleTypes = (response) => {
  const payload = response?.data?.data || response?.data || response;
  return payload?.vehicle_types || payload?.results || (Array.isArray(payload) ? payload : []);
};

const getIconValue = (type = {}) => String(type.icon_types || type.vehicleIconType || type.name || '').toLowerCase();
const getTypeLabel = (type = {}) => type.name || type.vehicle_type || type.label || 'Vehicle';

const getVehicleIcon = (type = {}) => {
  const customIcon = String(type.map_icon || type.icon || type.image || '').trim();
  if (customIcon) return customIcon;

  const iconValue = getIconValue(type);

  if (iconValue.includes('bike')) return '/1_Bike.png';
  if (iconValue.includes('auto')) return '/2_AutoRickshaw.png';
  return '/4_Taxi.png';
};

const getVehicleSeats = (type = {}) => {
  if (Number.isFinite(Number(type.capacity)) && Number(type.capacity) > 0) {
    return Number(type.capacity);
  }

  const iconValue = getIconValue(type);
  if (iconValue.includes('bike')) return 1;
  if (iconValue.includes('auto')) return 3;
  if (iconValue.includes('suv')) return 6;
  return 4;
};

const getBaseFare = (type = {}) => {
  const iconValue = getIconValue(type);
  const name = getTypeLabel(type).toLowerCase();

  if (iconValue.includes('bike') || name.includes('bike')) return 220;
  if (iconValue.includes('auto') || name.includes('auto')) return 420;
  if (iconValue.includes('suv') || name.includes('suv')) return 999;
  if (iconValue.includes('premium') || name.includes('premium') || name.includes('lux')) return 1199;
  return 699;
};

const getPricePerKm = (type = {}) => {
  const iconValue = getIconValue(type);
  const name = getTypeLabel(type).toLowerCase();

  if (iconValue.includes('bike') || name.includes('bike')) return 8;
  if (iconValue.includes('auto') || name.includes('auto')) return 11;
  if (iconValue.includes('suv') || name.includes('suv')) return 18;
  if (iconValue.includes('premium') || name.includes('premium') || name.includes('lux')) return 22;
  return 14;
};

const normalizeVehicleType = (type, index) => {
  const id = String(type?._id || type?.id || type?.name || index);
  const seats = getVehicleSeats(type);

  return {
    id,
    vehicleTypeId: type?._id || type?.id || '',
    name: getTypeLabel(type),
    desc: type?.short_description || type?.description || 'Available for your trip',
    seats,
    icon: getVehicleIcon(type),
    vehicleIconUrl: getVehicleIcon(type),
    baseFare: getBaseFare(type),
    pricePerKm: getPricePerKm(type),
    raw: type,
  };
};

const IntercityVehicle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { fromCity, toCity, tripType, date, distance = 0 } = location.state || {};

  const [passengers, setPassengers] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicleLoadError, setVehicleLoadError] = useState('');

  if (!fromCity || !toCity) {
    navigate('/intercity');
    return null;
  }

  useEffect(() => {
    let active = true;

    const loadVehicles = async () => {
      setIsLoadingVehicles(true);
      setVehicleLoadError('');

      try {
        const response = await api.get('/users/vehicle-types');
        if (!active) {
          return;
        }

        const nextVehicles = getVehicleTypes(response)
          .filter((type) => type.active !== false && Number(type.status ?? 1) !== 0)
          .filter((type) => String(type.transport_type || 'taxi').toLowerCase() === 'taxi')
          .map(normalizeVehicleType);

        setVehicles(nextVehicles);
        setSelectedVehicleId((current) => current || nextVehicles[0]?.id || '');
      } catch (error) {
        if (active) {
          setVehicleLoadError(error.message || 'Could not load available vehicle types.');
          setVehicles([]);
        }
      } finally {
        if (active) {
          setIsLoadingVehicles(false);
        }
      }
    };

    loadVehicles();

    return () => {
      active = false;
    };
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0] || null,
    [selectedVehicleId, vehicles],
  );

  const safeDistance = Number(distance || 0);
  const estimatedFare = selectedVehicle ? Math.round(selectedVehicle.baseFare + (selectedVehicle.pricePerKm * safeDistance)) : 0;
  const roundTripFare = Math.round(estimatedFare * 1.8);
  const finalFare = tripType === 'Round Trip' ? roundTripFare : estimatedFare;

  useEffect(() => {
    if (!selectedVehicle) {
      return;
    }

    setPassengers((current) => Math.min(Math.max(current, 1), selectedVehicle.seats));
  }, [selectedVehicle]);

  const handleContinue = () => {
    if (!selectedVehicle) {
      return;
    }

    navigate('/intercity/details', {
      state: {
        fromCity,
        toCity,
        tripType,
        date,
        distance: safeDistance,
        vehicle: selectedVehicle,
        passengers,
        fare: finalFare,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] max-w-lg mx-auto font-sans pb-32">
      <div className="bg-white px-5 pt-10 pb-6 sticky top-0 z-20 shadow-sm border-b border-gray-50 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 active:scale-90 transition-all">
          <ArrowLeft size={24} className="text-gray-900" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-[22px] font-black text-gray-900 leading-none tracking-tight">Vehicle & Passengers</h1>
          <p className="text-[12px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{fromCity} to {toCity}</p>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
        <div className="bg-white rounded-[24px] p-5 border border-gray-50 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
              <Users size={18} className="text-gray-500" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[14px] font-black text-gray-900 leading-tight">Total Passengers</p>
              <p className="text-[11px] font-bold text-gray-400">
                Max {selectedVehicle?.seats || 1} for {selectedVehicle?.name || 'selected vehicle'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-full p-1 border border-gray-100">
            <button
              onClick={() => setPassengers((current) => Math.max(1, current - 1))}
              className="w-8 h-8 bg-white rounded-full text-gray-600 font-black flex items-center justify-center active:scale-90 transition-all shadow-sm"
            >
              -
            </button>
            <span className="text-[16px] font-black text-gray-900 w-5 text-center">{passengers}</span>
            <button
              onClick={() => setPassengers((current) => Math.min(selectedVehicle?.seats || 1, current + 1))}
              className="w-8 h-8 bg-white rounded-full text-gray-600 font-black flex items-center justify-center active:scale-90 transition-all shadow-sm"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-[16px] font-black text-gray-900 ml-1">Available Vehicles</h3>

          {isLoadingVehicles ? (
            <div className="rounded-[22px] border border-gray-100 bg-white px-4 py-8 shadow-sm flex items-center justify-center gap-3">
              <LoaderCircle size={18} className="animate-spin text-gray-400" />
              <span className="text-[12px] font-black text-gray-500 uppercase tracking-wider">Loading vehicles</span>
            </div>
          ) : vehicleLoadError ? (
            <div className="rounded-[22px] border border-red-100 bg-white px-4 py-5 shadow-sm">
              <p className="text-[13px] font-black text-gray-900">Could not load vehicles</p>
              <p className="mt-1 text-[11px] font-bold text-red-400">{vehicleLoadError}</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-[22px] border border-gray-100 bg-white px-4 py-5 shadow-sm">
              <p className="text-[13px] font-black text-gray-900">No vehicle types available</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">Add active taxi vehicle types in the admin catalog to show them here.</p>
            </div>
          ) : (
            vehicles.map((vehicle) => {
              const vehicleFare = tripType === 'Round Trip'
                ? Math.round((vehicle.baseFare + vehicle.pricePerKm * safeDistance) * 1.8)
                : Math.round(vehicle.baseFare + vehicle.pricePerKm * safeDistance);

              return (
                <motion.button
                  key={vehicle.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedVehicleId(vehicle.id);
                    if (passengers > vehicle.seats) {
                      setPassengers(vehicle.seats);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedVehicleId === vehicle.id
                      ? 'border-yellow-400 bg-yellow-50/30 shadow-md shadow-yellow-100/30'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="w-16 h-14 rounded-[16px] bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                    <img src={vehicle.icon} alt={vehicle.name} className="h-full w-full object-contain" draggable={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-black text-gray-900 leading-none">{vehicle.name}</h4>
                    <p className="text-[12px] font-bold text-gray-400 mt-1 truncate">{vehicle.desc}</p>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mt-1">{vehicle.seats} seats</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[16px] font-black ${selectedVehicleId === vehicle.id ? 'text-yellow-600' : 'text-gray-900'}`}>
                      Rs {vehicleFare.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{tripType}</p>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8F9FB] via-[#F8F9FB]/95 to-transparent z-30">
        <div className="bg-[#1C2833] rounded-[32px] p-6 text-white space-y-4 shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Estimated Fare</p>
              <p className="text-[28px] font-black tracking-tight mt-1 text-yellow-400">Rs {finalFare.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Base Distance</p>
              <p className="text-[15px] font-black">{safeDistance} km</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleContinue}
            disabled={!selectedVehicle}
            className="w-full bg-yellow-400 text-[#1C2833] py-4 rounded-2xl text-[16px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-60"
          >
            Enter Exact Details <ChevronRight size={18} strokeWidth={3} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default IntercityVehicle;
