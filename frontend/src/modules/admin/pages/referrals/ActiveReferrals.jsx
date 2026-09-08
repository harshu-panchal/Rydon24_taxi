import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, Search, UserRound, Car, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

// Local calendar date as YYYY-MM-DD. toISOString() converts to UTC first and
// would hand back yesterday for anyone east of Greenwich.
const toLocalDateInput = (date) => {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const daysAgo = (count) => {
  const date = new Date();
  date.setDate(date.getDate() - count);

  return toLocalDateInput(date);
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'Users' },
  { key: 'driver', label: 'Drivers' },
];

const ActiveReferrals = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [paginator, setPaginator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const latestRequestId = useRef(0);
  const hasLoadedRef = useRef(false);

  const loadLogs = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const initialLoad = !hasLoadedRef.current;

    try {
      setLoading(initialLoad);
      setRefreshing(!initialLoad);
      const response = await adminService.getReferralLogs(page, itemsPerPage, {
        search: searchTerm.trim(),
        dateFrom,
        dateTo,
        type,
      });

      if (requestId !== latestRequestId.current) {
        return;
      }

      setRows(Array.isArray(response?.data?.results) ? response.data.results : []);
      setSummary(response?.data?.summary || null);
      setPaginator(response?.data?.paginator || null);
      hasLoadedRef.current = true;
    } catch (error) {
      if (requestId === latestRequestId.current) {
        toast.error(error?.message || 'Unable to load referrals.');
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, itemsPerPage, searchTerm, dateFrom, dateTo, type]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadLogs, searchTerm.trim() ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLogs, searchTerm]);

  const totalPages = Math.max(1, Number(paginator?.last_page || 1));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const totalEntries = Number(paginator?.total || 0);
  const startIndex = (safePage - 1) * Number(paginator?.per_page || itemsPerPage);
  const showingFrom = totalEntries === 0 ? 0 : startIndex + 1;
  const showingTo = totalEntries === 0 ? 0 : Math.min(startIndex + rows.length, totalEntries);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <span>Referrals</span>
          <ChevronRight size={12} />
          <span className="text-slate-700">Active Referrals</span>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Active Referrals</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Every signup that came through someone else&apos;s referral code. Signups brought in by an agent
            are excluded here and tracked under Employee Management.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, phone, or referrer code..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(event) => {
                  setItemsPerPage(Number(event.target.value) || 25);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none"
              >
                {[10, 25, 50].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <span>entries</span>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-400" htmlFor="referral-log-from">
                    Referred from
                  </label>
                  <input
                    id="referral-log-from"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-400" htmlFor="referral-log-to">
                    To
                  </label>
                  <input
                    id="referral-log-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Today', from: daysAgo(0), to: daysAgo(0) },
                    { label: 'Last 7 days', from: daysAgo(6), to: daysAgo(0) },
                    { label: 'Last 30 days', from: daysAgo(29), to: daysAgo(0) },
                  ].map((preset) => {
                    const active = dateFrom === preset.from && dateTo === preset.to;

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setDateFrom(preset.from);
                          setDateTo(preset.to);
                          setPage(1);
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}

                  {dateFrom || dateTo ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                        setPage(1);
                      }}
                      className="rounded-xl px-3 py-2 text-xs font-black text-slate-500 underline-offset-4 transition-all hover:text-slate-800 hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>

              {summary ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">
                    {summary.userReferrals} users
                  </span>
                  <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                    {summary.driverReferrals} drivers
                  </span>
                  <span className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">
                    {summary.totalReferrals} referrals{summary.filtered ? ' in range' : ' all time'}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setType(tab.key);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                    type === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {refreshing ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <Loader2 size={12} className="animate-spin" />
              Updating referrals
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Joined As</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Name</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Phone</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Referred By</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Code Used</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Referred On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="rounded-3xl bg-slate-100 p-4 text-slate-400">
                          <UserRound size={28} />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900">
                            {summary?.filtered ? 'No referrals in these dates' : 'No referrals yet'}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {summary?.filtered
                              ? 'Nobody signed up through a referral code in the selected range.'
                              : 'Signups that use someone’s referral code will appear here.'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={`${row.type}-${row._id}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                        row.type === 'driver' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        {row.type === 'driver' ? <Car size={12} /> : <User size={12} />}
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900">{row.name || 'Unknown'}</td>
                    <td className="px-4 py-4 font-medium">{row.phone || 'N/A'}</td>
                    <td className="px-4 py-4">
                      {row.referrerName ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{row.referrerName}</span>
                          {row.referrerPhone ? (
                            <span className="text-xs font-semibold text-slate-400">{row.referrerPhone}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold italic text-slate-400">Referrer removed</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {row.referrerCode ? (
                        <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-700">
                          {row.referrerCode}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(row.referredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Showing {showingFrom} to {showingTo} of {totalEntries}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-black text-slate-500">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveReferrals;
