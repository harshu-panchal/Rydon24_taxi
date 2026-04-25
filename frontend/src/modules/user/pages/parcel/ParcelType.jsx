import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  Package, 
  Truck, 
  Bike, 
  CarFront, 
  Sparkles,
  Search,
  Info,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';

import imgDocuments from '@/assets/3d images/documents.png';
import imgGrocery from '@/assets/3d images/grocery.png';
import imgGifts from '@/assets/3d images/gifts.png';
import imgClothes from '@/assets/3d images/clothes.png';
import imgElectronics from '@/assets/3d images/electronics.png';
import imgOthers from '@/assets/3d images/others.png';

const Motion = motion;

const fallbackCategories = [
  {
    id: '1',
    title: 'Documents',
    img: imgDocuments,
    desc: 'Paper, office files, certificates',
    accentClass: 'from-blue-50 to-indigo-100/50',
    iconColor: 'text-blue-600',
  },
  {
    id: '2',
    title: 'Groceries',
    img: imgGrocery,
    desc: 'Daily essentials, fresh produce',
    accentClass: 'from-emerald-50 to-teal-100/50',
    iconColor: 'text-emerald-600',
  },
  {
    id: '3',
    title: 'Gifts',
    img: imgGifts,
    desc: 'Cakes, flowers, surprises',
    accentClass: 'from-pink-50 to-rose-100/50',
    iconColor: 'text-pink-600',
  },
  {
    id: '4',
    title: 'Clothes',
    img: imgClothes,
    desc: 'Apparels, laundry, fashion',
    accentClass: 'from-violet-50 to-purple-100/50',
    iconColor: 'text-violet-600',
  },
  {
    id: '5',
    title: 'Electronics',
    img: imgElectronics,
    desc: 'Phones, gadgets, accessories',
    accentClass: 'from-amber-50 to-orange-100/50',
    iconColor: 'text-amber-600',
  },
  {
    id: '6',
    title: 'Others',
    img: imgOthers,
    desc: 'Any other delivery item',
    accentClass: 'from-slate-50 to-slate-200/50',
    iconColor: 'text-slate-600',
  },
];

const accentClasses = [
  'from-blue-50 to-indigo-100/50',
  'from-emerald-50 to-teal-100/50',
  'from-pink-50 to-rose-100/50',
  'from-violet-50 to-purple-100/50',
  'from-amber-50 to-orange-100/50',
  'from-slate-50 to-slate-200/50',
];

const imageMatchers = [
  { pattern: /(document|file|paper|certificate|passport)/i, img: imgDocuments },
  { pattern: /(grocery|food|vegetable|fruit|kitchen|meal|perishable)/i, img: imgGrocery },
  { pattern: /(gift|flower|cake|surprise|toy)/i, img: imgGifts },
  { pattern: /(cloth|laundry|dress|fashion|garment|shoe|apparel)/i, img: imgClothes },
  { pattern: /(electronic|phone|laptop|device|charger|computer|gadget)/i, img: imgElectronics },
];

const resolveCategoryImage = (name = '') =>
  imageMatchers.find((entry) => entry.pattern.test(name))?.img || imgOthers;

const formatGoodsType = (item, index) => {
  const title = String(item?.name || item?.goods_type_name || '').trim();
  const rawModuleAccess = String(item?.goods_types_for || item?.goods_type_for || 'both').trim();
  const moduleAccess = rawModuleAccess
    .split(',')
    .map((entry) =>
      entry
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .filter(Boolean)
    .join(', ');
  const savedIcon = String(item?.icon || '').trim();

  return {
    id: String(item?._id || item?.id || index + 1),
    title: title || `Category ${index + 1}`,
    img: savedIcon || resolveCategoryImage(title),
    desc: moduleAccess === 'Both' ? 'Standard Delivery' : `${moduleAccess} delivery`,
    accentClass: accentClasses[index % accentClasses.length],
    goodsTypeFor: rawModuleAccess || 'both',
    raw: item,
  };
};

const getVehicleIcon = (vehicle = {}) => {
  const iconType = String(vehicle.icon_types || vehicle.name || '').trim().toLowerCase();
  if (iconType.includes('bike')) return Bike;
  if (iconType.includes('truck') || iconType.includes('mover') || iconType.includes('lcv') || iconType.includes('hcv') || iconType.includes('mcv')) {
    return Truck;
  }
  return CarFront;
};

const formatVehicleType = (item, index) => {
  const transportType = String(item?.transport_type || 'delivery').trim().toLowerCase();
  const capabilityLabel = transportType === 'both' ? 'Hybrid' : 'Parcel Only';
  const description = String(item?.short_description || item?.description || '').trim();

  return {
    id: String(item?._id || item?.id || `vehicle-${index + 1}`),
    name: String(item?.name || 'Vehicle').trim(),
    description: description || 'Optimized for parcel delivery',
    transportType,
    capabilityLabel,
    image: String(item?.image || item?.map_icon || item?.icon || '').trim(),
    capacity: Number(item?.capacity || 0),
    iconType: String(item?.icon_types || '').trim(),
  };
};

const ParcelType = () => {
  const [categories, setCategories] = useState(fallbackCategories);
  const [selectedType, setSelectedType] = useState(fallbackCategories[0]?.title || '');
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [goodsResponse, vehicleResponse] = await Promise.all([
          api.get('/users/goods-types'),
          api.get('/users/vehicle-types'),
        ]);
        const items = goodsResponse?.results || goodsResponse?.data?.results || goodsResponse?.data?.goods_types || [];
        const activeItems = items.filter((item) => Number(item?.active ?? 1) === 1);
        const mappedCategories = (activeItems.length ? activeItems : items).map(formatGoodsType);
        
        const vehicleItems = vehicleResponse?.results || vehicleResponse?.data?.results || vehicleResponse?.data?.goods_types || [];
        const mappedVehicles = vehicleItems
          .filter((item) => item?.active !== false && Number(item?.status ?? 1) !== 0)
          .filter((item) => {
            const transportType = String(item?.transport_type || 'delivery').trim().toLowerCase();
            return transportType === 'delivery' || transportType === 'both';
          })
          .map(formatVehicleType);

        if (!isMounted) return;

        if (mappedVehicles.length > 0) {
          setVehicleTypes(mappedVehicles);
          setSelectedVehicleId((current) => 
            mappedVehicles.some(v => v.id === current) ? current : mappedVehicles[0].id
          );
        }

        if (mappedCategories.length > 0) {
          setCategories(mappedCategories);
          setSelectedType((current) =>
            mappedCategories.some((category) => category.title === current)
              ? current
              : mappedCategories[0].title
          );
        } else {
          setCategories(fallbackCategories);
          setSelectedType(fallbackCategories[0]?.title || '');
        }
      } catch {
        if (!isMounted) return;
        setLoadError('Unable to load latest categories.');
        setCategories(fallbackCategories);
        setVehicleTypes([]);
        setSelectedType((current) => current || fallbackCategories[0]?.title || '');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter(cat => 
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  const selected = useMemo(
    () => categories.find((category) => category.title === selectedType) || categories[0],
    [categories, selectedType]
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] max-w-lg mx-auto flex flex-col font-sans relative overflow-x-hidden">
      {/* Dynamic Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[70%] h-[40%] bg-indigo-50/40 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[20%] -left-[20%] w-[80%] h-[50%] bg-orange-50/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[0%] w-[60%] h-[40%] bg-blue-50/40 rounded-full blur-[100px]" />
      </div>

      {/* Modern Header */}
      <Motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 px-6 py-6 bg-white/70 backdrop-blur-xl border-b border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <Motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-900"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </Motion.button>
          
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-0.5">Step 01</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
            </div>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Package size={20} />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">What are you sending?</h1>
          <p className="text-sm font-medium text-gray-500">Select the category that matches your item</p>
        </div>
      </Motion.header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 pt-6 pb-32 z-10">
        
        {/* Search Bar */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-8"
        >
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input 
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
          />
        </Motion.div>

        {/* Fleet Teaser Section */}
        {!searchQuery && (
          <Motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Available Fleet</h3>
              <div className="px-2 py-0.5 rounded-full bg-green-50 text-[10px] font-black text-green-600 flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-green-600 animate-pulse" />
                ACTIVE
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
              {vehicleTypes.length > 0 ? (
                vehicleTypes.map((vehicle, idx) => {
                  const isVehicleSelected = selectedVehicleId === vehicle.id;
                  return (
                    <Motion.button 
                      key={vehicle.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedVehicleId(vehicle.id)}
                      className={`min-w-[150px] text-left bg-white rounded-[32px] p-5 border transition-all duration-300 ${
                        isVehicleSelected 
                          ? 'border-indigo-600 shadow-md ring-2 ring-indigo-500/10' 
                          : 'border-gray-100 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className={`w-full h-24 rounded-2xl bg-gradient-to-br ${accentClasses[idx % accentClasses.length]} flex items-center justify-center mb-4 transition-transform ${isVehicleSelected ? 'scale-105' : ''}`}>
                        {vehicle.image ? (
                          <img src={vehicle.image} alt={vehicle.name} className="w-20 h-20 object-contain drop-shadow-md" />
                        ) : (
                          React.createElement(getVehicleIcon(vehicle), { size: 40, className: 'text-gray-700' })
                        )}
                      </div>
                      <div className="space-y-1 px-1">
                        <h4 className={`text-[15px] font-black leading-none transition-colors ${isVehicleSelected ? 'text-indigo-600' : 'text-gray-900'}`}>
                          {vehicle.name}
                        </h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{vehicle.capabilityLabel}</p>
                      </div>
                    </Motion.button>
                  );
                })
              ) : (
                [...Array(3)].map((_, idx) => (
                  <div key={idx} className="min-w-[150px] h-[160px] bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                  </div>
                ))
              )}
            </div>
          </Motion.section>
        )}

        {/* Category Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Categories</h3>
            {filteredCategories.length === 0 && (
              <span className="text-[10px] font-bold text-red-500">No results found</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {loading ? (
                [...Array(6)].map((_, idx) => (
                  <div key={`shimmer-${idx}`} className="h-44 bg-gray-50 rounded-[32px] animate-pulse border border-gray-100" />
                ))
              ) : (
                filteredCategories.map((cat, idx) => {
                  const isSelected = selectedType === cat.title;
                  return (
                    <Motion.button
                      layout
                      key={cat.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedType(cat.title)}
                      className={`relative group h-48 rounded-[32px] p-5 flex flex-col items-start transition-all duration-300 border ${
                        isSelected 
                          ? 'bg-white border-indigo-600 shadow-[0_20px_40px_rgba(79,70,229,0.12)]' 
                          : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
                      }`}
                    >
                      {/* Selection Badge */}
                      {isSelected && (
                        <Motion.div 
                          layoutId="selection-badge"
                          className="absolute top-4 right-4 text-indigo-600"
                        >
                          <CheckCircle2 size={24} fill="currentColor" className="text-white" />
                          <CheckCircle2 size={24} className="absolute inset-0" />
                        </Motion.div>
                      )}

                      {/* Icon Box */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.accentClass} flex items-center justify-center mb-auto transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                        <img 
                          src={cat.img} 
                          alt={cat.title} 
                          className="w-11 h-11 object-contain drop-shadow-lg"
                        />
                      </div>

                      <div className="text-left w-full mt-3">
                        <h4 className={`text-sm font-black leading-tight mb-1.5 transition-colors line-clamp-2 ${
                          isSelected ? 'text-gray-900' : 'text-gray-800'
                        }`}>
                          {cat.title}
                        </h4>
                        <p className={`text-[10px] font-bold transition-colors line-clamp-1 ${
                          isSelected ? 'text-indigo-600/80' : 'text-gray-400'
                        }`}>
                          {cat.desc}
                        </p>
                      </div>
                    </Motion.button>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Info Tip */}
        <Motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex gap-3 items-start"
        >
          <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-semibold text-indigo-900/70 leading-relaxed">
            Ensure your items are properly packed. Our delivery partners carry standard sized parcels. For oversized items, please contact support.
          </p>
        </Motion.div>
      </main>

      {/* Premium Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-50">
        <div className="max-w-lg mx-auto">
          {/* Glass Overlay for Footer Background */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none" />
          
          <Motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading || !selectedType}
            onClick={() =>
              navigate('/parcel/contacts', {
                state: {
                  parcelType: selectedType,
                  selectedGoodsType: selected,
                  goodsTypeFor: selected?.goodsTypeFor || 'both',
                  selectedVehicleId: selectedVehicleId,
                  selectedVehicle: vehicleTypes.find(v => v.id === selectedVehicleId),
                },
              })
            }
            className="relative w-full group overflow-hidden bg-gray-900 disabled:bg-gray-400 text-white rounded-[24px] py-5 px-8 flex items-center justify-between shadow-[0_20px_40px_rgba(0,0,0,0.15)] transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <PackageCheck size={20} />
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-black uppercase tracking-widest text-white/50">Next Step</span>
                <span className="block text-base font-black">Configure Details</span>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <span className="text-xs font-bold text-white/70">Continue</span>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight size={18} />
              </div>
            </div>
          </Motion.button>
        </div>
      </div>
    </div>
  );
};

export default ParcelType;
