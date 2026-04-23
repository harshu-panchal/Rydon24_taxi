import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Car, 
  CheckCircle2, 
  Clock, 
  Wallet, 
  IndianRupee, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  CircleAlert,
  ChevronRight,
  TrendingDown,
  Zap,
  MoreHorizontal,
  Bell,
  Search,
  ShieldCheck,
  CreditCard,
  UserCheck,
  UserPlus,
  SearchIcon,
  ShieldAlert
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { BACKEND_LABEL } from '../../../../shared/api/runtimeConfig';

const TopStatCard = ({ label, value, trend, icon: Icon, color, isLoading }) => (
  <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm relative overflow-hidden group min-h-[140px]">
    {isLoading ? (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
        <div className="h-8 bg-gray-100 rounded w-3/4"></div>
      </div>
    ) : (
      <>
        <div className="flex justify-between items-start mb-3">
           <div>
             <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-1.5">{label}</p>
             <h4 className="text-2xl font-semibold text-gray-950 tracking-tight leading-none">{value}</h4>
           </div>
           {trend !== undefined && (
             <div className={`flex items-center gap-1 text-[10px] font-semibold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(trend)}%
             </div>
           )}
        </div>
        <div className="flex justify-end">
           <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-500 border border-${color}-100 flex items-center justify-center shadow-sm`}>
              <Icon size={18} strokeWidth={2.5} />
           </div>
        </div>
      </>
    )}
  </div>
);

const MiniStat = ({ label, value, icon: Icon, color, isLoading }) => (
  <div className="bg-gray-50/50 p-4 rounded-[20px] border border-gray-100 flex items-center justify-between group hover:bg-white transition-all cursor-default min-h-[64px]">
    {isLoading ? (
      <div className="animate-pulse flex-1 h-4 bg-gray-100 rounded w-full"></div>
    ) : (
      <>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 leading-none">{label}</p>
          <p className="text-[15px] font-semibold text-gray-950 tracking-tight leading-none">₹ {value}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg bg-${color}-200/20 text-${color}-600 border border-${color}-200/50 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
           <Icon size={14} strokeWidth={2.5} />
        </div>
      </>
    )}
  </div>
);

const SimpleDonut = ({ data, colors }) => {
  const total = data.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  
  return (
    <div className="relative w-48 h-48 flex items-center justify-center mx-auto">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        {data.map((val, i) => {
          const percent = (val / total) * 100;
          const offset = (cumulative / total) * 100;
          cumulative += val;
          return (
            <circle
              key={i}
              cx="18" cy="18" r="15.915"
              fill="transparent"
              stroke={colors[i]}
              strokeWidth="4"
              strokeDasharray={`${percent} ${100 - percent}`}
              strokeDashoffset={-offset}
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Total</p>
        <p className="text-xl font-bold text-gray-950 tracking-tight leading-none">{total}</p>
      </div>
    </div>
  );
};

const SimpleBarChart = ({ data, colors }) => (
  <div className="flex items-end gap-3 h-48 px-4 justify-between w-full">
     {data.map((val, i) => (
       <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <div className="relative w-full overflow-hidden rounded-lg bg-gray-50 h-full flex items-end">
            <div 
              style={{ height: `${(val / Math.max(...data)) * 100}%` }}
              className={`w-full bg-${colors[i]}-500/80 group-hover:bg-${colors[i]}-500 transition-all duration-500 rounded-t-sm`}
            />
          </div>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            {['Jan','Feb','Mar','Apr'][i]}
          </span>
       </div>
     ))}
  </div>
);

const MainDashboard = () => {
  const [stats, setStats] = useState({
    total_users: 0,
    total_drivers: 0,
    approved_drivers: 0,
    pending_drivers: 0,
    isLoading: true
  });
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const dashboardData = await adminService.getDashboardData();
        const data = dashboardData?.data || dashboardData;
        setDashboardError('');

        setStats({
          total_users: data?.totalUsers || 0,
          total_drivers: data?.totalDrivers?.total || 0,
          approved_drivers: data?.totalDrivers?.approved || 0, 
          pending_drivers: data?.totalDrivers?.declined || 0,
          isLoading: false
        });
      } catch (err) {
        console.error('Dashboard Fetch Error:', err);
        setDashboardError(`Dashboard data is unavailable right now. Start the backend on ${BACKEND_LABEL} to load live metrics.`);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchDashboardData();
  }, []);

  const { isLoading } = stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans text-gray-950 bg-[#f8fbff] -m-8 p-8 min-h-screen">
      
      {/* ── HEADER (Compact) ── */}
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 leading-none uppercase">Dashboard</h1>
         </div>
         <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Dashboard <ChevronRight size={12} className="mt-0.5" /> Dashboard
         </div>
      </div>
      {dashboardError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <CircleAlert size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Backend Offline</p>
            <p className="text-sm font-semibold text-amber-900 mt-1">{dashboardError}</p>
          </div>
        </div>
      ) : null}

      {/* ── TOP STATS ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <TopStatCard 
            label="DRIVERS REGISTERED" 
            value={stats?.total_drivers || "0"} 
            trend={100} 
            icon={UserPlus} 
            color="emerald" 
            isLoading={isLoading}
         />
         <TopStatCard 
            label="APPROVED DRIVERS" 
            value={stats?.approved_drivers || "0"} 
            trend={100} 
            icon={ShieldCheck} 
            color="blue" 
            isLoading={isLoading}
         />
         <TopStatCard 
            label="WAITING APPROVAL" 
            value={stats?.pending_drivers || "0"} 
            trend={0} 
            icon={Clock} 
            color="amber" 
            isLoading={isLoading}
         />
         <TopStatCard 
            label="USERS REGISTERED" 
            value={stats?.total_users || "0"} 
            trend={100} 
            icon={Users} 
            color="indigo" 
            isLoading={isLoading}
         />
      </div>

      {/* ── SOS SECTION ── */}
      <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-sm p-8 text-center space-y-4">
         <h3 className="text-left text-[14px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Notified SOS</h3>
         <div className="py-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-blue-50/50 rounded-full flex items-center justify-center relative mb-4">
               <div className="absolute inset-0 border-2 border-dashed border-blue-200 rounded-full animate-[spin_10s_linear_infinite]"></div>
               <div className="bg-white p-4 rounded-2xl shadow-xl border border-blue-50 relative z-10">
                  <div className="relative">
                     <History size={32} className="text-blue-500" />
                     <Search size={16} className="absolute -bottom-1 -right-1 text-gray-950 font-semibold p-0.5 bg-white rounded-full border border-gray-100" />
                  </div>
               </div>
            </div>
            <p className="text-[16px] font-semibold text-gray-950 uppercase tracking-tight">No Data Found</p>
         </div>
      </div>

      {/* ── TODAY PROGRESS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 ring-0">
         
         {/* Today Trips Chart Section */}
         <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
            <h3 className="text-[14px] font-semibold text-gray-400 uppercase tracking-wider mb-10">Today Trips</h3>
            <div className="flex-1 flex flex-col md:flex-row items-center gap-10">
               <div className="flex-1">
                  <SimpleDonut data={[1, 0, 0]} colors={['#3B4687', '#EB5757', '#2D9CDB']} />
               </div>
               <div className="space-y-4 min-w-[160px]">
                  {[
                    { l: 'Completed Rides', c: '#3B4687' },
                    { l: 'Cancelled Rides', c: '#EB5757' },
                    { l: 'Scheduled Rides', c: '#2D9CDB' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded-sm" style={{backgroundColor: item.c}} />
                       <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-tight leading-none">{item.l}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Today Stats Section */}
         <div className="grid grid-cols-2 gap-4 h-full">
            <MiniStat label="Today Earnings" value="145.00" icon={IndianRupee} color="blue" />
            <MiniStat label="By Cash" value="145.00" icon={Wallet} color="emerald" />
            <MiniStat label="By Wallet" value="0.00" icon={Wallet} color="amber" />
            <MiniStat label="By Card/Online" value="0.00" icon={CreditCard} color="rose" />
            <MiniStat label="Admin Commission" value="19.45" icon={ShieldCheck} color="indigo" />
            <MiniStat label="Drivers Earnings" value="125.55" icon={UserCheck} color="gray" />
         </div>

      </div>

      {/* ── OVERALL PROGRESS GRID ── */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm w-full">
          <h3 className="text-[14px] font-semibold text-gray-400 uppercase tracking-wider mb-10">Overall Trips</h3>
          <div className="flex flex-col md:flex-row items-center gap-10">
             <div className="flex justify-center w-full md:w-auto md:flex-1">
                <SimpleDonut data={[1, 0, 0]} colors={['#2D9CDB', '#EB5757', '#27AE60']} />
             </div>
             <div className="space-y-4 min-w-[160px] md:pr-10">
                {[
                  { l: 'Completed Rides', c: '#2D9CDB' },
                  { l: 'Cancelled Rides', c: '#EB5757' },
                  { l: 'Scheduled Rides', c: '#27AE60' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-sm" style={{backgroundColor: item.c}} />
                     <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-tight leading-none">{item.l}</span>
                  </div>
                ))}
             </div>
          </div>
      </div>

      {/* ── OVERALL EARNINGS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Overall Earnings chart */}
         <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
            <h3 className="text-[14px] font-semibold text-gray-400 uppercase tracking-wider mb-10">Overall Earnings</h3>
            <div className="relative h-48 w-full mt-auto">
               <svg viewBox="0 0 400 100" className="w-full h-full">
                  <path 
                    d="M 0 90 L 100 88 L 200 89 L 300 85 L 400 60" 
                    fill="transparent" 
                    stroke="#27AE60" 
                    strokeWidth="3" 
                    className="animate-[draw_2s_ease-out_forwards]"
                  />
                  <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="#27AE60" stopOpacity="0.2"/>
                     <stop offset="100%" stopColor="#27AE60" stopOpacity="0"/>
                  </linearGradient>
                  <path 
                    d="M 0 90 L 100 88 L 200 89 L 300 85 L 400 60 L 400 100 L 0 100 Z" 
                    fill="url(#lineFill)"
                  />
               </svg>
               <div className="flex justify-between items-center px-2 mt-4">
                  {['Jan','Feb','Mar','Apr'].map((m,i) => (
                     <span key={i} className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{m}</span>
                  ))}
               </div>
            </div>
         </div>
         
         {/* Overall Stats grid */}
         <div className="grid grid-cols-2 gap-4 h-full">
            <MiniStat label="Overall Earnings" value="145.00" icon={IndianRupee} color="rose" />
            <MiniStat label="By Cash" value="145.00" icon={Wallet} color="amber" />
            <MiniStat label="By Wallet" value="0.00" icon={Wallet} color="emerald" />
            <MiniStat label="By Card/Online" value="0.00" icon={CreditCard} color="blue" />
            <MiniStat label="Admin Commission" value="19.45" icon={ShieldCheck} color="indigo" />
            <MiniStat label="Drivers Earnings" value="125.55" icon={UserCheck} color="gray" />
         </div>
      </div>

      {/* ── CANCELLATION SUMMARY GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Cancellation Bar Chart */}
         <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
            <h3 className="text-[14px] font-semibold text-gray-400 uppercase tracking-wider mb-10">Cancellation Chart</h3>
            <div className="h-48 w-full mt-auto">
               <SimpleBarChart data={[0, 0, 0, 1]} colors={['emerald', 'amber', 'rose', 'emerald']} />
            </div>
            <div className="flex justify-center flex-wrap gap-4 mt-8">
                {[
                  { l: 'Cancelled Due to No Drivers', c: '#3F51B5' },
                  { l: 'Cancelled By Users', c: '#FFB300' },
                  { l: 'Cancelled By Drivers', c: '#009688' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.c}} />
                     <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tight">{item.l}</span>
                  </div>
                ))}
            </div>
         </div>
         
         {/* Cancel Stats grid */}
         <div className="grid grid-cols-2 gap-4 h-full">
            <div className="bg-white p-6 rounded-[28px] border border-gray-50 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 leading-none">Total Request Cancelled</p>
                  <p className="text-2xl font-semibold text-gray-950 tracking-tight leading-none">1</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                  <UserPlus size={18} />
               </div>
            </div>
            <div className="bg-white p-6 rounded-[28px] border border-gray-50 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1 leading-none">Cancelled By Users</p>
                  <p className="text-2xl font-semibold text-gray-950 tracking-tight leading-none">0</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                  <CircleAlert size={18} />
               </div>
            </div>
            <div className="bg-white p-6 rounded-[28px] border border-gray-50 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1 leading-none">Cancelled By Drivers</p>
                  <p className="text-2xl font-semibold text-gray-950 tracking-tight leading-none">1</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <Car size={18} />
               </div>
            </div>
            <div className="bg-white p-6 rounded-[28px] border border-gray-50 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 leading-none">Dispatcher Cancelled</p>
                  <p className="text-2xl font-semibold text-gray-950 tracking-tight leading-none">0</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <Zap size={18} />
               </div>
            </div>
         </div>
      </div>

    </div>
  );
};

export default MainDashboard;
