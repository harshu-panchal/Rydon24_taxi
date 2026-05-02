import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Star,
  BusFront,
  Sparkles,
  TicketPercent,
  SlidersHorizontal,
  BadgePercent,
} from 'lucide-react';
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
  } catch {
    return dateStr;
  }
};

const formatDurationBrief = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return 'Direct';
  return raw
    .replace(/days?/gi, 'd')
    .replace(/hours?/gi, 'h')
    .replace(/hrs?/gi, 'h')
    .replace(/minutes?/gi, 'm')
    .replace(/mins?/gi, 'm')
    .replace(/\s+/g, ' ')
    .trim();
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
        if (active) setLoading(false);
      }
    };

    loadResults();
    return () => {
      active = false;
    };
  }, [date, fromCity, navigate, routePrefix, toCity]);

  const handleSelect = (bus) => {
    navigate(`${routePrefix}/bus/details`, {
      state: {
        ...state,
        bus,
      },
    });
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-[linear-gradient(180deg,#fff7ed_0%,#fffaf7_16%,#f8fafc_100%)] font-sans pb-10">
      <div className="sticky top-0 z-20 border-b border-orange-100/70 bg-white/92 px-4 pb-4 pt-10 shadow-[0_6px_20px_rgba(15,23,42,0.05)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black text-slate-900">{fromCity} <span className="text-slate-300">→</span> {toCity}</h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{buses.length || 0} buses</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">{formatTravelDate(date)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-5">
        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-slate-500 shadow-sm">
            <Loader2 size={32} className="mx-auto animate-spin text-slate-400" />
            <p className="mt-4 text-center text-sm font-bold text-slate-400">Finding available buses...</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && buses.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">No buses found</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Try searching for a different date or route.</p>
          </div>
        ) : null}

        {!loading && !error && buses.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_100%)] p-4 text-white shadow-[0_10px_24px_rgba(249,115,22,0.18)]">
                <div className="flex items-center justify-between">
                  <BusFront size={22} />
                  <Sparkles size={16} className="text-white/80" />
                </div>
                <p className="mt-6 text-lg font-black leading-none">Bus</p>
                <p className="mt-1 text-xs font-semibold text-white/80">Best routes today</p>
              </div>
              <div className="rounded-[22px] border border-rose-100 bg-[radial-gradient(circle_at_top_left,#ffe4e6_0%,#fff1f2_45%,#ffffff_100%)] p-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
                  <TicketPercent size={16} />
                </div>
                <p className="mt-4 text-sm font-black leading-tight text-slate-900">Free Cancellation</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">On selected buses</p>
              </div>
              <div className="rounded-[22px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,#dcfce7_0%,#f0fdf4_45%,#ffffff_100%)] p-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <BadgePercent size={16} />
                </div>
                <p className="mt-4 text-sm font-black leading-tight text-slate-900">Special Deals</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Save more today</p>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm"
              >
                <SlidersHorizontal size={14} />
                Filter & Sort
              </button>
              <span className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">
                Deals
              </span>
              <span className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">
                Highly Rated
              </span>
            </div>
          </>
        ) : null}

        {!loading && !error
          ? buses.map((bus, index) => {
              const hasRating = Number(bus.ratingCount || 0) > 0;
              const topAmenities = Array.isArray(bus.amenities) ? bus.amenities.slice(0, 2) : [];

              return (
                <motion.button
                  key={bus.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(bus)}
                  className="w-full rounded-[24px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-end gap-2">
                            <p className="text-2xl font-black leading-none text-slate-900">{bus.departure}</p>
                            <p className="pb-0.5 text-sm font-bold text-slate-400">→</p>
                            <p className="text-2xl font-black leading-none text-slate-700">{bus.arrival}</p>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {formatDurationBrief(bus.duration)} {bus.availableSeats > 0 ? `• ${bus.availableSeats} Seats` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-2xl font-black leading-none text-slate-900">₹{Number(bus.price || 0).toLocaleString('en-IN')}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-400">Onwards</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Clock3 size={13} className="text-slate-400" />
                    <span>{bus.type}</span>
                    <span>•</span>
                    <span>{bus.busName || bus.operator}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-black text-slate-900">{bus.operator}</h3>
                      <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                        {topAmenities.length > 0 ? topAmenities.join(' • ') : (bus.routeName || `${fromCity} to ${toCity}`)}
                      </p>
                    </div>
                    {hasRating ? (
                      <div className="shrink-0 rounded-xl bg-amber-400 px-2.5 py-1.5 text-white shadow-sm">
                        <div className="flex items-center gap-1">
                          <Star size={12} className="fill-current" />
                          <span className="text-sm font-black">{Number(bus.rating || 0).toFixed(1)}</span>
                        </div>
                        <p className="mt-0.5 text-center text-[10px] font-bold text-white/90">{Number(bus.ratingCount || 0)}</p>
                      </div>
                    ) : (
                      <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                        New Bus
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {bus.availableSeats > 0 ? (
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black text-orange-600">
                        {bus.availableSeats} seats left
                      </span>
                    ) : null}
                    {topAmenities.map((amenity) => (
                      <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
                        {amenity}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {Number(bus.ratingCount || 0) > 20 ? (
                        <span className="rounded-full bg-pink-50 px-3 py-1 text-[10px] font-black text-pink-600">
                          Highly rated
                        </span>
                      ) : null}
                      {String(bus.cancellationPolicy || '').toLowerCase().includes('free') ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600">
                          Free cancellation
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-900">
                      Details <ChevronRight size={16} />
                    </div>
                  </div>
                </motion.button>
              );
            })
          : null}
      </div>
    </div>
  );
};

export default BusList;
