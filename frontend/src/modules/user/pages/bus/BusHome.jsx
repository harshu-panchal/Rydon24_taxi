import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BusFront,
  ArrowRightLeft,
  Loader2,
  Route,
  MapPin,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import { useSettings } from '../../../../shared/context/SettingsContext';
import userBusService from '../../services/busService';
import BottomNavbar from '../../components/BottomNavbar';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

const getDateOffset = (offset = 1) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

const getTomorrowDate = () => getDateOffset(1);

const getMonthStart = (value) => new Date(value.getFullYear(), value.getMonth(), 1);

const addMonths = (value, amount) => new Date(value.getFullYear(), value.getMonth() + amount, 1);

const formatDateKey = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCalendarDays = (monthDate) => {
  const start = getMonthStart(monthDate);
  const startOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(gridStart);
    value.setDate(gridStart.getDate() + index);
    return value;
  });
};

const formatTravelDate = (value) => {
  if (!value) return '';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const normalizeCity = (value = '') => value.trim().toLowerCase();

const BusHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const busEnabled = String(settings.transportRide?.enable_bus_service || '0') === '1';

  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [date, setDate] = useState(getTomorrowDate());
  const [error, setError] = useState('');
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(new Date(getTomorrowDate())));

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
      if (route.fromCity) cities.add(route.fromCity.trim());
      if (route.toCity) cities.add(route.toCity.trim());
    });

    return Array.from(cities).sort((left, right) => left.localeCompare(right));
  }, [routeSuggestions]);

  const matchingRoute = useMemo(
    () =>
      routeSuggestions.find(
        (route) =>
          normalizeCity(route.fromCity) === normalizeCity(fromCity) &&
          normalizeCity(route.toCity) === normalizeCity(toCity),
      ) || null,
    [fromCity, routeSuggestions, toCity],
  );

  const hasTypedInvalidRoute =
    fromCity.trim() &&
    toCity.trim() &&
    normalizeCity(fromCity) !== normalizeCity(toCity) &&
    routeSuggestions.length > 0 &&
    !matchingRoute;

  const quickDates = useMemo(
    () => [
      { label: 'Tomorrow', value: getDateOffset(1) },
      { label: 'Day After', value: getDateOffset(2) },
      { label: 'This Weekend', value: getDateOffset(4) },
    ],
    [],
  );

  const filteredFromCities = useMemo(() => {
    const source = normalizeCity(fromCity);
    const destinations = new Set(
      routeSuggestions
        .filter((route) => (!toCity ? true : normalizeCity(route.toCity) === normalizeCity(toCity)))
        .map((route) => route.fromCity)
        .filter(Boolean),
    );

    return Array.from(destinations)
      .filter((city) => (!source ? true : normalizeCity(city).includes(source)))
      .slice(0, 6);
  }, [fromCity, routeSuggestions, toCity]);

  const filteredToCities = useMemo(() => {
    const destination = normalizeCity(toCity);
    const origins = new Set(
      routeSuggestions
        .filter((route) => (!fromCity ? true : normalizeCity(route.fromCity) === normalizeCity(fromCity)))
        .map((route) => route.toCity)
        .filter(Boolean),
    );

    return Array.from(origins)
      .filter((city) => (!destination ? true : normalizeCity(city).includes(destination)))
      .slice(0, 6);
  }, [fromCity, routeSuggestions, toCity]);

  const featuredRoutes = useMemo(() => routeSuggestions.slice(0, 6), [routeSuggestions]);
  const minimumDate = useMemo(() => new Date(getTomorrowDate()), []);
  const selectedDateValue = useMemo(() => (date ? new Date(`${date}T00:00:00`) : null), [date]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const monthLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
    [calendarMonth],
  );

  const handleSearch = () => {
    const source = fromCity.trim();
    const destination = toCity.trim();

    if (!busEnabled) {
      setError('Bus service is disabled right now.');
      return;
    }

    if (!source || !destination) {
      setError('Choose both source and destination first.');
      return;
    }

    if (normalizeCity(source) === normalizeCity(destination)) {
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
      setError('This route is not active yet. Pick one from the available routes below.');
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

  const fillRoute = (route) => {
    setFromCity(route.fromCity || '');
    setToCity(route.toCity || '');
    setError('');
  };

  const swapCities = () => {
    setFromCity(toCity);
    setToCity(fromCity);
    setError('');
  };

  const openCalendar = () => {
    const activeDate = selectedDateValue && !Number.isNaN(selectedDateValue.getTime()) ? selectedDateValue : minimumDate;
    setCalendarMonth(getMonthStart(activeDate));
    setCalendarOpen(true);
  };

  const selectCalendarDate = (value) => {
    const nextValue = formatDateKey(value);
    if (nextValue < getTomorrowDate()) {
      return;
    }

    setDate(nextValue);
    setCalendarOpen(false);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff5f5_0%,#fff7ed_28%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-32 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,#ef444422,transparent_68%)] pointer-events-none" />
      <div className="absolute -top-20 right-[-38px] h-48 w-48 rounded-full bg-orange-200/25 blur-3xl pointer-events-none" />
      <div className="absolute top-64 left-[-54px] h-44 w-44 rounded-full bg-rose-200/25 blur-3xl pointer-events-none" />

      <header className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-[#dc2626]">Bus Tickets</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-none">Book your next route</h1>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 space-y-4">
        <div className="rounded-[28px] bg-gradient-to-br from-[#7f1d1d] via-[#dc2626] to-[#fb923c] p-5 text-white shadow-[0_12px_28px_rgba(127,29,29,0.25)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100">Inspired by modern bus booking</p>
              <h2 className="mt-1 text-[24px] font-black leading-tight">Search buses in 3 taps.</h2>
              <p className="mt-2 text-[12px] font-semibold text-rose-50/90">
                Pick from active routes already configured in admin, then jump straight to seats and payment.
              </p>
            </div>
            <div className="w-14 h-14 rounded-[18px] bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Ticket size={26} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[16px] bg-white/12 border border-white/15 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">Routes</p>
              <p className="mt-1 text-[16px] font-black">{routeSuggestions.length || 0}</p>
            </div>
            <div className="rounded-[16px] bg-white/12 border border-white/15 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">Cities</p>
              <p className="mt-1 text-[16px] font-black">{cityOptions.length || 0}</p>
            </div>
            <div className="rounded-[16px] bg-white/12 border border-white/15 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">Date</p>
              <p className="mt-1 text-[13px] font-black">{formatTravelDate(date) || 'Choose'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/92 rounded-[28px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-white/80 space-y-4 relative">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-[14px] bg-red-50 text-red-500 flex items-center justify-center">
              <Search size={18} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Search Buses</p>
              <h3 className="text-[17px] font-black text-slate-900">From, to, date. That’s it.</h3>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-100 bg-slate-50/90 p-4 space-y-3">
            <div className="rounded-[20px] border border-white bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                <MapPin size={12} className="text-red-400" /> From
              </div>
              <input
                type="text"
                list="bus-route-cities"
                value={fromCity}
                onChange={(event) => setFromCity(event.target.value)}
                placeholder="Enter source city"
                className="mt-1 w-full bg-transparent text-[18px] font-black text-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Start typing or tap one of the live cities below.</p>
            </div>

            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={swapCities}
                className="w-11 h-11 rounded-full bg-white border border-orange-100 text-orange-600 flex items-center justify-center shadow-sm active:scale-95"
              >
                <ArrowRightLeft size={18} />
              </button>
            </div>

            <div className="rounded-[20px] border border-white bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                <MapPin size={12} className="text-emerald-500" /> To
              </div>
              <input
                type="text"
                list="bus-route-cities"
                value={toCity}
                onChange={(event) => setToCity(event.target.value)}
                placeholder="Enter destination city"
                className="mt-1 w-full bg-transparent text-[18px] font-black text-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-500">We only show routes that already exist in the system.</p>
            </div>

            <div className="rounded-[20px] border border-white bg-white px-4 py-3 shadow-sm">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                <Calendar size={12} className="text-orange-500" /> Date of Journey
              </label>
              <button
                type="button"
                onClick={openCalendar}
                className="mt-1 flex w-full items-center justify-between gap-3 bg-transparent text-left text-[17px] font-black text-slate-900"
              >
                <span>{formatTravelDate(date) || 'Choose date'}</span>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                  Open calendar
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Quick dates</p>
              <p className="text-[11px] font-bold text-slate-400">Future dates only</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickDates.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDate(item.value)}
                  className={`rounded-full border px-3 py-2 text-[11px] font-black transition-all ${
                    date === item.value
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <datalist id="bus-route-cities">
            {cityOptions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-[22px] border border-slate-100 bg-[#fff7ed] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Choose source city</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredFromCities.map((city) => (
                  <button
                    key={`from-${city}`}
                    type="button"
                    onClick={() => {
                      setFromCity(city);
                      setError('');
                    }}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black transition-all ${
                      normalizeCity(fromCity) === normalizeCity(city)
                        ? 'border-orange-200 bg-orange-100 text-orange-700'
                        : 'border-orange-100 bg-white text-slate-600'
                    }`}
                  >
                    {city}
                  </button>
                ))}
                {!filteredFromCities.length ? (
                  <p className="text-[12px] font-semibold text-slate-500">No matching source cities yet.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-100 bg-[#f0fdf4] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Choose destination city</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredToCities.map((city) => (
                  <button
                    key={`to-${city}`}
                    type="button"
                    onClick={() => {
                      setToCity(city);
                      setError('');
                    }}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black transition-all ${
                      normalizeCity(toCity) === normalizeCity(city)
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-emerald-100 bg-white text-slate-600'
                    }`}
                  >
                    {city}
                  </button>
                ))}
                {!filteredToCities.length ? (
                  <p className="text-[12px] font-semibold text-slate-500">Pick a source city to narrow destinations.</p>
                ) : null}
              </div>
            </div>
          </div>

          {matchingRoute ? (
            <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] font-bold text-emerald-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Route size={14} className="shrink-0" />
                <span className="truncate">
                  Route available: {matchingRoute.fromCity} to {matchingRoute.toCity}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                from Rs {Number(matchingRoute.startingPrice || 0)}
              </span>
            </div>
          ) : null}

          {hasTypedInvalidRoute ? (
            <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
              This route is not active right now. Use one of the live route suggestions below.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
              {error}
            </div>
          ) : null}

          {!busEnabled ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold text-amber-700">
              Bus service is currently disabled from admin transport settings.
            </div>
          ) : null}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSearch}
            className="w-full bg-[#111827] text-white py-4 rounded-[20px] text-[15px] font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(17,24,39,0.18)] active:scale-95 transition-all"
          >
            Search Buses <ChevronRight size={18} strokeWidth={3} className="opacity-80" />
          </motion.button>
        </div>

        <div className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Popular right now</p>
              <h3 className="mt-1 text-[18px] font-black text-slate-900">Available routes from your system</h3>
            </div>
            {routesLoading ? <Loader2 size={18} className="animate-spin text-orange-500 shrink-0" /> : null}
          </div>

          <div className="mt-4 space-y-3">
            {featuredRoutes.map((route) => (
              <button
                key={`${route.fromCity}-${route.toCity}`}
                type="button"
                onClick={() => fillRoute(route)}
                className="w-full rounded-[22px] border border-slate-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff7ed_100%)] px-4 py-4 text-left shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Live Route</p>
                    <h4 className="mt-1 text-[17px] font-black text-slate-900 truncate">
                      {route.fromCity} <span className="text-orange-500">to</span> {route.toCity}
                    </h4>
                    <p className="mt-1 text-[12px] font-semibold text-slate-500 truncate">
                      {route.operatorName || 'Available bus operator'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Starts from</p>
                    <p className="mt-1 text-[18px] font-black text-slate-900">Rs {Number(route.startingPrice || 0)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {!routesLoading && !featuredRoutes.length && !routesError ? (
            <p className="mt-4 text-[12px] font-bold text-slate-500">No active bus routes are available yet.</p>
          ) : null}

          {routesError ? (
            <p className="mt-4 text-[12px] font-bold text-rose-600">{routesError}</p>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSearch}
          className="w-full bg-[#111827] text-white py-4 rounded-[18px] text-[15px] font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2 shadow-[0_10px_26px_rgba(17,24,39,0.22)] active:scale-95 transition-all"
        >
          Search Buses <ChevronRight size={18} strokeWidth={3} className="opacity-80" />
        </motion.button>
      </div>

      {calendarOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] px-4 py-6 flex items-end justify-center">
          <div className="w-full max-w-lg rounded-[30px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pick journey date</p>
                <h3 className="mt-1 text-[20px] font-black text-slate-900">{monthLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="rounded-full bg-red-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
                {formatTravelDate(date)}
              </div>
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const key = formatDateKey(day);
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isDisabled = key < getTomorrowDate();
                const isSelected = key === date;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectCalendarDate(day)}
                    className={`aspect-square rounded-[18px] text-center text-[13px] font-black transition-all ${
                      isSelected
                        ? 'bg-red-500 text-white shadow-[0_10px_20px_rgba(239,68,68,0.28)]'
                        : isDisabled
                          ? 'bg-slate-50 text-slate-300'
                          : isCurrentMonth
                            ? 'bg-white text-slate-800 border border-slate-100 hover:border-orange-200 hover:text-orange-600'
                            : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-[20px] bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected</p>
                <p className="mt-1 text-[14px] font-black text-slate-900">{formatTravelDate(date)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDate(getTomorrowDate());
                  setCalendarMonth(getMonthStart(new Date(getTomorrowDate())));
                  setCalendarOpen(false);
                  setError('');
                }}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 border border-slate-200"
              >
                Tomorrow
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNavbar />
    </div>
  );
};

export default BusHome;
