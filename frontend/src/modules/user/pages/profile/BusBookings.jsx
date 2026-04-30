import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BusFront, CalendarDays, ChevronLeft, ChevronRight, Loader2, MoveRight, Ticket } from 'lucide-react';
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

const formatMoney = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

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
        if (active) setLoading(false);
      }
    };

    loadBookings();
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="relative mx-auto min-h-screen max-w-lg overflow-hidden bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_22%,#f8fafc_100%)] pb-12 font-sans">
      <div className="pointer-events-none absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-orange-200/30 blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 px-5 pb-4 pt-10 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`${routePrefix || '/taxi/user'}`)}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/80 bg-white/90 shadow-sm"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Profile</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900">Bus Bookings</h1>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-5">
        <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tickets</p>
          <h2 className="mt-1 text-[18px] font-black text-slate-900">Tap any booking to open full details</h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">Each row shows the route, travel date, active seats, refund summary, and booking status.</p>
        </div>

        {loading ? (
          <div className="rounded-[22px] border border-white/80 bg-white/90 p-8 text-center shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <Loader2 size={24} className="mx-auto animate-spin text-orange-500" />
            <p className="mt-3 text-[12px] font-black uppercase tracking-[0.22em] text-slate-500">Loading bus bookings</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && bookings.length === 0 ? (
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-8 text-center shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-orange-100 bg-orange-50">
              <BusFront size={28} className="text-orange-500" />
            </div>
            <p className="mt-4 text-[16px] font-black text-slate-900">No bus bookings yet</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">Once you book a bus, the ticket details will show here.</p>
          </div>
        ) : null}

        {!loading && !error ? bookings.map((booking, index) => (
          <motion.button
            key={booking.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => navigate(`${routePrefix}/profile/bus-bookings/${booking.id}`)}
            className="w-full rounded-[24px] border border-white/80 bg-white/95 p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{booking.bookingCode}</p>
                <p className="mt-1 text-[17px] font-black text-slate-900">{booking.bus?.fromCity || 'From'} to {booking.bus?.toCity || 'To'}</p>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">{booking.bus?.operator || 'Operator'} • {booking.bus?.departure || 'NA'} - {booking.bus?.arrival || 'NA'}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone[booking.status] || statusTone.pending}`}>
                {booking.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[16px] border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <CalendarDays size={11} /> Travel
                </p>
                <p className="mt-1 text-[12px] font-black text-slate-900">{booking.travelDate || 'NA'}</p>
              </div>
              <div className="rounded-[16px] border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <Ticket size={11} /> Seats
                </p>
                <p className="mt-1 text-[12px] font-black text-slate-900">{(booking.activeSeatLabels || []).join(', ') || 'NA'}</p>
                {booking.seatSummary?.cancelled ? (
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{booking.seatSummary.cancelled} cancelled</p>
                ) : null}
              </div>
              <div className="rounded-[16px] border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Amount</p>
                <p className="mt-1 text-[12px] font-black text-slate-900">{formatMoney(booking.amount, booking.currency)}</p>
                {Number(booking.totalRefundedAmount || 0) > 0 ? (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">Refunded {formatMoney(booking.totalRefundedAmount, booking.currency)}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-[16px] border border-slate-100 px-3 py-3">
              <p className="text-[11px] font-semibold text-slate-500">Booked on {formatDateTime(booking.createdAt)}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
                View Details <MoveRight size={13} />
              </span>
            </div>
          </motion.button>
        )) : null}

        {!loading && !error && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between rounded-[20px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
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
