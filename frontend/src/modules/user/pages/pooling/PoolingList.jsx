import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Users, 
  ChevronRight, 
  Filter,
  Car,
  Star,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

const PoolingList = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const date = searchParams.get('date');

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes();
  }, [from, to, date]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await userService.searchPoolingRoutes({ from, to, date });
      setRoutes(res.data || []);
    } catch (error) {
      toast.error('Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/taxi/user/pooling')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black text-slate-900">{from}</span>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
              <span className="truncate text-sm font-black text-slate-900">{to}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{date}</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600">
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="px-6 pt-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 w-full animate-pulse rounded-[32px] bg-white border border-slate-100" />
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-200">
              <Car size={40} />
            </div>
            <h3 className="text-lg font-black text-slate-900">No rides found</h3>
            <p className="mt-2 max-w-[200px] text-xs font-bold text-slate-400">Try changing your search criteria or date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <motion.div
                key={route._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/taxi/user/pooling/seats/${route._id}`)}
                className="group relative overflow-hidden rounded-[32px] border border-slate-100 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100/50"
              >
                {/* Route Info */}
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="relative flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full border-2 border-indigo-600 bg-white" />
                        <div className="h-12 w-0.5 bg-slate-100" />
                        <div className="h-3 w-3 rounded-full bg-indigo-600" />
                      </div>
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</p>
                          <p className="text-sm font-black text-slate-900">{route.originLabel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop</p>
                          <p className="text-sm font-black text-slate-900">{route.destinationLabel}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                      <ShieldCheck size={12} />
                      Verified
                    </div>
                    <p className="mt-4 text-2xl font-black text-indigo-600">₹{route.farePerSeat}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Per Seat</p>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-100">
                        <img src="https://ui-avatars.com/api/?name=Driver&background=random" alt="" />
                      </div>
                      <p className="text-xs font-black text-slate-900">Rahul S.</p>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-slate-200" />
                    <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      4.9
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[11px] font-black text-indigo-600">
                      <Zap size={14} />
                      Instant
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                      <Users size={14} />
                      {route.maxSeatsPerBooking} Seats
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-200">
                    <ChevronRight size={24} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolingList;
