import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CircleAlert, Loader2, ReceiptText, ShieldAlert, Star, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import userBusService from '../../services/busService';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

const formatMoney = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

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

const unwrapPayload = (response) => response?.data?.data || response?.data || response || null;

const computeSelectionQuote = (booking, selectedSeatIds) => {
  const seatCount = Number(booking?.seatSummary?.total || 0);
  const selectedCount = selectedSeatIds.length;
  const perSeatAmount = Number(booking?.perSeatAmount || 0);
  const subtotal = Math.round(perSeatAmount * selectedCount * 100) / 100;
  const rule = booking?.cancellation || {};
  let refundAmount = 0;

  if (selectedCount <= 0 || !rule.allowed) {
    return {
      subtotal: 0,
      refundAmount: 0,
      chargeAmount: 0,
    };
  }

  if (rule.refundType === 'percentage') {
    refundAmount = Math.round(subtotal * Math.min(100, Number(rule.refundValue || 0)) / 100 * 100) / 100;
  } else if (rule.refundType === 'fixed') {
    refundAmount = Math.min(subtotal, Math.round(Number(rule.refundValue || 0) * 100) / 100);
  }

  if (seatCount <= 0) {
    refundAmount = 0;
  }

  return {
    subtotal,
    refundAmount,
    chargeAmount: Math.max(0, Math.round((subtotal - refundAmount) * 100) / 100),
  };
};

const BusBookingDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [cancelling, setCancelling] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    let active = true;

    const loadBooking = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await userBusService.getBookingById(id);
        if (!active) return;
        const nextBooking = unwrapPayload(response);
        setBooking(nextBooking);
        setSelectedSeatIds(Array.isArray(nextBooking?.activeSeatIds) ? nextBooking.activeSeatIds : []);
        setSelectedRating(Number(nextBooking?.review?.userRating || 0));
        setReviewComment(nextBooking?.review?.userComment || '');
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Unable to load booking details');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBooking();
    return () => {
      active = false;
    };
  }, [id]);

  const activeSeatIds = Array.isArray(booking?.activeSeatIds) ? booking.activeSeatIds : [];
  const activeSeatLabels = Array.isArray(booking?.activeSeatLabels) ? booking.activeSeatLabels : [];
  const canCancel = Boolean(booking?.cancellation?.allowed) && booking?.status === 'confirmed' && activeSeatIds.length > 0;
  const selectionQuote = computeSelectionQuote(booking, selectedSeatIds);
  const canRate = Boolean(booking?.review?.canRate);

  const toggleSeat = (seatId) => {
    setSelectedSeatIds((current) => (
      current.includes(seatId)
        ? current.filter((item) => item !== seatId)
        : [...current, seatId]
    ));
  };

  const handleCancelSeats = async () => {
    if (!booking || cancelling || selectedSeatIds.length === 0) return;

    try {
      setCancelling(true);
      const response = await userBusService.cancelBooking(booking.id, {
        seatIds: selectedSeatIds,
        travelDate: booking.travelDate,
      });
      const updatedBooking = unwrapPayload(response);
      setBooking(updatedBooking);
      setSelectedSeatIds(Array.isArray(updatedBooking?.activeSeatIds) ? updatedBooking.activeSeatIds : []);
      toast.success(response?.data?.message || response?.message || 'Selected seats cancelled successfully');
    } catch (err) {
      toast.error(err?.message || 'Unable to cancel selected seats');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking || !canRate || savingReview) return;
    if (!selectedRating) {
      toast.error('Please select a rating');
      return;
    }

    try {
      setSavingReview(true);
      const response = await userBusService.submitBookingReview(booking.id, {
        rating: selectedRating,
        comment: reviewComment,
      });
      const updatedBooking = unwrapPayload(response);
      setBooking(updatedBooking);
      setSelectedRating(Number(updatedBooking?.review?.userRating || 0));
      setReviewComment(updatedBooking?.review?.userComment || '');
      toast.success(response?.data?.message || response?.message || 'Bus rating saved');
    } catch (err) {
      toast.error(err?.message || 'Unable to save bus rating');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_18%,#f8fafc_100%)] max-w-lg mx-auto font-sans pb-12">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 px-5 pb-4 pt-10 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`${routePrefix}/profile/bus-bookings`)}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/80 bg-white/90 shadow-sm"
          >
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Bus Ticket</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900">Booking Details</h1>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-5">
        {loading ? (
          <div className="rounded-[22px] bg-white/90 p-8 text-center shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <Loader2 size={24} className="mx-auto animate-spin text-orange-500" />
            <p className="mt-3 text-[12px] font-black uppercase tracking-[0.22em] text-slate-500">Loading booking</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[18px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && booking ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
            >
              <div className="bg-slate-900 px-4 py-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Booking Code</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[17px] font-black">{booking.bookingCode}</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[18px] font-black text-slate-900">{booking.bus?.fromCity || 'From'} to {booking.bus?.toCity || 'To'}</p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">{booking.bus?.operator || 'Operator'} • {booking.bus?.type || 'Bus'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-black text-slate-900">{booking.travelDate || 'NA'}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{booking.bus?.departure || 'NA'} to {booking.bus?.arrival || 'NA'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] border border-slate-100 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Paid</p>
                    <p className="mt-1 text-[15px] font-black text-slate-900">{formatMoney(booking.amount, booking.currency)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Booked on {formatDateTime(booking.createdAt)}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-100 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Refunded</p>
                    <p className="mt-1 text-[15px] font-black text-slate-900">{formatMoney(booking.totalRefundedAmount, booking.currency)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">{booking.seatSummary?.cancelled || 0} seat(s) cancelled</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2">
                <Ticket size={15} className="text-orange-500" />
                <h2 className="text-[15px] font-black text-slate-900">Seat Summary</h2>
              </div>

              <div className="mt-4 space-y-3">
                {activeSeatIds.map((seatId, index) => (
                  <label
                    key={seatId}
                    className={`flex cursor-pointer items-center justify-between rounded-[18px] border px-4 py-3 transition ${
                      selectedSeatIds.includes(seatId) ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-slate-50'
                    } ${!canCancel ? 'cursor-default opacity-70' : ''}`}
                  >
                    <div>
                      <p className="text-[13px] font-black text-slate-900">{activeSeatLabels[index] || seatId}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">Active ticket • {formatMoney(booking.perSeatAmount, booking.currency)}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedSeatIds.includes(seatId)}
                      disabled={!canCancel}
                      onChange={() => toggleSeat(seatId)}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                ))}

                {Array.isArray(booking.cancelledSeats) && booking.cancelledSeats.length > 0 ? (
                  <div className="space-y-2">
                    <p className="pt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Cancelled Seats</p>
                    {booking.cancelledSeats.map((seat) => (
                      <div key={`${seat.seatId}-${seat.cancelledAt || ''}`} className="rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-black text-slate-900">{seat.seatLabel || seat.seatId}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">Cancelled on {formatDateTime(seat.cancelledAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-black text-emerald-600">{formatMoney(seat.refundAmount, booking.currency)}</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{seat.refundStatus || 'processed'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">Bus Rating</p>
                  <h2 className="mt-1 text-[15px] font-black text-slate-900">Rate your bus experience</h2>
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-black text-slate-900">{Number(booking.review?.averageRating || 0).toFixed(1)}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{booking.review?.ratingCount || 0} ratings</p>
                </div>
              </div>

              {canRate ? (
                <>
                  <p className="mt-3 text-[12px] font-semibold text-slate-600">
                    {booking.review?.userRating
                      ? 'Your trip is completed. You can update your rating here.'
                      : 'Your trip is completed. Share your rating for this bus.'}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setSelectedRating(score)}
                        className="rounded-full p-1"
                      >
                        <Star
                          size={24}
                          className={score <= selectedRating ? 'text-amber-500' : 'text-amber-200'}
                          fill={score <= selectedRating ? 'currentColor' : 'transparent'}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    maxLength={500}
                    placeholder="Tell us briefly how the bus journey was"
                    className="mt-4 min-h-[96px] w-full rounded-[18px] border border-amber-100 bg-white/90 px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={savingReview || !selectedRating}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] bg-slate-900 px-4 py-3 text-[12px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                  >
                    {savingReview ? 'Saving Rating...' : booking.review?.userRating ? 'Update Rating' : 'Submit Rating'}
                  </button>
                </>
              ) : (
                <div className="mt-4 rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3 text-[11px] font-semibold text-slate-600">
                  {booking.review?.tripCompleted
                    ? 'Rating will open when booking details refresh.'
                    : 'You can rate this bus after the travel date and trip time are completed.'}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-orange-100 bg-orange-50/80 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-orange-500" />
                <h2 className="text-[15px] font-black text-slate-900">Cancellation Policy</h2>
              </div>
              {booking.cancellationPolicy?.text ? (
                <p className="mt-3 text-[12px] font-semibold leading-5 text-slate-600">{booking.cancellationPolicy.text}</p>
              ) : null}

              <div className="mt-3 space-y-2">
                {(booking.cancellationPolicy?.rules || []).map((rule) => (
                  <div key={rule.id} className="rounded-[16px] bg-white/90 px-4 py-3">
                    <p className="text-[12px] font-black text-slate-900">{rule.label || 'Cancellation rule'}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Cancel at least {Number(rule.hoursBeforeDeparture || 0).toFixed(0)} hrs before departure • {rule.refundType === 'percentage' ? `${rule.refundValue}% refund` : rule.refundType === 'fixed' ? `${formatMoney(rule.refundValue, booking.currency)} refund` : 'No refund'}
                    </p>
                    {rule.notes ? (
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{rule.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[18px] border border-orange-100 bg-white/90 px-4 py-4">
                <div className="flex items-center gap-2">
                  <ReceiptText size={15} className="text-slate-700" />
                  <p className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Seat Refund Preview</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fare</p>
                    <p className="mt-1 text-[13px] font-black text-slate-900">{formatMoney(selectionQuote.subtotal, booking.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Refund</p>
                    <p className="mt-1 text-[13px] font-black text-emerald-600">{formatMoney(selectionQuote.refundAmount, booking.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Charge</p>
                    <p className="mt-1 text-[13px] font-black text-rose-500">{formatMoney(selectionQuote.chargeAmount, booking.currency)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-slate-500">
                  {booking.cancellation?.hoursBeforeDeparture > 0
                    ? `${Number(booking.cancellation.hoursBeforeDeparture).toFixed(1)} hrs left before departure.`
                    : 'Cancellation window details are shown above.'}
                </p>
              </div>

              {canCancel ? (
                <button
                  type="button"
                  onClick={handleCancelSeats}
                  disabled={cancelling || selectedSeatIds.length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] bg-slate-900 px-4 py-3 text-[12px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling Seats...' : `Cancel ${selectedSeatIds.length || 0} Selected Seat(s)`}
                </button>
              ) : (
                <div className="mt-4 flex items-start gap-2 rounded-[18px] border border-slate-200 bg-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-600">
                  <CircleAlert size={14} className="mt-0.5 shrink-0" />
                  <span>This booking is not currently eligible for more cancellations.</span>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default BusBookingDetail;
