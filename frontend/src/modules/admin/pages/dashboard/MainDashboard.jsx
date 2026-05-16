import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Car,
  CircleAlert,
  Clock,
  CreditCard,
  History,
  IndianRupee,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { BACKEND_LABEL } from '../../../../shared/api/runtimeConfig';

const currency = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

const CardWrapper = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
  </div>
);

const TopStatCard = ({ label, value, trend, icon: Icon, colorClass, isLoading, onClick, clickable = false }) => (
  <CardWrapper className={clickable ? 'hover:border-slate-300 transition-all cursor-pointer' : ''}>
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className="w-full p-5 text-left focus:outline-none"
    >
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-6 w-32 bg-slate-100 rounded" />
        </div>
      ) : (
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
              {trend !== undefined && (
                <span className={`text-[10px] font-bold flex items-center ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
          </div>
          <div className={`p-2.5 rounded-lg bg-slate-50 ${colorClass}`}>
            <Icon size={18} />
          </div>
        </div>
      )}
    </button>
  </CardWrapper>
);

const MiniStat = ({ label, value, icon: Icon, colorClass, isLoading }) => (
  <CardWrapper className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
    {isLoading ? (
      <div className="h-8 w-full animate-pulse bg-slate-50 rounded-lg" />
    ) : (
      <>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</p>
          <p className="text-[15px] font-bold text-slate-900 leading-none">₹ {value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-slate-50 group-hover:bg-white transition-colors ${colorClass}`}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
      </>
    )}
  </CardWrapper>
);

const SimpleDonut = ({ data, colors, totalLabel = "Total" }) => {
  const total = data.reduce((sum, val) => sum + Number(val || 0), 0);
  let cumulative = 0;

  return (
    <div className="relative flex items-center justify-center h-40 w-40">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        {data.map((val, i) => {
          const percent = total > 0 ? (val / total) * 100 : 0;
          const offset = total > 0 ? (cumulative / total) * 100 : 0;
          cumulative += val;
          return (
            <circle
              key={i}
              cx="18" cy="18" r="15.915"
              fill="transparent"
              stroke={colors[i]}
              strokeWidth="3.5"
              strokeDasharray={`${percent} ${100 - percent}`}
              strokeDashoffset={-offset}
              className="transition-all duration-700 ease-in-out"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{totalLabel}</span>
        <span className="text-xl font-bold text-slate-900">{total}</span>
      </div>
    </div>
  );
};

const EarningsLineChart = ({ points }) => {
  const safePoints = Array.isArray(points) && points.length ? points : [];
  const maxValue = Math.max(...safePoints.map(p => Number(p?.amount || 0)), 1);
  
  const chartPoints = safePoints.map((p, i) => ({
    ...p,
    x: safePoints.length === 1 ? 200 : (i / (safePoints.length - 1)) * 400,
    y: 90 - (Number(p?.amount || 0) / maxValue) * 70
  }));

  const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="w-full">
      <div className="relative h-32 w-full mt-4">
        <svg viewBox="0 0 400 100" className="h-full w-full preserve-3d" preserveAspectRatio="none">
          <path d={linePath} fill="transparent" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0F172A" className="hover:r-4 transition-all cursor-crosshair" />
          ))}
        </svg>
      </div>
      <div className="flex justify-between mt-4 px-1">
        {safePoints.map((p, i) => (
          <span key={i} className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{p.label}</span>
        ))}
      </div>
    </div>
  );
};

const MainDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetch = async (silent = false) => {
      try {
        silent ? setIsRefreshing(true) : setIsLoading(true);
        const res = await adminService.getDashboardData();
        if (!isMounted) return;
        setDashboard(res?.data || res || {});
        setDashboardError('');
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!isMounted) return;
        setDashboardError(`System offline. Connection to ${BACKEND_LABEL} failed.`);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    fetch();
    const interval = setInterval(() => fetch(true), DASHBOARD_REFRESH_INTERVAL_MS);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const todayTrips = dashboard?.todayTrips || {};
  const overallTrips = dashboard?.overallTrips || {};
  const todayEarnings = dashboard?.todayEarnings || {};
  const overallEarnings = dashboard?.overallEarnings || {};
  const notifiedSos = dashboard?.notifiedSos || {};

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8 font-['Inter']">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Simplified Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Overview</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Platform Metrics</span>
              {isRefreshing && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Live Syncing</span>
                </div>
              )}
            </div>
          </div>
          {lastUpdatedAt && (
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               Refreshed {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </p>
          )}
        </div>

        {dashboardError && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><CircleAlert size={18} /></div>
            <p className="text-sm font-semibold text-rose-900">{dashboardError}</p>
          </div>
        )}

        {/* Top KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <TopStatCard label="Registered Fleet" value={dashboard?.totalDrivers?.total || 0} icon={Car} colorClass="text-slate-600" isLoading={isLoading} clickable onClick={() => navigate('/admin/drivers')} />
          <TopStatCard label="Verified Operators" value={dashboard?.totalDrivers?.approved || 0} icon={ShieldCheck} colorClass="text-emerald-600" isLoading={isLoading} clickable onClick={() => navigate('/admin/drivers')} />
          <TopStatCard label="Pending Onboarding" value={dashboard?.totalDrivers?.declined || 0} icon={Clock} colorClass="text-amber-600" isLoading={isLoading} clickable onClick={() => navigate('/admin/drivers/pending')} />
          <TopStatCard label="Platform Users" value={dashboard?.totalUsers || 0} icon={Users} colorClass="text-blue-600" isLoading={isLoading} clickable onClick={() => navigate('/admin/users')} />
        </div>

        {/* Secondary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: SOS & Safety */}
          <div className="lg:col-span-4 space-y-6">
             <button 
               onClick={() => navigate('/admin/safety')}
               className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 h-full flex flex-col justify-between hover:border-slate-900 transition-all cursor-pointer group"
             >
                <SectionHeader title="SOS Monitor" subtitle="Active safety and support alerts" />
                <div className="py-8 flex flex-col items-center w-full">
                   <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-rose-500 group-hover:bg-rose-50 transition-all relative">
                      <Activity size={40} strokeWidth={1.5} />
                      {Number(notifiedSos.total || 0) > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                   </div>
                   <div className="mt-6 text-center">
                      <p className="text-4xl font-bold text-slate-900 leading-none">{notifiedSos.total || 0}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active Alerts</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-50 w-full">
                   <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">{notifiedSos.assigned || 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Assigned</p>
                   </div>
                   <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">{notifiedSos.closed || 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Closed</p>
                   </div>
                </div>
             </button>
          </div>

          {/* Right: Revenue Breakdown */}
          <div className="lg:col-span-8">
             <CardWrapper className="p-6">
                <SectionHeader title="Revenue Insights" subtitle="Daily transaction breakdown" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                   <MiniStat label="Total Volume" value={currency(todayEarnings.total)} icon={IndianRupee} colorClass="text-slate-900" isLoading={isLoading} />
                   <MiniStat label="Cash Flows" value={currency(todayEarnings.by_cash)} icon={Wallet} colorClass="text-emerald-600" isLoading={isLoading} />
                   <MiniStat label="Digital Wallet" value={currency(todayEarnings.by_wallet)} icon={Wallet} colorClass="text-blue-600" isLoading={isLoading} />
                   <MiniStat label="Card/Online" value={currency(todayEarnings.by_card)} icon={CreditCard} colorClass="text-indigo-600" isLoading={isLoading} />
                   <MiniStat label="Net Commission" value={currency(todayEarnings.admin_commission)} icon={ShieldCheck} colorClass="text-amber-600" isLoading={isLoading} />
                   <MiniStat label="Driver Payouts" value={currency(todayEarnings.driver_earnings)} icon={UserCheck} colorClass="text-slate-400" isLoading={isLoading} />
                </div>
                <div className="mt-10">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Performance Curve</p>
                   <EarningsLineChart points={overallEarnings.chart || []} />
                </div>
             </CardWrapper>
          </div>
        </div>

        {/* Lower Grid: Trips Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CardWrapper className="p-6">
             <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Daily Activity" subtitle="Real-time ride distribution" />
                <div className="flex gap-4">
                   <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-900" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Completed</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Cancelled</span></div>
                </div>
             </div>
             <div className="flex flex-col sm:flex-row items-center gap-12">
                <SimpleDonut data={[todayTrips.completed || 0, todayTrips.cancelled || 0, todayTrips.scheduled || 0]} colors={['#0F172A', '#F43F5E', '#38BDF8']} totalLabel="Rides" />
                <div className="flex-1 w-full space-y-4">
                   {[
                     { label: 'Successful Rides', val: todayTrips.completed || 0, color: 'bg-slate-900' },
                     { label: 'User/Driver Cancellations', val: todayTrips.cancelled || 0, color: 'bg-rose-500' },
                     { label: 'Advance Bookings', val: todayTrips.scheduled || 0, color: 'bg-sky-400' },
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full ${item.color}`} />
                           <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{item.val}</span>
                     </div>
                   ))}
                </div>
             </div>
          </CardWrapper>

          <CardWrapper className="p-6">
             <SectionHeader title="Platform Health" subtitle="Overall fleet performance metrics" />
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {[
                  { label: 'Overall Revenue', val: overallEarnings.total, icon: IndianRupee, color: 'text-slate-900' },
                  { label: 'Platform Commission', val: overallEarnings.admin_commission, icon: ShieldCheck, color: 'text-amber-600' },
                  { label: 'Total Fleet Payouts', val: overallEarnings.driver_earnings, icon: UserCheck, color: 'text-slate-400' },
                  { label: 'Overall Completed', val: overallTrips.completed || 0, icon: History, color: 'text-emerald-600', isCurrency: false },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-lg font-bold text-slate-900">{item.isCurrency === false ? item.val : `₹ ${currency(item.val)}`}</p>
                     </div>
                     <div className={`p-2 bg-white rounded-lg border border-slate-100 ${item.color}`}><item.icon size={16} /></div>
                  </div>
                ))}
             </div>
             <div className="mt-8">
                <button 
                  onClick={() => navigate('/admin/trips')}
                  className="w-full py-3 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                   View Detailed Analytics <ChevronRight size={14} />
                </button>
             </div>
          </CardWrapper>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
