import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, Clock } from 'lucide-react';
import { buildAvatarFallback } from './activityHelpers';

const ActivityCard = ({ type, title, address, date, time, status, price, onClick, driverName, driverImage, vehicleImage }) => {
  const [vehicleBroken, setVehicleBroken] = useState(false);
  const [driverBroken, setDriverBroken] = useState(false);
  const resolvedVehicleImage = vehicleBroken ? (type === 'ride' ? '/1_Bike.png' : '/5_Parcel.png') : vehicleImage;
  const resolvedDriverImage = driverBroken ? buildAvatarFallback(driverName) : driverImage;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 active:translate-y-0"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <img
            src={resolvedVehicleImage}
            alt={type === 'ride' ? 'Vehicle' : 'Parcel'}
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => setVehicleBroken(true)}
          />
          <div className="absolute bottom-1.5 right-1.5 h-7 w-7 overflow-hidden rounded-full border-2 border-white bg-white">
            <img
              src={resolvedDriverImage}
              alt={driverName}
              className="h-full w-full object-cover"
              draggable={false}
              onError={() => setDriverBroken(true)}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[15px] font-semibold leading-tight text-slate-900">{title}</h4>
              <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {type === 'parcel' ? 'Delivery booking' : driverName}
              </p>
              <p className="mt-2 line-clamp-2 text-[12px] text-slate-600">{address}</p>
            </div>
            <span className="shrink-0 text-[14px] font-semibold text-slate-900">Rs {price}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-slate-400">
              <Calendar size={11} strokeWidth={2.4} />
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-slate-400">
              <Clock size={11} strokeWidth={2.4} />
              <span>{time}</span>
            </div>
            <span
              className={`ml-auto rounded-full border px-2 py-1 text-[9px] font-semibold leading-none ${
                status === 'Completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : status === 'Cancelled'
                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}
            >
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-300">
          <ChevronRight size={16} strokeWidth={2.4} />
        </div>
      </div>
    </motion.button>
  );
};

export default ActivityCard;
