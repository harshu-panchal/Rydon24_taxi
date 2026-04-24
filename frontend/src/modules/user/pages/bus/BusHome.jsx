import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, ChevronRight, BusFront, ArrowRightLeft, Loader2, Route } from 'lucide-react';
import { useSettings } from '../../../../shared/context/SettingsContext';
import userBusService from '../../services/busService';
import BottomNavbar from '../../components/BottomNavbar';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');
const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
};

const BusHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const busEnabled = String(settings.transportRide?.enable_bus_service || '0') === '1';
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState('');

  useEffect(() => {
    if (!busEnabled) {
      setRouteSuggestions([]);
      return;
    }

    let active = true;

    const loadRoutes = async () => {
      setRoutesLoading(true);
      setRoutesError('');
      try {
        const response = await userBusService.getRoutes();
        if (!active) return;
        setRouteSuggestions(Array.isArray(response?.data?.results) ? response.data.results : []);
      } catch (err) {
        if (!active) return;
        setRoutesError(err?.message || 'Failed to load route suggestions');
      } finally {
        if (active) {
          setRoutesLoading(false);
        }
      }
    };

    loadRoutes();

    return () => {
      active = false;
    };
  }, [busEnabled]);

  const cityOptions = useMemo(() => {
    const cities = new Set();
    routeSuggestions.forEach((route) => {
      if (route.fromCity) cities.add(route.fromCity);
      if (route.toCity) cities.add(route.toCity);
    });
    return Array.from(cities);
  }, [routeSuggestions]);

  const matchingRoute = useMemo(
    () =>
      routeSuggestions.find(
        (route) =>
          route.fromCity?.trim().toLowerCase() === fromCity.trim().toLowerCase() &&
          route.toCity?.trim().toLowerCase() === toCity.trim().toLowerCase(),
      ) || null,
    [fromCity, routeSuggestions, toCity],
  );

  const hasTypedInvalidRoute =
    fromCity.trim() &&
    toCity.trim() &&
    fromCity.trim().toLowerCase() !== toCity.trim().toLowerCase() &&
    routeSuggestions.length > 0 &&
    !matchingRoute;

  const swapCities = () => {
    setFromCity(toCity);
    setToCity(fromCity);
  };

  const handleSearch = () => {
    const source = fromCity.trim();
    const destination = toCity.trim();

    if (!busEnabled) {
      setError('Bus service is disabled right now.');
      return;
    }

    if (!source || !destination) {
      setError('Enter both route cities first.');
      return;
    }

    if (source.toLowerCase() === destination.toLowerCase()) {
      setError('From and destination cannot be the same.');
      return;
    }

    if (!date) {
      setError('Select a travel date.');
      return;
    }

    if (date < getTomorrowDate()) {
      setError('Please select a future travel date.');
      return;
    }

    if (!matchingRoute) {
      setError('Bus not available for this route right now.');
      return;
    }

    setError('');
    navigate(`${routePrefix}/bus/list`, {
      state: {
        fromCity: source,
        toCity: destination,
        date,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_30%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-32 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-200/30 blur-3xl pointer-events-none" />
      <div className="absolute top-48 left-[-50px] h-40 w-40 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />

      <header className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Intercity Travel</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-none">Bus Booking</h1>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 space-y-4">
        <div className="rounded-[24px] bg-gradient-to-br from-[#7c2d12] via-[#c2410c] to-[#f97316] p-5 text-white shadow-[0_12px_28px_rgba(124,45,18,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-100">RedBus-style flow</p>
              <h2 className="mt-1 text-[22px] font-black leading-tight">Search routes, pick seats, pay with Razorpay.</h2>
              <p className="mt-2 text-[12px] font-semibold text-orange-50/90">
                We will show live buses configured by the admin panel for your selected journey.
              </p>
            </div>
            <div className="w-14 h-14 rounded-[18px] bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <BusFront size={28} />
            </div>
          </div>
        </div>

        <div className="bg-white/90 rounded-[24px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-white/80 space-y-4 relative">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Leaving From</label>
            <input
              type="text"
              list="bus-route-cities"
              value={fromCity}
              onChange={(event) => setFromCity(event.target.value)}
              placeholder="Indore"
              className="w-full bg-slate-50 border border-slate-100 rounded-[16px] px-4 py-3.5 text-[15px] font-bold text-slate-900 focus:outline-none focus:border-orange-300 shadow-sm"
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={swapCities}
              className="w-11 h-11 rounded-full bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-sm active:scale-95"
            >
              <ArrowRightLeft size={18} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Going To</label>
            <input
              type="text"
              list="bus-route-cities"
              value={toCity}
              onChange={(event) => setToCity(event.target.value)}
              placeholder="Pune"
              className="w-full bg-slate-50 border border-slate-100 rounded-[16px] px-4 py-3.5 text-[15px] font-bold text-slate-900 focus:outline-none focus:border-orange-300 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em] flex items-center gap-1.5 ml-1">
              <Calendar size={12} strokeWidth={2.5} className="text-slate-400" /> Date of Journey
            </label>
            <input
              type="date"
              value={date}
              min={getTomorrowDate()}
              onChange={(event) => setDate(event.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-[16px] px-4 py-3.5 text-[15px] font-bold text-slate-900 focus:outline-none focus:border-orange-300 shadow-sm"
            />
            <p className="text-[10px] font-bold text-slate-400 ml-1">Only future journey dates are allowed.</p>
          </div>

          <datalist id="bus-route-cities">
            {cityOptions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Suggested Routes</p>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  These route pairs come directly from the active buses created in admin.
                </p>
              </div>
              {routesLoading ? <Loader2 size={16} className="animate-spin text-orange-500 shrink-0" /> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {routeSuggestions.slice(0, 8).map((route) => (
                <button
                  key={`${route.fromCity}-${route.toCity}`}
                  type="button"
                  onClick={() => {
                    setFromCity(route.fromCity || '');
                    setToCity(route.toCity || '');
                    setError('');
                  }}
                  className={`rounded-full border px-3 py-2 text-[11px] font-black transition-all ${
                    matchingRoute?.fromCity === route.fromCity && matchingRoute?.toCity === route.toCity
                      ? 'border-orange-200 bg-orange-100 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600'
                  }`}
                >
                  {route.fromCity} to {route.toCity}
                </button>
              ))}
            </div>

            {!routesLoading && !routeSuggestions.length && !routesError ? (
              <p className="mt-4 text-[12px] font-bold text-slate-500">No active bus routes are available yet.</p>
            ) : null}

            {routesError ? (
              <p className="mt-4 text-[12px] font-bold text-rose-600">{routesError}</p>
            ) : null}
          </div>

          {matchingRoute ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] font-bold text-emerald-700 flex items-center gap-2">
              <Route size={14} />
              Route available: {matchingRoute.fromCity} to {matchingRoute.toCity}
              {matchingRoute.startingPrice ? ` • from ₹${matchingRoute.startingPrice}` : ''}
            </div>
          ) : null}

          {hasTypedInvalidRoute ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
              Bus not available for this route right now. Pick one of the suggested routes above.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
              {error}
            </div>
          ) : null}

          {!busEnabled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold text-amber-700">
              Bus service is currently disabled from admin transport settings.
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSearch}
          className="w-full bg-slate-900 text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(2,6,23,0.22)] active:scale-95 transition-all"
        >
          Search Buses <ChevronRight size={18} strokeWidth={3} className="opacity-80" />
        </motion.button>
      </div>

      <BottomNavbar />
    </div>
  );
};

export default BusHome;
