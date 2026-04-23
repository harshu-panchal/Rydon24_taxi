import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgePercent, CheckCircle2, Loader2, Target, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DriverBottomNav from '../../shared/components/DriverBottomNav';
import { getDriverRideHistory } from '../services/registrationService';

const unwrap = (response) => response?.data?.results || response?.results || response?.data?.data?.results || [];

const isCompleted = (ride) => {
  const status = String(ride?.status || '').toLowerCase();
  const liveStatus = String(ride?.liveStatus || '').toLowerCase();
  return ['completed', 'delivered'].includes(status) || ['completed', 'delivered'].includes(liveStatus);
};

const getEarnings = (ride) => {
  const storedEarnings = Number(ride?.driverEarnings);
  if (Number.isFinite(storedEarnings) && storedEarnings > 0) {
    return storedEarnings;
  }

  const fare = Number(ride?.fare || 0);
  const commission = Number(ride?.commissionAmount || 0);
  if (commission > 0) {
    return Math.max(fare - commission, 0);
  }

  return fare;
};

const DriverIncentives = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadIncentives = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getDriverRideHistory({ limit: 100 });
        if (active) {
          setRides(unwrap(response));
        }
      } catch (requestError) {
        if (active) {
          setError(requestError?.message || 'Unable to load incentive progress');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadIncentives();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const completed = rides.filter(isCompleted);
    const totalEarnings = completed.reduce((sum, ride) => sum + getEarnings(ride), 0);
    const dailyTargetTrips = 10;
    const weeklyTargetTrips = 50;

    return {
      completedTrips: completed.length,
      totalEarnings,
      dailyProgress: Math.min(100, Math.round((completed.length / dailyTargetTrips) * 100)),
      weeklyProgress: Math.min(100, Math.round((completed.length / weeklyTargetTrips) * 100)),
      dailyRemaining: Math.max(0, dailyTargetTrips - completed.length),
      weeklyRemaining: Math.max(0, weeklyTargetTrips - completed.length),
    };
  }, [rides]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] font-sans pb-32">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/taxi/driver/profile')}
            className="h-10 w-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Rewards</p>
            <h1 className="text-[20px] font-black text-slate-900 leading-tight">Driver incentives</h1>
          </div>
        </div>
      </header>

      <main className="px-5 pt-5 space-y-4">
        <section className="rounded-[28px] bg-slate-950 text-white p-5 shadow-xl shadow-slate-900/10 overflow-hidden relative">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Current progress</p>
              <h2 className="mt-2 text-[34px] font-black leading-none">{stats.completedTrips}</h2>
              <p className="mt-1 text-[12px] font-bold text-white/55">completed trips counted from your real history</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Trophy size={24} className="text-emerald-300" />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white border border-slate-100 p-8 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="animate-spin" size={24} />
            <p className="text-[12px] font-black uppercase tracking-widest">Loading incentives</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 border border-rose-100 p-5 text-[13px] font-bold text-rose-600">
            {error}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white border border-slate-100 p-4">
                <BadgePercent size={18} className="text-emerald-500" />
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total earned</p>
                <p className="mt-1 text-[22px] font-black text-slate-900">Rs {stats.totalEarnings.toFixed(0)}</p>
              </div>
              <div className="rounded-3xl bg-white border border-slate-100 p-4">
                <CheckCircle2 size={18} className="text-sky-500" />
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Eligible trips</p>
                <p className="mt-1 text-[22px] font-black text-slate-900">{stats.completedTrips}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-slate-100 p-5 space-y-5">
              <h3 className="text-[15px] font-black text-slate-900">Active incentive goals</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-black text-slate-800 flex items-center gap-2"><Target size={15} /> Daily trip streak</p>
                  <p className="text-[11px] font-black text-emerald-600">{stats.dailyProgress}%</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.dailyProgress}%` }} />
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  {stats.dailyRemaining === 0 ? 'Daily target reached.' : `${stats.dailyRemaining} more completed trips needed for daily target.`}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-black text-slate-800 flex items-center gap-2"><Trophy size={15} /> Weekly booster</p>
                  <p className="text-[11px] font-black text-sky-600">{stats.weeklyProgress}%</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${stats.weeklyProgress}%` }} />
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  {stats.weeklyRemaining === 0 ? 'Weekly target reached.' : `${stats.weeklyRemaining} more completed trips needed for weekly target.`}
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <DriverBottomNav />
    </div>
  );
};

export default DriverIncentives;
