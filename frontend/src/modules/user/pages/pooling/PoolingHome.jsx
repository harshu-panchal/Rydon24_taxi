import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  ArrowLeftRight, 
  Calendar, 
  Search, 
  ChevronRight, 
  Clock, 
  Star,
  ShieldCheck,
  Users,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

const PoolingHome = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState({
    from: '',
    to: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real app, we'd fetch actual popular routes
    setPopularRoutes([
      { id: 1, from: 'Indore', to: 'Bhopal', price: 450, time: '3h 30m', rating: 4.8 },
      { id: 2, from: 'Dewas', to: 'Indore', price: 120, time: '45m', rating: 4.9 },
      { id: 3, from: 'Ujjain', to: 'Indore', price: 180, time: '1h 15m', rating: 4.7 }
    ]);
  }, []);

  const handleSearch = () => {
    if (!search.from || !search.to) {
      toast.error('Please select both origin and destination');
      return;
    }
    navigate(`/taxi/user/pooling/list?from=${search.from}&to=${search.to}&date=${search.date}`);
  };

  const swapLocations = () => {
    setSearch(prev => ({ ...prev, from: prev.to, to: prev.from }));
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header Section */}
      <div className="relative bg-slate-900 px-6 pt-12 pb-24 text-white overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <button 
          onClick={() => navigate('/taxi/user')}
          className="relative mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition hover:bg-white/20"
        >
          <ArrowLeft size={20} />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <h1 className="text-4xl font-black tracking-tight">Carpool</h1>
          <p className="mt-2 text-indigo-200 font-medium">Safe, affordable & eco-friendly rides</p>
        </motion.div>
      </div>

      {/* Search Card */}
      <div className="mx-6 -mt-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[32px] bg-white p-6 shadow-2xl shadow-indigo-100 border border-slate-50"
        >
          <div className="space-y-4">
            {/* Origin */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">
                <MapPin size={20} />
              </div>
              <input
                type="text"
                placeholder="From where?"
                value={search.from}
                onChange={(e) => setSearch({ ...search, from: e.target.value })}
                className="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:ring-4 focus:ring-indigo-50 border border-transparent focus:border-indigo-100"
              />
            </div>

            {/* Swap Button */}
            <div className="relative flex justify-center -my-2 z-10">
              <button 
                onClick={swapLocations}
                className="h-10 w-10 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center border-4 border-white active:scale-90 transition-transform"
              >
                <ArrowLeftRight size={18} className="rotate-90" />
              </button>
            </div>

            {/* Destination */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500">
                <MapPin size={20} />
              </div>
              <input
                type="text"
                placeholder="To where?"
                value={search.to}
                onChange={(e) => setSearch({ ...search, to: e.target.value })}
                className="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:ring-4 focus:ring-indigo-50 border border-transparent focus:border-indigo-100"
              />
            </div>

            {/* Date Selection */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Calendar size={20} />
              </div>
              <input
                type="date"
                value={search.date}
                onChange={(e) => setSearch({ ...search, date: e.target.value })}
                className="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:ring-4 focus:ring-indigo-50 border border-transparent focus:border-indigo-100"
              />
            </div>

            <button
              onClick={handleSearch}
              className="mt-2 w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.98]"
            >
              Search Rides
            </button>
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="mt-12 px-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-indigo-50/50 p-5 border border-indigo-100/50">
            <div className="mb-3 h-10 w-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-black text-slate-900">Verified ID</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-500">All members are verified</p>
          </div>
          <div className="rounded-3xl bg-blue-50/50 p-5 border border-blue-100/50">
            <div className="mb-3 h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Star size={20} />
            </div>
            <h3 className="text-sm font-black text-slate-900">Top Rated</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-500">Highly rated co-travelers</p>
          </div>
        </div>
      </div>

      {/* Popular Routes */}
      <div className="mt-12 px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">Popular Routes</h2>
          <button className="text-xs font-black uppercase tracking-widest text-indigo-600">View All</button>
        </div>
        
        <div className="space-y-4">
          {popularRoutes.map((route) => (
            <motion.div
              key={route.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSearch({ ...search, from: route.from, to: route.to });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 transition-all hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{route.from}</span>
                    <ChevronRight size={14} className="text-slate-300" />
                    <span className="text-sm font-black text-slate-900">{route.to}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Clock size={12} />
                      {route.time}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                      <Star size={12} fill="currentColor" />
                      {route.rating}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-indigo-600">₹{route.price}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Per Seat</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PoolingHome;
