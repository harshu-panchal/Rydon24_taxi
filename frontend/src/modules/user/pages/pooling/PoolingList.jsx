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
  Zap,
  Ticket
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
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto font-sans pb-24">
      {/* Immersive Header */}
      <div className="sticky top-0 z-50 bg-white px-5 pt-10 pb-5 shadow-sm border-b border-slate-100">
        <div className="flex items-center gap-4 mb-5">
          <button 
            onClick={() => navigate('/taxi/user/pooling')}
            className="w-10 h-10 rounded-2xl border border-slate-100 bg-white flex items-center justify-center text-slate-900 shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black text-slate-900">{from}</span>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
              <span className="truncate text-sm font-black text-slate-900">{to}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{date}</p>
               <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Step 1/3</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-600">
            <Filter size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 px-1">
          <div className="h-1.5 flex-1 rounded-full bg-indigo-600 animate-pulse" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="px-5 pt-6">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 w-full animate-pulse rounded-[32px] bg-white border border-slate-100" />
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-indigo-200">
              <Car size={48} />
            </div>
            <h3 className="text-lg font-black text-slate-900">No matching rides</h3>
            <p className="mt-2 max-w-[240px] text-xs font-bold text-slate-400 leading-relaxed">We couldn't find any active carpools for this route on the selected date.</p>
            <button 
              onClick={() => navigate('/taxi/user/pooling')}
              className="mt-8 text-xs font-black uppercase tracking-widest text-indigo-600 px-6 py-3 bg-indigo-50 rounded-xl active:scale-95 transition-all"
            >
              Modify Search
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">{routes.length} Rides Found</p>
               <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={12} />
                  Safe Search
               </div>
            </div>

            {routes.map((route, idx) => {
              const vehicle = route.assignedVehicleTypeIds?.[0] || {};
              const vehicleImage = vehicle.images?.[0];

              return (
                <motion.div
                  key={route._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    navigate(`/taxi/user/pooling/seats/${route._id}`, {
                      state: {
                        travelDate: date,
                      },
                    })
                  }
                  className="group relative overflow-hidden rounded-[32px] border border-slate-100 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-[0_20px_40px_rgba(15,23,42,0.06)]"
                >
                  {/* Vehicle Image Background (Subtle) */}
                  {vehicleImage && (
                    <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-[0.03] grayscale transition-all group-hover:opacity-10 group-hover:scale-110 pointer-events-none">
                      <img src={vehicleImage} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}

                  {/* Route Info */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-4 flex-1 pr-4">
                      <div className="flex items-start gap-4">
                        <div className="relative flex flex-col items-center pt-1.5">
                          <div className="h-3 w-3 rounded-full border-2 border-indigo-600 bg-white z-10" />
                          <div className="h-10 w-0.5 bg-slate-50 border-l-2 border-dashed border-slate-200" />
                          <div className="h-3 w-3 rounded-full bg-indigo-600 z-10" />
                        </div>
                        <div className="space-y-6 flex-1">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Origin</p>
                            <p className="text-sm font-black text-slate-900 truncate">{route.originLabel}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Destination</p>
                            <p className="text-sm font-black text-slate-900 truncate">{route.destinationLabel}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      {vehicleImage ? (
                        <div className="mb-4 w-20 h-14 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
                           <img src={vehicleImage} alt={vehicle.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-amber-600 mb-4">
                          <Star size={10} className="fill-amber-600" />
                          Top Rated
                        </div>
                      )}
                      
                      <div className="flex flex-col items-end">
                         <p className="text-2xl font-black text-slate-900">₹{route.farePerSeat}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Per Seat</p>
                      </div>
                    </div>
                  </div>

                  {/* Driver & Status */}
                  <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 overflow-hidden rounded-xl bg-slate-100 shadow-sm">
                          <img src={`https://ui-avatars.com/api/?name=${route.driverName || 'Driver'}&background=random&bold=true`} alt="" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">{route.driverName || 'Verified'}</p>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                             <ShieldCheck size={10} />
                             Secured
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                         <div className="flex items-center gap-1 text-[11px] font-black text-indigo-600">
                           <Zap size={12} />
                           Instant
                         </div>
                         <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-0.5">
                           <Users size={12} />
                           {route.maxSeatsPerBooking} Left
                         </div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                         <ChevronRight size={20} />
                      </div>
                    </div>
                  </div>

                  {/* Decoration */}
                  <div className="absolute -right-12 -bottom-12 h-24 w-24 rounded-full bg-indigo-50/20" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolingList;
