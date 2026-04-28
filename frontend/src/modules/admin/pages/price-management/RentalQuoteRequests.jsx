import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Car, Clock3, IndianRupee, MessageSquareText, Phone, User2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/60';

const statusClasses = {
  pending: 'bg-amber-50 text-amber-700',
  reviewing: 'bg-sky-50 text-sky-700',
  quoted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
};

const RentalQuoteRequests = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await adminService.getRentalQuoteRequests();
        const results = response?.data?.data?.results || response?.data?.results || response?.results || [];
        if (mounted) setItems(results);
      } catch (error) {
        if (mounted) toast.error(error?.message || 'Could not load rental quote requests.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items]);

  const updateLocal = (id, patch) => {
    setItems((current) =>
      current.map((item) => (String(item.id || item._id) === String(id) ? { ...item, ...patch } : item)),
    );
  };

  const saveRequest = async (item) => {
    const id = String(item.id || item._id);
    setSavingId(id);
    try {
      const updated = await adminService.updateRentalQuoteRequest(id, {
        status: item.status,
        adminQuotedAmount: Number(item.adminQuotedAmount || 0),
        adminNote: item.adminNote || '',
      });
      const payload = updated?.data?.data || updated?.data || updated;
      updateLocal(id, payload);
      toast.success('Rental quote request updated');
    } catch (error) {
      toast.error(error?.message || 'Could not update rental quote request.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rental Quote Requests</h1>
          <p className="mt-1 text-sm text-slate-500">Review custom rental quote requests submitted from the user app.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pending Review</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{pendingCount}</p>
        </div>
      </div>

      <div className="space-y-5">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400">Loading quote requests...</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400">No rental quote requests found.</div>
        ) : (
          items.map((item) => {
            const id = String(item.id || item._id);
            return (
              <div key={id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">{item.vehicleName || 'Rental Vehicle'}</h2>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClasses[item.status] || statusClasses.pending}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{item.vehicleCategory || 'Vehicle'} · {item.requestedHours || 0} hours requested</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Admin Quote</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">₹{Number(item.adminQuotedAmount || 0)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><User2 size={14} /><span className="text-xs font-bold uppercase tracking-wide">Contact</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.contactName}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.contactEmail || 'No email'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><Phone size={14} /><span className="text-xs font-bold uppercase tracking-wide">Phone</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.contactPhone}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><CalendarDays size={14} /><span className="text-xs font-bold uppercase tracking-wide">Pickup</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.pickupDateTime ? new Date(item.pickupDateTime).toLocaleString() : 'Not set'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500"><Clock3 size={14} /><span className="text-xs font-bold uppercase tracking-wide">Seats / Bags</span></div>
                    <p className="mt-2 text-sm font-black text-slate-900">{item.seatsNeeded || 1} seats · {item.luggageNeeded || 0} bags</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trip Requirement</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{item.pickupLocation || 'Pickup not provided'} to {item.dropLocation || 'Drop not provided'}</p>
                    <p className="mt-3 text-sm text-slate-500">{item.specialRequirements || 'No extra requirement added by user.'}</p>
                  </div>
                  <div className="space-y-3">
                    <select
                      value={item.status}
                      onChange={(event) => updateLocal(id, { status: event.target.value })}
                      className={inputClass}
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="quoted">Quoted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <div className="relative">
                      <IndianRupee size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        value={item.adminQuotedAmount || 0}
                        onChange={(event) => updateLocal(id, { adminQuotedAmount: event.target.value })}
                        className={`${inputClass} pl-10`}
                        placeholder="Quoted amount"
                      />
                    </div>
                    <textarea
                      rows="4"
                      value={item.adminNote || ''}
                      onChange={(event) => updateLocal(id, { adminNote: event.target.value })}
                      className={inputClass}
                      placeholder="Add admin note or quoted offer details"
                    />
                    <button
                      type="button"
                      onClick={() => saveRequest(item)}
                      disabled={savingId === id}
                      className="w-full rounded-xl bg-[#2e3c78] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#24305f] disabled:opacity-60"
                    >
                      {savingId === id ? 'Saving...' : 'Save Review'}
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
