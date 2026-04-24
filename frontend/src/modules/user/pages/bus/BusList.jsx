import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, BusFront, Clock3, Armchair, Loader2 } from 'lucide-react';
import userBusService from '../../services/busService';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_20%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-10">
      <div className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">{fromCity} to {toCity}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{date}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {loading ? (
          <div className="bg-white/90 rounded-[24px] border border-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-8 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 size={28} className="animate-spin text-orange-500" />
            <p className="text-[12px] font-black uppercase tracking-[0.22em]">Searching available buses</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-[20px] p-4 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && buses.length === 0 ? (
          <div className="bg-white/90 rounded-[24px] border border-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-8 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">No buses available</p>
            <h2 className="mt-2 text-[18px] font-black text-slate-900">No active buses found for this route and date.</h2>
            <p className="mt-2 text-[12px] font-semibold text-slate-500">Try another date or ask admin to activate a bus schedule for this route.</p>
          </div>
        ) : null}

        {!loading && !error
          ? buses.map((bus, index) => (
              <motion.button
                key={bus.id}
                type="button"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelect(bus)}
                className="w-full text-left bg-white/90 rounded-[22px] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] border border-white/80 active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundColor: bus.busColor || '#1f2937' }}
                      >
                        <BusFront size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-black text-slate-900 leading-tight truncate">{bus.operator}</h3>
                        <p className="text-[11px] font-bold text-slate-500 truncate">{bus.busName || bus.type}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 border border-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-600">
                        {bus.type}
                      </span>
                      {bus.amenities?.slice(0, 2).map((amenity) => (
                        <span
                          key={amenity}
                          className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">Starting at</p>
                    <p className="text-[20px] font-black text-slate-900 leading-none">₹{Number(bus.price || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <p className="text-[18px] font-black text-slate-900 leading-none">{bus.departure}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{fromCity}</p>
                  </div>
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1">
                      <Clock3 size={11} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-500">{bus.duration || 'On route'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-slate-900 leading-none">{bus.arrival}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{toCity}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                    <Armchair size={13} className="text-emerald-500" />
                    <span>{bus.availableSeats} seats left</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                    Select Seats <ChevronRight size={14} strokeWidth={3} />
                  </div>
                </div>
              </motion.button>
            ))
          : null}
      </div>
    </div>
  );
};

export default BusList;
