import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { userService } from '../services/userService';
import toast from 'react-hot-toast';

const ServiceTile = ({ icon, label, description, path, accentClass, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex w-full animate-pulse flex-col items-center justify-center gap-1.5 rounded-[18px] border border-gray-50 bg-gray-50 px-1.5 py-2.5">
        <div className="h-12 w-12 rounded-[18px] bg-gray-200" />
        <div className="h-3 w-12 rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => path && navigate(path)}
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[18px] border border-white/80 bg-white/90 px-1.5 py-2.5 shadow-[0_8px_14px_rgba(15,23,42,0.05)] transition-transform"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${accentClass || 'bg-gray-50'}`}>
        <img src={icon} alt={label} className="h-10 w-10 object-contain drop-shadow-sm" />
      </div>

      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="min-h-[24px] text-[10.5px] font-black leading-tight tracking-tight text-slate-900 line-clamp-2 uppercase">
          {label}
        </span>
        <span className="sr-only">{description}</span>
      </div>
    </motion.button>
  );
};

const ServiceGrid = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const getPath = (module) => {
    if (module.transport_type === 'delivery') return '/taxi/user/parcel/type';
    if (module.service_type === 'rental') return '/taxi/user/rental';
    if (module.service_type === 'outstation') return '/taxi/user/intercity';
    
    // Default taxi paths based on name/keywords if needed, or just generic select-location
    if (module.name.toLowerCase().includes('cab') || module.name.toLowerCase().includes('taxi')) {
        return '/taxi/user/cab';
    }
    return '/taxi/user/ride/select-location';
  };

  const getAccent = (index) => {
    const accnets = [
      'bg-[linear-gradient(135deg,#FFF7ED_0%,#FFE5C2_100%)]', // Orange
      'bg-[linear-gradient(135deg,#FEFCE8_0%,#FDE68A_100%)]', // Yellow
      'bg-[linear-gradient(135deg,#EFF6FF_0%,#DBEAFE_100%)]', // Blue
      'bg-[linear-gradient(135deg,#F5F3FF_0%,#E9D5FF_100%)]', // Purple
      'bg-[linear-gradient(135deg,#ECFDF5_0%,#A7F3D0_100%)]', // Green
      'bg-[linear-gradient(135deg,#FFF1F2_0%,#FECDD3_100%)]', // Rose
    ];
    return accnets[index % accnets.length];
  };

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const res = await userService.getAppModules();
        
        // Extract results: res could be { results: [] } or { data: { results: [] } } depending on service
        const results = res?.results || res?.data?.results || [];
        
        // Only show active modules
        const activeModules = results.filter(m => m.active);
        
        const mapped = activeModules.map((m, idx) => ({
          icon: m.mobile_menu_icon,
          label: m.name,
          description: m.short_description,
          path: getPath(m),
          accentClass: getAccent(idx)
        }));
        
        setServices(mapped);
      } catch (err) {
        console.error('Failed to load services:', err);
        toast.error('Could not load services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const optionCount = loading ? '...' : services.length;
  const optionLabel = services.length === 1 ? 'option' : 'options';

  return (
    <div className="px-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="py-1"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Services</p>
            <h2 className="mt-1 text-[18px] font-black tracking-tight text-slate-900">Choose your ride</h2>
            <p className="mt-0.5 text-[11px] font-bold text-slate-500">Tap to start quickly.</p>
          </div>

          <div className="rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-black text-slate-600 shadow-sm">
            {optionCount} {optionLabel}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {loading ? (
             [...Array(4)].map((_, i) => <ServiceTile key={i} loading />)
          ) : (
            services.map((service) => (
              <ServiceTile key={service.label} {...service} />
            ))
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default ServiceGrid;
