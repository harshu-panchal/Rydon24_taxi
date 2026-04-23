import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bell, AlertCircle, RefreshCw, Radio, Trash2, CheckCircle2 } from 'lucide-react';
import { getDriverNotifications, deleteDriverNotification, clearAllDriverNotifications } from '../../services/registrationService';
import toast from 'react-hot-toast';

const formatNotificationTime = (value) => {
  if (!value) {
    return 'Recently';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SkeletonCard = () => (
  <div className="animate-pulse rounded-[20px] bg-white/70 border border-white/80 p-4 flex items-start gap-3">
    <div className="w-10 h-10 rounded-[12px] bg-slate-200 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-200 rounded-full w-2/3" />
      <div className="h-2.5 bg-slate-100 rounded-full w-full" />
      <div className="h-2.5 bg-slate-100 rounded-full w-4/5" />
    </div>
  </div>
);

const DriverNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getDriverNotifications();
      setNotifications(response?.data?.results || []);
    } catch (requestError) {
      setError(requestError?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;

    setClearing(true);
    try {
      await clearAllDriverNotifications();
      setNotifications([]);
      toast.success('All notifications cleared', {
        icon: <CheckCircle2 size={18} className="text-emerald-500" />,
        className: 'font-bold text-[13px] rounded-2xl shadow-xl border border-emerald-50 bg-white',
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

  const handleRemoveSingle = async (id) => {
    try {
      await deleteDriverNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed', {
        className: 'font-bold text-[13px] rounded-2xl shadow-xl border border-slate-50 bg-white',
      });
    } catch (err) {
      toast.error('Failed to remove notification');
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const totalCount = useMemo(() => notifications.length, [notifications.length]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto font-sans pb-12 relative overflow-hidden">
      <div className="absolute -top-16 right-[-40px] h-44 w-44 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />
      <div className="absolute top-52 left-[-60px] h-52 w-52 rounded-full bg-slate-100/70 blur-3xl pointer-events-none" />

      <header className="bg-white/90 backdrop-blur-md px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/taxi/driver/home')} className="w-9 h-9 rounded-[12px] border border-white/80 bg-white/90 flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-slate-900" strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Inbox</p>
            <h1 className="text-[19px] font-black tracking-tight text-slate-900 leading-tight">Notifications</h1>
          </div>
          <div className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
            {totalCount}
          </div>
        </div>
      </header>

      <div className="px-5 pt-4 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Admin & System Alerts</p>
          <div className="flex items-center gap-4">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing || loading}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-500 active:scale-95 transition-all disabled:opacity-50"
              >
                <Trash2 size={12} strokeWidth={2.5} />
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={fetchNotifications}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all"
            >
              <RefreshCw size={12} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {loading && Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 bg-white/80 border border-white/80 rounded-3xl flex items-center justify-center">
              <AlertCircle size={28} className="text-red-400" strokeWidth={2} />
            </div>
            <p className="text-[14px] font-black text-slate-700">{error}</p>
            <button
              type="button"
              onClick={fetchNotifications}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              <RefreshCw size={13} strokeWidth={2.5} />
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 bg-white/80 border border-white/80 rounded-3xl flex items-center justify-center">
              <Bell size={36} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[16px] font-black text-slate-700">No notifications yet</p>
              <p className="text-[12px] font-bold text-slate-400 mt-1">Admin notifications will appear here automatically</p>
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {!loading && !error && notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative rounded-[20px] border border-white/80 bg-white p-4 flex items-start gap-3 transition-all shadow-[0_4px_14px_rgba(15,23,42,0.07)]"
            >
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 bg-emerald-50">
                <Radio size={16} className="text-emerald-500" strokeWidth={2.3} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] leading-tight font-black text-slate-900">{notification.title || 'Notification'}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {formatNotificationTime(notification.sentAt)}
                    </span>
                    <button
                      onClick={() => handleRemoveSingle(notification.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">{notification.body || 'No message'}</p>
                
                {notification.image && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                    <img 
                      src={notification.image} 
                      alt="Notification content" 
                      className="w-full h-auto max-h-[180px] object-cover"
                    />
                  </div>
                )}

                {notification.serviceLocationName ? (
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">
                    {notification.serviceLocationName}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DriverNotifications;
