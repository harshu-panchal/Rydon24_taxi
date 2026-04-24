import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BusFront, CalendarDays, ChevronLeft, ChevronRight, Loader2, Ticket } from 'lucide-react';
import userBusService from '../../services/busService';

const PAGE_SIZE = 8;

const statusTone = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  failed: 'bg-rose-50 text-rose-700 border-rose-100',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const formatDateTime = (value) => {
  if (!value) return 'NA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'NA';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const BusBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => (location.pathname.startsWith('/taxi/user') ? '/taxi/user' : ''), [location.pathname]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    let active = true;

    const loadBookings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await userBusService.getMyBookings({ page, limit: PAGE_SIZE });
        if (!active) return;

        const payload = response?.data || {};
        setBookings(Array.isArray(payload.results) ? payload.results : []);
        setPagination(payload.pagination || {
          page,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: page > 1,
        });
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Unable to load bus bookings');
        setBookings([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadBookings();

    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_22%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-12 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-200/30 blur-3xl pointer-events-none" />

      <header className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Profile</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900">Bus Bookings</h1>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 space-y-4">
        <div className="rounded-[22px] bg-white/90 border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.04)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tickets</p>
          <h2 className="mt-1 text-[18px] font-black text-slate-900">Your bus journey history</h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">See booking code, route, seats, travel date, payment status, and amount with pagination.</p>
        </div>

        {loading ? (
          <div className="rounded-[22px] bg-white/90 border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.04)] p-8 flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-500">Loading bus bookings</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && bookings.length === 0 ? (
          <div className="rounded-[24px] bg-white/90 border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.04)] p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-[20px] bg-orange-50 border border-orange-100 flex items-center justify-center">
              <BusFront size={28} className="text-orange-500" />
            </div>
            <p className="mt-4 text-[16px] font-black text-slate-900">No bus bookings yet</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">Once you book a bus, the ticket details will show here.</p>
          </div>
        ) : null}

        {!loading && !error ? bookings.map((booking, index) => (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-[24px] border border-white/80 bg-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.05)] overflow-hidden"
          >
            <div className="bg-slate-900 px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Booking Code</p>
                  <p className="mt-1 text-[16px] font-black">{booking.bookingCode}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone[booking.status] || statusTone.pending}`}>
                  {booking.status}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[18px] font-black text-slate-900 leading-none">{booking.bus?.departure || 'NA'}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{booking.bus?.fromCity || 'From'}</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1">
                    <Ticket size={11} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500">{booking.bus?.duration || 'Trip'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-black text-slate-900 leading-none">{booking.bus?.arrival || 'NA'}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{booking.bus?.toCity || 'To'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operator</p>
                  <p className="mt-1 text-[13px] font-black text-slate-900">{booking.bus?.operator || 'NA'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{booking.bus?.type || 'Bus'}</p>
                </div>
                <div className="rounded-[18px] bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Seats</p>
                  <p className="mt-1 text-[13px] font-black text-slate-900">{(booking.seatLabels || booking.seatIds || []).join(', ') || 'NA'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">₹{Number(booking.amount || 0)} paid</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-500">
                <div className="rounded-[16px] border border-slate-100 px-3 py-3 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1">
                    <CalendarDays size={12} /> Travel Date
                  </p>
                  <p className="mt-1 text-[13px] font-black text-slate-900">{booking.travelDate || 'NA'}</p>
                </div>
                <div className="rounded-[16px] border border-slate-100 px-3 py-3 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Booked On</p>
                  <p className="mt-1 text-[13px] font-black text-slate-900">{formatDateTime(booking.createdAt)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )) : null}

        {!loading && !error && pagination.totalPages > 1 ? (
          <div className="rounded-[20px] bg-white/90 border border-white/80 shadow-[0_4px_14px_rgba(15,23,42,0.04)] px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Page {pagination.page} / {pagination.totalPages}
            </p>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BusBookings;
