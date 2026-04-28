import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ChevronRight, 
  Armchair, 
  Info,
  ShieldCheck,
  Zap,
  MapPin,
  Clock,
  Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

const PoolingSeats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [route, setRoute] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRouteDetails();
  }, [id]);

  const fetchRouteDetails = async () => {
    setLoading(true);
    try {
      const res = await userService.getPoolingRouteDetails(id);
      setRoute(res.data);
      if (res.data.assignedVehicleTypeIds && res.data.assignedVehicleTypeIds.length > 0) {
        setSelectedVehicle(res.data.assignedVehicleTypeIds[0]);
      }
    } catch (error) {
      toast.error('Failed to load route details');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seatId) => {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(prev => prev.filter(id => id !== seatId));
    } else {
      if (selectedSeats.length >= (route?.maxSeatsPerBooking || 1)) {
        toast.error(`Maximum ${route?.maxSeatsPerBooking} seats allowed`);
        return;
      }
      setSelectedSeats(prev => [...prev, seatId]);
    }
  };

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }
    // Navigate to confirmation with state
    navigate(`/taxi/user/pooling/confirm`, {
      state: {
        route,
        vehicle: selectedVehicle,
        selectedSeats,
        totalFare: selectedSeats.length * route.farePerSeat
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const blueprint = selectedVehicle?.blueprint || { rows: 3, cols: 2, layout: [] };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm rounded-b-[40px]">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">Select Seats</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{route?.routeName}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-3xl bg-indigo-50/50 p-4 border border-indigo-100/50">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Car size={24} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{selectedVehicle?.name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{selectedVehicle?.vehicleModel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-indigo-600">₹{route?.farePerSeat}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Per Seat</p>
          </div>
        </div>
      </div>

      {/* Blueprint Area */}
      <div className="px-6 pt-10">
        <div className="flex flex-col items-center">
          {/* Legend */}
          <div className="mb-10 flex gap-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-white border-2 border-slate-200" />
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-slate-900" />
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Driver</span>
            </div>
          </div>

          {/* Car Outline */}
          <div className="relative flex flex-col items-center justify-center py-16 bg-white rounded-[60px] border border-slate-100 shadow-2xl shadow-indigo-100/20 px-12">
             {/* Windshield */}
             <div className="mb-8 h-12 w-40 rounded-t-[50px] border-x-8 border-t-8 border-slate-100 bg-slate-50" />

             {/* Grid */}
             <div 
                className="grid gap-6"
                style={{ 
                  gridTemplateColumns: `repeat(${blueprint.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${blueprint.rows}, minmax(0, 1fr))`
                }}
              >
                {blueprint.layout.map((item, idx) => {
                  const seatId = `${item.r}-${item.c}`;
                  const isSelected = selectedSeats.includes(seatId);
                  
                  return (
                    <motion.button
                      key={seatId}
                      whileTap={item.type === 'seat' ? { scale: 0.9 } : {}}
                      onClick={() => item.type === 'seat' && toggleSeat(seatId)}
                      className={`h-16 w-16 flex items-center justify-center rounded-2xl transition-all ${
                        item.type === 'seat' 
                          ? isSelected
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-2 border-indigo-600'
                            : 'bg-white text-slate-400 border-2 border-slate-100 hover:border-indigo-300'
                          : item.type === 'driver'
                          ? 'bg-slate-900 text-white border-2 border-slate-900 cursor-default'
                          : 'bg-transparent text-transparent border-0 pointer-events-none'
                      }`}
                    >
                      {item.type === 'seat' && <Armchair size={24} />}
                      {item.type === 'driver' && <div className="h-6 w-6 rounded-full border-4 border-white/20" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Trunk */}
              <div className="mt-8 h-8 w-40 rounded-b-2xl border-x-8 border-b-8 border-slate-100 bg-slate-50" />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <AnimatePresence>
        {selectedSeats.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white px-6 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[40px]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Price</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">₹{selectedSeats.length * route?.farePerSeat}</span>
                  <span className="text-xs font-bold text-slate-400">/ {selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'}</span>
                </div>
              </div>
              <button 
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-indigo-200 active:scale-95 transition-transform"
              >
                Continue
                <ChevronRight size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PoolingSeats;
