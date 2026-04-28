import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Ticket, QrCode, Home, Share2 } from 'lucide-react';

const getRoutePrefix = (pathname = '') => (pathname.startsWith('/taxi/user') ? '/taxi/user' : '');

const formatTravelDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch (err) {
    return dateStr;
  }
};

const BusConfirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = getRoutePrefix(location.pathname);
  const state = location.state || {};
  const { booking, fromCity, toCity, date } = state;

  if (!booking?.bookingCode) {
    navigate(`${routePrefix}/bus`, { replace: true });
    return null;
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bus Ticket',
          text: `Ticket ${booking.bookingCode} for ${booking.bus?.fromCity || fromCity} to ${booking.bus?.toCity || toCity} on ${booking.travelDate || date}. Seats: ${(booking.seatLabels || booking.seatIds || []).join(', ')}`,
        });
      }
    } catch {
      // ignore share cancellation
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto font-sans pb-32">
      <div className="bg-white px-5 pt-10 pb-4 sticky top-0 z-20 border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">E-Ticket</h1>
          <button onClick={handleShare} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shadow-lg mb-6"
        >
          <CheckCircle2 size={32} className="text-white" />
        </motion.div>

        <motion.div 
          initial={{ y: 10, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.1 }} 
          className="text-center mb-10"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Booking Confirmed</p>
          <h2 className="text-2xl font-bold text-slate-900">Your ticket is ready</h2>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-6 bg-slate-900 text-white relative">
            <div className="flex justify-between items-center mb-8">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">PNR Number</p>
                <p className="text-lg font-bold tracking-widest">{booking.bookingCode}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Seat(s)</p>
                <p className="text-lg font-bold">{(booking.seatLabels || booking.seatIds || []).join(', ')}</p>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-1">{booking.bus?.operator}</h3>
            <p className="text-xs font-medium text-slate-400">{booking.bus?.type}</p>
          </div>

          <div className="p-6 space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xl font-bold text-slate-900">{booking.bus?.departure}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">{booking.bus?.fromCity || fromCity}</p>
              </div>
              <div className="flex flex-col items-center flex-1 px-2">
                <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-full">{booking.bus?.duration || 'Direct'}</span>
                <div className="w-full h-px border-t border-dashed border-slate-200 my-2" />
                <span className="text-[9px] font-bold text-slate-400">{formatTravelDate(booking.travelDate || date)}</span>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xl font-bold text-slate-900">{booking.bus?.arrival}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">{booking.bus?.toCity || toCity}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 flex justify-between items-center border border-slate-100">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passenger</p>
                <p className="text-sm font-bold text-slate-900">
                  {booking.passenger?.name}
                  <span className="text-slate-400 ml-2 font-medium">
                    ({booking.passenger?.age}{String(booking.passenger?.gender || '').charAt(0)})
                  </span>
                </p>
                <p className="mt-2 text-xs font-bold text-slate-500">Paid ₹{Number(booking.amount || 0)}</p>
              </div>
              <QrCode size={48} className="text-slate-900" strokeWidth={1.5} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-8 pt-4 bg-white border-t border-slate-100 z-30 flex gap-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(`${routePrefix}/activity`)}
          className="flex-1 bg-slate-50 text-slate-700 py-4 rounded-2xl text-sm font-bold border border-slate-100 transition-colors hover:bg-slate-100"
        >
          My Trips
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(`${routePrefix}` || '/')}
          className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <Home size={18} /> Home
        </motion.button>
      </div>
    </div>
  );
};

export default BusConfirm;
