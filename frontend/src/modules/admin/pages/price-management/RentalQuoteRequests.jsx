import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  IndianRupee,
  MapPin,
  Phone,
  ShieldCheck,
  User2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/60';

const statusClasses = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-sky-50 text-sky-700',
  assigned: 'bg-emerald-50 text-emerald-700',
  end_requested: 'bg-orange-50 text-orange-700',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Not set');

const formatElapsed = (minutes = 0) =>
  `${Math.floor(Number(minutes || 0) / 60)}h ${String(Number(minutes || 0) % 60).padStart(2, '0')}m`;

const computeLiveMetrics = (item, nowMs) => {
  const status = String(item.status || '').toLowerCase();
  const finalElapsedMinutes = Number(item.finalElapsedMinutes || 0);
  const finalCharge = Number(item.finalCharge || 0);

  if (['end_requested', 'completed'].includes(status) && (finalElapsedMinutes > 0 || finalCharge > 0)) {
    return {
      elapsedMinutes: finalElapsedMinutes,
      currentCharge: finalCharge,
      remainingDue: Math.max(0, finalCharge - Number(item.payableNow || 0)),
    };
  }

  const assignedAt = item.assignedAt ? new Date(item.assignedAt).getTime() : NaN;
  const baseMetrics = item.rideMetrics || {};

  if (!Number.isFinite(assignedAt)) {
    return {
      elapsedMinutes: Number(baseMetrics.elapsedMinutes || 0),
      currentCharge: Number(baseMetrics.currentCharge || item.payableNow || 0),
      remainingDue: Number(baseMetrics.remainingDue || 0),
    };
  }

  const elapsedMinutes = Math.max(0, Math.ceil((nowMs - assignedAt) / 60000));
  const hourlyRate = Number(baseMetrics.hourlyRate || 0);
  const currentCharge = Math.min(
    Number(item.totalCost || 0),
    Math.max(Number(item.payableNow || 0), hourlyRate * (elapsedMinutes / 60)),
  );

  return {
    elapsedMinutes,
    currentCharge,
    remainingDue: Math.max(0, currentCharge - Number(item.payableNow || 0)),
  };
};

const RentalQuoteRequests = () => {
  const [items, setItems] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [requestsResponse, vehiclesResponse] = await Promise.all([
          adminService.getRentalBookingRequests(),
          adminService.getRentalVehicleTypes(),
        ]);

        const requests =
          requestsResponse?.data?.data?.results ||
          requestsResponse?.data?.results ||
          requestsResponse?.results ||
          [];
        const vehicles =
          vehiclesResponse?.data?.data?.results ||
          vehiclesResponse?.data?.results ||
          vehiclesResponse?.results ||
          [];

        if (!mounted) return;

        setItems(requests);
        setVehicleOptions(Array.isArray(vehicles) ? vehicles : []);
      } catch (error) {
        if (mounted) toast.error(error?.message || 'Could not load rental booking requests.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => items.filter((item) => ['pending', 'confirmed', 'assigned', 'end_requested'].includes(String(item.status || ''))).length,
    [items],
  );

  const activeRideCount = useMemo(
    () => items.filter((item) => ['assigned', 'end_requested'].includes(String(item.status || ''))).length,
    [items],
  );

  const updateLocal = (id, patch) => {
    setItems((current) =>
      current.map((item) => (String(item.id || item._id) === String(id) ? { ...item, ...patch } : item)),
    );
  };

  const saveRequest = async (item, overridePatch = {}) => {
    const id = String(item.id || item._id);
    const nextItem = { ...item, ...overridePatch };
    setSavingId(id);

    try {
      const updated = await adminService.updateRentalBookingRequest(id, {
        status: nextItem.status,
        assignedVehicleId: nextItem.assignedVehicleId || nextItem.assignedVehicle?.vehicleId || '',
        adminNote: nextItem.adminNote || '',
        cancelReason: nextItem.cancelReason || '',
      });
      const payload = updated?.data?.data || updated?.data || updated;
      updateLocal(id, payload);
      toast.success(
        nextItem.status === 'completed'
          ? 'Rental ride marked complete'
          : nextItem.status === 'assigned'
            ? 'Rental vehicle assigned'
            : 'Rental request updated',
      );
    } catch (error) {
      toast.error(error?.message || 'Could not update rental booking request.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rental Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track assigned rentals, watch elapsed time and charges, and confirm end-ride requests.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Open Requests</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live Rentals</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{activeRideCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400">Loading rental requests...</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400">No rental requests found.</div>
        ) : (
          items.map((item) => {
            const id = String(item.id || item._id);
            const rideMetrics = computeLiveMetrics(item, clockNow);
            const assignedVehicleId = item.assignedVehicleId || item.assignedVehicle?.vehicleId || '';
            const status = String(item.status || 'pending').toLowerCase();
            const statusClass = statusClasses[status] || statusClasses.pending;

            return (
              <div key={id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">{item.vehicleName || 'Rental Vehicle'}</h2>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>
                        {status.replace('_', ' ')}
                      </span>
                      {status === 'end_requested' ? (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700">
                          Admin confirmation needed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {item.vehicleCategory || 'Vehicle'} · {item.selectedPackage?.label || `${item.requestedHours || 0} hours`}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Booking Ref: {item.bookingReference || 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Planned Total</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">₹{Number(item.totalCost || 0).toFixed(0)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><Clock3 size={14} /><span className="text-xs font-bold uppercase tracking-wide">Elapsed</span></div>
                    <p className="mt-2 text-lg font-black text-slate-900">{formatElapsed(rideMetrics.elapsedMinutes)}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {item.assignedAt ? `Started ${formatDateTime(item.assignedAt)}` : 'Timer starts after assignment'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><IndianRupee size={14} /><span className="text-xs font-bold uppercase tracking-wide">Current Cost</span></div>
                    <p className="mt-2 text-lg font-black text-slate-900">₹{Number(rideMetrics.currentCharge || 0).toFixed(0)}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {status === 'end_requested' ? 'Frozen for admin review' : 'Live charge based on elapsed time'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><ShieldCheck size={14} /><span className="text-xs font-bold uppercase tracking-wide">Advance / Due</span></div>
                    <p className="mt-2 text-sm font-black text-emerald-700">Advance ₹{Number(item.payableNow || 0).toFixed(0)}</p>
                    <p className="text-xs font-semibold text-slate-500">Pending due ₹{Number(rideMetrics.remainingDue || 0).toFixed(0)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><Car size={14} /><span className="text-xs font-bold uppercase tracking-wide">Assigned Vehicle</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">
                      {item.assignedVehicle?.name || 'Not assigned yet'}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {item.assignedVehicle?.vehicleCategory || item.vehicleCategory || 'Rental'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><User2 size={14} /><span className="text-xs font-bold uppercase tracking-wide">Customer</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.userId?.name || item.contactName || 'Unknown user'}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.userId?.email || item.contactEmail || 'No email'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><Phone size={14} /><span className="text-xs font-bold uppercase tracking-wide">Phone</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.userId?.phone || item.contactPhone || 'No phone'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><CalendarDays size={14} /><span className="text-xs font-bold uppercase tracking-wide">Pickup</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{formatDateTime(item.pickupDateTime)}</p>
                    <p className="text-xs font-semibold text-slate-500">Return {formatDateTime(item.returnDateTime)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><MapPin size={14} /><span className="text-xs font-bold uppercase tracking-wide">Service Location</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.serviceLocation?.name || 'Not selected'}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.serviceLocation?.address || 'No address'}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trip Summary</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Package: {item.selectedPackage?.label || `${item.requestedHours || 0} hour rental`}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Payment: {item.paymentMethodLabel || item.paymentMethod || 'Not specified'} · Status {item.paymentStatus || 'pending'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {status === 'end_requested'
                        ? 'The customer has requested to end this rental. Review the frozen elapsed time and charge, then confirm completion.'
                        : item.adminNote || 'No admin note added yet.'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <select
                      value={assignedVehicleId}
                      onChange={(event) =>
                        updateLocal(id, {
                          assignedVehicleId: event.target.value,
                          status: event.target.value
                            ? ['completed', 'cancelled', 'end_requested'].includes(status)
                              ? item.status
                              : 'assigned'
                            : item.status,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select assigned vehicle</option>
                      {vehicleOptions.map((vehicle) => {
                        const vehicleId = String(vehicle.id || vehicle._id);
                        return (
                          <option key={vehicleId} value={vehicleId}>
                            {vehicle.name} {vehicle.vehicleCategory ? `· ${vehicle.vehicleCategory}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={item.status}
                      onChange={(event) => updateLocal(id, { status: event.target.value })}
                      className={inputClass}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="assigned">Assigned</option>
                      <option value="end_requested">End Requested</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <textarea
                      rows="4"
                      value={item.adminNote || ''}
                      onChange={(event) => updateLocal(id, { adminNote: event.target.value })}
                      className={inputClass}
                      placeholder="Add admin note or end-ride review notes"
                    />
                    {status === 'end_requested' ? (
                      <button
                        type="button"
                        onClick={() => saveRequest(item, { status: 'completed' })}
                        disabled={savingId === id}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {savingId === id ? 'Confirming...' : 'Confirm End Ride'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => saveRequest(item)}
                      disabled={savingId === id}
                      className="w-full rounded-xl bg-[#2e3c78] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#24305f] disabled:opacity-60"
                    >
                      {savingId === id ? 'Saving...' : 'Save Request'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RentalQuoteRequests;
