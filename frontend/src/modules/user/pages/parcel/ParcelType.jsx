import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Package } from 'lucide-react';
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
    desc: 'Office files, paper',
    accentClass: 'bg-[linear-gradient(135deg,#FFF7ED_0%,#FFE5C2_100%)]',
  },
  {
    id: '2',
    title: 'Groceries',
    img: imgGrocery,
    desc: 'Daily veggies',
    accentClass: 'bg-[linear-gradient(135deg,#F0FDF4_0%,#BBF7D0_100%)]',
  },
  {
    id: '3',
    title: 'Gifts',
    img: imgGifts,
    desc: 'Cake, gift box',
    accentClass: 'bg-[linear-gradient(135deg,#FDF4FF_0%,#F3E8FF_100%)]',
  },
  {
    id: '4',
    title: 'Clothes',
    img: imgClothes,
    desc: 'Laundry, dresses',
    accentClass: 'bg-[linear-gradient(135deg,#EFF6FF_0%,#DBEAFE_100%)]',
  },
  {
    id: '5',
    title: 'Electronics',
    img: imgElectronics,
    desc: 'Phone, cables',
    accentClass: 'bg-[linear-gradient(135deg,#FEFCE8_0%,#FDE68A_100%)]',
  },
  {
    id: '6',
    title: 'Others',
    img: imgOthers,
    desc: 'Any other item',
    accentClass: 'bg-[linear-gradient(135deg,#F8FAFC_0%,#E2E8F0_100%)]',
  },
];

const accentClasses = [
  'bg-[linear-gradient(135deg,#FFF7ED_0%,#FFE5C2_100%)]',
  'bg-[linear-gradient(135deg,#F0FDF4_0%,#BBF7D0_100%)]',
  'bg-[linear-gradient(135deg,#FDF4FF_0%,#F3E8FF_100%)]',
  'bg-[linear-gradient(135deg,#EFF6FF_0%,#DBEAFE_100%)]',
  'bg-[linear-gradient(135deg,#FEFCE8_0%,#FDE68A_100%)]',
  'bg-[linear-gradient(135deg,#F8FAFC_0%,#E2E8F0_100%)]',
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
    desc: moduleAccess === 'Both' ? 'Available for all delivery types' : `${moduleAccess} delivery`,
    accentClass: accentClasses[index % accentClasses.length],
    goodsTypeFor: rawModuleAccess || 'both',
    raw: item,
  };
};

const ParcelType = () => {
  const [categories, setCategories] = useState(fallbackCategories);
  const [selectedType, setSelectedType] = useState(fallbackCategories[0]?.title || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchGoodsTypes = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const response = await api.get('/users/goods-types');
        const items = response?.results || response?.data?.results || response?.data?.goods_types || [];
        const activeItems = items.filter((item) => Number(item?.active ?? 1) === 1);
        const mappedCategories = (activeItems.length ? activeItems : items).map(formatGoodsType);

        if (!isMounted) return;

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
        setLoadError('Unable to load goods types right now.');
        setCategories(fallbackCategories);
        setSelectedType((current) => current || fallbackCategories[0]?.title || '');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchGoodsTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  const selected = useMemo(
    () => categories.find((category) => category.title === selectedType) || categories[0],
    [categories, selectedType]
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto flex flex-col font-sans relative overflow-hidden">
      {/* Ambient blobs matching home page */}
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-100/60 blur-3xl pointer-events-none" />
      <div className="absolute top-52 left-[-60px] h-52 w-52 rounded-full bg-emerald-100/60 blur-3xl pointer-events-none" />

      {/* Header */}
      <Motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-white/90 backdrop-blur-md px-5 py-5 flex items-center gap-4 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sticky top-0 z-20"
      >
        <Motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.07)] active:scale-90 transition-all shrink-0"
        >
          <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
        </Motion.button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Parcel Delivery</p>
          <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-tight">What are you sending?</h1>
        </div>
        <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-600 shadow-sm shrink-0">
          <Package size={12} className="inline mr-1 text-orange-400" />
          {categories.length} types
        </div>
      </Motion.header>

      {/* Content */}
      <div className="flex-1 px-5 pt-5 pb-32 overflow-y-auto no-scrollbar">

        {/* Section label */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
          className="mb-4"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Step 1 of 3</p>
          <h2 className="mt-0.5 text-[16px] font-black tracking-tight text-slate-900">Select Category</h2>
          <p className="mt-0.5 text-[11px] font-bold text-slate-500">Tap a category that best describes your item.</p>
        </Motion.div>

        {loadError ? (
          <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 rounded-[16px] border border-amber-200 bg-amber-50/90 px-3.5 py-3 text-[11px] font-bold text-amber-700"
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{loadError} Showing saved defaults for now.</span>
          </Motion.div>
        ) : null}

        {/* Category Grid */}
        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {loading ? (
            [...Array(6)].map((_, index) => (
              <div
                key={`loading-${index}`}
                className="rounded-[20px] border border-white/80 bg-white/75 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
              >
                <div className="mx-auto h-14 w-14 animate-pulse rounded-[16px] bg-slate-100" />
                <div className="mt-3 h-3 animate-pulse rounded-full bg-slate-100" />
                <div className="mx-auto mt-2 h-2.5 w-3/4 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))
          ) : (
            categories.map((cat, i) => {
              const isSelected = selectedType === cat.title;
              return (
                <Motion.button
                  key={cat.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedType(cat.title)}
                  className={`relative flex min-h-[172px] flex-col items-center justify-start gap-2.5 rounded-[20px] p-4 border transition-all text-center ${
                    isSelected
                      ? 'border-orange-200 bg-white shadow-[0_8px_24px_rgba(249,115,22,0.15)]'
                      : 'border-white/80 bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.05)] hover:border-slate-200'
                  }`}
                >
                  {/* Selected indicator dot */}
                  <AnimatePresence>
                    {isSelected && (
                      <Motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-orange-500"
                      />
                    )}
                  </AnimatePresence>

                  {/* 3D image container */}
                  <div className={`w-14 h-14 rounded-[16px] flex items-center justify-center transition-all overflow-visible ${
                    isSelected ? 'shadow-lg scale-110' : ''
                  } ${cat.accentClass}`}>
                    <img
                      src={cat.img}
                      alt={cat.title}
                      className="w-12 h-12 object-contain drop-shadow-md"
                    />
                  </div>

                  {/* Labels */}
                  <div className="w-full">
                    <span className={`block min-h-[40px] break-words text-[11px] font-black leading-[1.15] tracking-tight sm:text-[12px] ${
                      isSelected ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                      {cat.title}
                    </span>
                    <span className="mt-1 block break-words text-[9px] font-bold leading-[1.2] text-slate-400 sm:text-[9.5px]">
                      {cat.desc}
                    </span>
                  </div>
                </Motion.button>
              );
            })
          )}
        </Motion.div>

        {/* Selected preview card */}
        <AnimatePresence mode="wait">
          {!loading && selected && (
            <Motion.div
              key={selected.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-5 flex items-center gap-3 rounded-[18px] border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
            >
              <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${selected.accentClass}`}>
                <img src={selected.img} alt={selected.title} className="w-7 h-7 object-contain drop-shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected</p>
                <p className="text-[13px] font-black text-slate-900 leading-tight">{selected.title}</p>
                <p className="text-[10px] font-bold text-slate-400">{selected.desc}</p>
              </div>
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-6 pt-3 bg-gradient-to-t from-[#EEF2F7] via-[#F3F4F6]/95 to-transparent pointer-events-none z-30">
        <Motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            navigate('/parcel/details', {
              state: {
                parcelType: selectedType,
                selectedGoodsType: selected,
                goodsTypeFor: selected?.goodsTypeFor || 'both',
              },
            })
          }
          disabled={loading || !selectedType}
          className="pointer-events-auto w-full bg-slate-900 py-4 rounded-[18px] text-[15px] font-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] active:bg-black transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin opacity-70" strokeWidth={2.5} />
              <span>Loading Categories</span>
            </>
          ) : (
            <>
              <span>Next: Item Details</span>
              <ChevronRight size={17} className="opacity-50" strokeWidth={3} />
            </>
          )}
        </Motion.button>
      </div>
    </div>
  );
};

export default ParcelType;
