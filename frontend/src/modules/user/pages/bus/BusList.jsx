import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, BusFront, Clock3, Armchair, Loader2 } from 'lucide-react';
import userBusService from '../../services/busService';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

const formatTravelDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch (err) {
    return dateStr;
  }
};

const stopBadgeTone = {
  pickup: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  drop: 'border-rose-200 bg-rose-50 text-rose-700',
  both: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

const BusList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const state = location.state || {};
  const { fromCity, toCity, date } = state;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buses, setBuses] = useState([]);

  useEffect(() => {
    if (!fromCity || !toCity || !date) {
      navigate(`${routePrefix}/bus`, { replace: true });
      return;
    }

    let active = true;

    const loadResults = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await userBusService.searchBuses({ fromCity, toCity, date });
        if (!active) return;
        setBuses(Array.isArray(response?.data?.results) ? response.data.results : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to search buses');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadResults();

    return () => {
      active = false;
    };
  }, [date, fromCity, navigate, routePrefix, toCity]);

  const handleSelect = (bus) => {
    navigate(`${routePrefix}/bus/seats`, {
      state: {
        ...state,
        bus,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto font-sans pb-10">
      <div className="bg-white px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{fromCity} to {toCity}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{formatTravelDate(date)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-4 text-slate-500">
            <Loader2 size={32} className="animate-spin text-slate-400" />
            <p className="text-sm font-bold text-slate-400">Finding available buses...</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && buses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
            <h2 className="text-xl font-bold text-slate-900">No buses found</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Try searching for a different date or route.</p>
          </div>
        ) : null}

        {!loading && !error
          ? buses.map((bus, index) => (
              (() => {
                const routeStops = Array.isArray(bus.route?.stops) ? bus.route.stops : [];
                const visibleStops = routeStops.slice(0, 4);
                return (
              <motion.button
                key={bus.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelect(bus)}
                className="w-full text-left bg-white rounded-3xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-start gap-3 mb-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundColor: bus.busColor || '#0f172a' }}
                      >
                        <BusFront size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">{bus.operator}</h3>
                        <p className="text-xs font-medium text-slate-500 truncate">{bus.busName || bus.type}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 uppercase">
                        {bus.type}
                      </span>
                      {bus.amenities?.slice(0, 2).map((amenity) => (
                        <span
                          key={amenity}
                          className="rounded-full bg-slate-50 border border-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starts at</p>
                    <p className="text-2xl font-bold text-slate-900 leading-none">₹{Number(bus.price || 0)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 py-4 border-y border-slate-50">
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-900 leading-none">{bus.departure}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">{fromCity}</p>
                  </div>
                  <div className="flex flex-col items-center px-4">
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                      <Clock3 size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500">{bus.duration || 'Direct'}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-lg font-bold text-slate-900 leading-none">{bus.arrival}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">{toCity}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                    <Armchair size={14} />
                    <span>{bus.availableSeats} seats left</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                    Select Seats <ChevronRight size={16} />
                  </div>
                </div>

                {routeStops.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Stops</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {routeStops.length} total
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {visibleStops.map((stop, stopIndex) => (
                        <div key={stop.id || `${bus.id}-stop-${stopIndex}`} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {stop.city || stop.pointName || 'Stop'}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                              {stop.pointName || 'Point not set'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${stopBadgeTone[stop.stopType] || stopBadgeTone.both}`}>
                              {stop.stopType === 'both' ? 'BP + DP' : stop.stopType === 'drop' ? 'DP' : 'BP'}
                            </span>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                              {stop.arrivalTime || stop.departureTime || '--:--'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {routeStops.length > visibleStops.length ? (
                      <p className="mt-2 text-[11px] font-bold text-slate-400">
                        +{routeStops.length - visibleStops.length} more stops
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </motion.button>
                );
              })()
            ))
          : null}
      </div>
    </div>
  );
};

export default BusList;
