import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Filter,
  LayoutDashboard,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearDriverAuthState, getCurrentDriver } from '../services/registrationService';
import BusDriverBottomNav from '../components/BusDriverBottomNav';
import {
  createBusDriverReservation,
  getBusDriverBookings,
  getBusDriverSeatLayout,
} from '../services/busDriverService';

const unwrap = (response) => response?.data?.data || response?.data || response;
const unwrapResults = (response) => response?.data?.results || response?.results || [];
const createToday = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (value, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getNextTravelDate = (schedule) => {
  const activeDays = Array.isArray(schedule?.activeDays) ? schedule.activeDays : [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let index = 0; index < 14; index += 1) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + index);
    const label = dayLabels[nextDate.getDay()];
    if (activeDays.length === 0 || activeDays.includes(label)) {
      return nextDate.toISOString().slice(0, 10);
    }
  }

  return createToday();
};

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
  { id: 'desk', label: 'Seat Desk', Icon: Bus },
  { id: 'bookings', label: 'Bookings', Icon: ClipboardList },
];

const getCalendarMatrix = (value) => {
  const sourceDate = value ? new Date(value) : new Date();
  const year = sourceDate.getFullYear();
  const month = sourceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < startDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    cells.push({
      label: day,
      value: cellDate.toISOString().slice(0, 10),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const SeatDeck = ({ title, rows, selectedSeatIds, onToggle }) => {
  if (!rows?.length) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Coach
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={`${title}-${rowIndex}`} className="grid grid-cols-5 gap-2">
            {row.map((seat, cellIndex) => {
              if (!seat || seat.kind !== 'seat') {
                return <div key={`${title}-${rowIndex}-${cellIndex}`} className="h-10 rounded-xl bg-slate-100/70" />;
              }

              const isBooked = seat.status === 'booked';
              const isSelected = selectedSeatIds.includes(seat.id);

              return (
                <button
                  key={`${title}-${seat.id}`}
                  type="button"
                  disabled={isBooked}
                  onClick={() => onToggle(seat)}
                  className={`relative h-10 rounded-xl border text-[10px] font-black transition ${
                    isBooked
                      ? 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-500'
                      : isSelected
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-slate-200/90" />
                  {seat.label || seat.id}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

const StatCard = ({ label, value, tone = 'light', Icon }) => (
  <div className={`rounded-2xl p-4 ${tone === 'dark' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-900'} shadow-sm`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${tone === 'dark' ? 'text-white/55' : 'text-slate-400'}`}>{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      {Icon ? (
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>
          <Icon size={20} />
        </div>
      ) : null}
    </div>
  </div>
);

const BusDriverHome = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [layout, setLayout] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [travelDate, setTravelDate] = useState(createToday());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deskError, setDeskError] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [passenger, setPassenger] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phone: '',
    email: '',
    notes: '',
  });

  const busService = profile?.busService || null;
  const schedules = Array.isArray(busService?.schedules) ? busService.schedules : [];
  const selectedSchedule =
    schedules.find((item) => item.id === selectedScheduleId) || schedules[0] || null;
  const calendarCells = useMemo(() => getCalendarMatrix(calendarMonth), [calendarMonth]);
  const calendarLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
    [calendarMonth],
  );

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await getCurrentDriver();
        const data = unwrap(response);
        if (!active) return;
        setProfile(data);

        const firstSchedule = Array.isArray(data?.busService?.schedules) ? data.busService.schedules[0] : null;
        if (firstSchedule?.id) {
          setSelectedScheduleId(firstSchedule.id);
          const nextDate = getNextTravelDate(firstSchedule);
          setTravelDate(nextDate);
          const parsedDate = new Date(nextDate);
          setCalendarMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
        }
      } catch (error) {
        if (!active) return;
        toast.error(error?.message || 'Unable to load bus driver profile');
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedScheduleId || !travelDate) {
      return;
    }

    let active = true;

    const loadDesk = async () => {
      setLoadingDesk(true);
      setDeskError('');
      try {
        const [layoutResponse, bookingsResponse] = await Promise.all([
          getBusDriverSeatLayout({ scheduleId: selectedScheduleId, date: travelDate }),
          getBusDriverBookings({ scheduleId: selectedScheduleId, date: travelDate }),
        ]);

        if (!active) return;
        setLayout(unwrap(layoutResponse));
        setBookings(unwrapResults(bookingsResponse));
      } catch (error) {
        if (!active) return;
        setDeskError(error?.message || 'Unable to load seat desk');
        setLayout(null);
        setBookings([]);
      } finally {
        if (active) {
          setLoadingDesk(false);
        }
      }
    };

    loadDesk();

    return () => {
      active = false;
    };
  }, [selectedScheduleId, travelDate]);

  useEffect(() => {
    if (!travelDate) {
      return;
    }

    const parsedDate = new Date(travelDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    setCalendarMonth((current) => {
      if (
        current.getFullYear() === parsedDate.getFullYear() &&
        current.getMonth() === parsedDate.getMonth()
      ) {
        return current;
      }

      return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
    });
  }, [travelDate]);

  const selectedFare = useMemo(
    () => selectedSeats.length * Number(busService?.seatPrice || 0),
    [selectedSeats, busService?.seatPrice],
  );

  const todaysManualReservations = useMemo(
    () => bookings.filter((item) => item.bookingSource === 'bus_driver').length,
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase();

    return bookings.filter((booking) => {
      const sourceLabel = booking.bookingSource === 'bus_driver' ? 'manual' : 'user';
      const matchesFilter =
        bookingFilter === 'all'
          ? true
          : bookingFilter === 'manual'
            ? booking.bookingSource === 'bus_driver'
            : booking.status === bookingFilter || sourceLabel === bookingFilter;

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableValues = [
        booking.bookingCode,
        booking.passenger?.name,
        booking.passenger?.phone,
        booking.passenger?.email,
        booking.seatLabels?.join(' '),
        booking.notes,
      ];

      return searchableValues.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [bookingFilter, bookingSearch, bookings]);

  const handleToggleSeat = (seat) => {
    setSelectedSeats((current) =>
      current.some((item) => item.id === seat.id)
        ? current.filter((item) => item.id !== seat.id)
        : [...current, { id: seat.id, label: seat.label || seat.id }],
    );
  };

  const refreshDesk = async () => {
    if (!selectedScheduleId || !travelDate) {
      return;
    }

    setLoadingDesk(true);
    try {
      const [layoutResponse, bookingsResponse, profileResponse] = await Promise.all([
        getBusDriverSeatLayout({ scheduleId: selectedScheduleId, date: travelDate }),
        getBusDriverBookings({ scheduleId: selectedScheduleId, date: travelDate }),
        getCurrentDriver(),
      ]);

      setLayout(unwrap(layoutResponse));
      setBookings(unwrapResults(bookingsResponse));
      setProfile(unwrap(profileResponse));
      setDeskError('');
    } catch (error) {
      setDeskError(error?.message || 'Unable to refresh desk');
    } finally {
      setLoadingDesk(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedSeats.length) {
      toast.error('Pick at least one seat');
      return;
    }

    setSubmitting(true);
    try {
      await createBusDriverReservation({
        scheduleId: selectedScheduleId,
        travelDate,
        seatIds: selectedSeats.map((seat) => seat.id),
        passenger: {
          name: passenger.name,
          age: Number(passenger.age || 0),
          gender: passenger.gender,
          phone: passenger.phone,
          email: passenger.email,
        },
        notes: passenger.notes,
      });

      toast.success('Seat reservation created');
      setPassenger({
        name: '',
        age: '',
        gender: 'Male',
        phone: '',
        email: '',
        notes: '',
      });
      setSelectedSeats([]);
      setActiveTab('bookings');
      await refreshDesk();
    } catch (error) {
      toast.error(error?.message || 'Unable to reserve seats');
    } finally {
      setSubmitting(false);
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Assigned Coach</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">{busService.busName}</h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Seat Fare</p>
            <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(busService.seatPrice, busService.fareCurrency)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><MapPin size={14} /> Route</p>
            <p className="mt-2 text-sm font-black text-slate-900">
              {busService.route?.originCity || 'Origin'} to {busService.route?.destinationCity || 'Destination'}
            </p>
            <p className="mt-1 text-sm text-slate-500">{busService.route?.routeName || 'Standard route'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"><Phone size={14} /> Driver Contact</p>
            <p className="mt-2 text-sm font-black text-slate-900">{busService.driverName || profile?.name}</p>
            <p className="mt-1 text-sm text-slate-500">{busService.driverPhone || profile?.phone}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Today's Bookings" value={bookings.length} Icon={Ticket} />
        <StatCard label="Manual Reserves" value={todaysManualReservations} tone="dark" Icon={Users} />
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Quick Actions</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab('desk')}
            className="rounded-2xl bg-slate-950 px-4 py-4 text-left text-white shadow-lg"
          >
            <p className="text-sm font-black">Open Seat Desk</p>
            <p className="mt-1 text-xs text-white/70">Reserve seats, manage availability, and book passengers.</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left"
          >
            <p className="text-sm font-black text-slate-900">View Bookings</p>
            <p className="mt-1 text-xs text-slate-500">Check confirmed passengers for the selected travel date.</p>
          </button>
        </div>
      </section>
    </div>
  );

  const renderScheduleTab = () => (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Schedule Control</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Schedule</span>
            <select
              value={selectedScheduleId}
              onChange={(event) => {
                const nextSchedule = schedules.find((item) => item.id === event.target.value);
                setSelectedScheduleId(event.target.value);
                if (nextSchedule) {
                  const nextDate = getNextTravelDate(nextSchedule);
                  setTravelDate(nextDate);
                  const parsedDate = new Date(nextDate);
                  setCalendarMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
                }
                setSelectedSeats([]);
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
            >
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.label || 'Bus Schedule'} · {schedule.departureTime || '--:--'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Travel Date</span>
            <input
              type="date"
              value={travelDate}
              onChange={(event) => {
                setTravelDate(event.target.value);
                setSelectedSeats([]);
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
            />
          </label>
        </div>

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Calendar View</p>
              <p className="mt-1 text-sm font-black text-slate-900">{calendarLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return <div key={`empty-${index}`} className="h-11 rounded-2xl bg-transparent" />;
              }

              const isSelected = cell.value === travelDate;
              const isToday = cell.value === createToday();

              return (
                <button
                  key={cell.value}
                  type="button"
                  onClick={() => {
                    setTravelDate(cell.value);
                    setSelectedSeats([]);
                  }}
                  className={`h-11 rounded-2xl text-sm font-black transition ${
                    isSelected
                      ? 'bg-slate-950 text-white shadow-md'
                      : isToday
                        ? 'border border-slate-300 bg-white text-slate-900'
                        : 'bg-white text-slate-600'
                  }`}
                >
                  {cell.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {schedules.map((schedule) => {
          const active = schedule.id === selectedScheduleId;
          return (
            <button
              key={schedule.id}
              type="button"
              onClick={() => {
                setSelectedScheduleId(schedule.id);
                setTravelDate(getNextTravelDate(schedule));
              }}
              className={`w-full rounded-[28px] border p-4 text-left transition ${
                active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-900 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'text-white/55' : 'text-slate-400'}`}>Route Slot</p>
                  <h3 className="mt-2 text-lg font-black">{schedule.label || 'Bus Schedule'}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {schedule.status || 'active'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'text-white/55' : 'text-slate-400'}`}>Departure</p>
                  <p className="mt-1 text-sm font-black">{schedule.departureTime || '--:--'}</p>
                </div>
                <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'text-white/55' : 'text-slate-400'}`}>Arrival</p>
                  <p className="mt-1 text-sm font-black">{schedule.arrivalTime || '--:--'}</p>
                </div>
                <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${active ? 'text-white/55' : 'text-slate-400'}`}>Active Days</p>
                  <p className="mt-1 text-sm font-black">{Array.isArray(schedule.activeDays) && schedule.activeDays.length ? schedule.activeDays.join(', ') : 'Daily'}</p>
                </div>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );

  const renderDeskTab = () => (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Seat Reservation Desk</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Reserve seats and manage live availability</h2>
          </div>
          <button
            type="button"
            onClick={refreshDesk}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700"
          >
            <RefreshCcw size={18} />
          </button>
        </div>

        {deskError ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            {deskError}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Available Seats</p>
            <p className="mt-1 text-lg font-black text-slate-900">{layout?.availableSeats ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected</p>
            <p className="mt-1 text-lg font-black text-slate-900">{selectedSeats.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Reserve Fare</p>
            <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(selectedFare, busService.fareCurrency)}</p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {loadingDesk ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400 shadow-sm">
            Loading seat desk...
          </div>
        ) : (
          <>
            <SeatDeck
              title="Lower Deck"
              rows={layout?.blueprint?.lowerDeck || []}
              selectedSeatIds={selectedSeats.map((seat) => seat.id)}
              onToggle={handleToggleSeat}
            />
            <SeatDeck
              title="Upper Deck"
              rows={layout?.blueprint?.upperDeck || []}
              selectedSeatIds={selectedSeats.map((seat) => seat.id)}
              onToggle={handleToggleSeat}
            />
          </>
        )}
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">Passenger Reservation Form</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={passenger.name}
            onChange={(event) => setPassenger((current) => ({ ...current, name: event.target.value }))}
            placeholder="Passenger name"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
          />
          <input
            value={passenger.phone}
            onChange={(event) => setPassenger((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
            placeholder="Passenger phone"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
          />
          <input
            value={passenger.age}
            onChange={(event) => setPassenger((current) => ({ ...current, age: event.target.value.replace(/\D/g, '').slice(0, 3) }))}
            placeholder="Age"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
          />
          <select
            value={passenger.gender}
            onChange={(event) => setPassenger((current) => ({ ...current, gender: event.target.value }))}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <input
            value={passenger.email}
            onChange={(event) => setPassenger((current) => ({ ...current, email: event.target.value }))}
            placeholder="Passenger email"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none sm:col-span-2"
          />
          <textarea
            value={passenger.notes}
            onChange={(event) => setPassenger((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notes for this reservation"
            className="min-h-[92px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none sm:col-span-2"
          />
        </div>

        {selectedSeats.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected Seats</p>
            <p className="mt-1 text-sm font-black text-slate-900">{selectedSeats.map((seat) => seat.label).join(', ')}</p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={submitting || !selectedSeats.length}
          onClick={handleReserve}
          className={`mt-4 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-black transition ${
            submitting || !selectedSeats.length
              ? 'bg-slate-200 text-slate-500'
              : 'bg-slate-950 text-white shadow-lg'
          }`}
        >
          {submitting ? 'Reserving Seats...' : 'Reserve Seats'}
        </button>
      </section>
    </div>
  );

  const renderBookingsTab = () => (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Bookings</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Passenger list for the selected run</h2>
          </div>
          <div className="rounded-full bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
            {filteredBookings.length} of {bookings.length}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Travel Date</p>
            <p className="mt-1 text-sm font-black text-slate-900">{travelDate || 'NA'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Schedule</p>
            <p className="mt-1 text-sm font-black text-slate-900">{selectedSchedule?.label || 'Bus Schedule'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Departure</p>
            <p className="mt-1 text-sm font-black text-slate-900">{selectedSchedule?.departureTime || '--:--'}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <Search size={13} />
              Search Passenger
            </span>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <Search size={16} className="text-slate-400" />
              <input
                value={bookingSearch}
                onChange={(event) => setBookingSearch(event.target.value)}
                placeholder="Name, phone, booking id, seat..."
                className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <div>
            <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <Filter size={13} />
              Booking Filter
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'all', label: 'All' },
                { id: 'manual', label: 'Manual' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'pending', label: 'Pending' },
              ].map((option) => {
                const active = bookingFilter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBookingFilter(option.id)}
                    className={`rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                      active ? 'bg-slate-950 text-white shadow-md' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-bold text-slate-400 shadow-sm">
            No bookings match this search.
          </div>
        ) : (
          filteredBookings.map((booking, index) => (
            <article key={booking.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Passenger {index + 1}</p>
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    <Ticket size={14} />
                    {booking.bookingCode}
                  </p>
                  <h3 className="mt-2 text-sm font-black text-slate-900">{booking.passenger?.name || 'Passenger'}</h3>
                  <p className="mt-1 text-sm text-slate-500">{booking.seatLabels?.join(', ') || 'No seats'}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  {booking.bookingSource === 'bus_driver' ? 'Manual Reserve' : booking.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><CalendarDays size={13} /> Travel</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{booking.travelDate || 'NA'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><Clock3 size={13} /> Departure</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{booking.routeSnapshot?.departureTime || '--:--'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><UserRound size={13} /> Fare</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(booking.amount, booking.currency)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><Phone size={13} /> Contact</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{booking.passenger?.phone || 'NA'}</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Trip Notes</p>
                <p className="mt-1 text-sm text-slate-600">
                  {booking.notes || booking.passenger?.email || 'No extra notes for this passenger.'}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] px-5 py-10">
        <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 pb-28 pt-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-lg space-y-5">
        <section className="rounded-[32px] bg-[#10213b] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white transition active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                clearDriverAuthState();
                navigate('/taxi/driver/login', { replace: true });
              }}
              className="rounded-full border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80"
            >
              Logout
            </button>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#2f67f6] text-white">
              <Bus size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Bus Driver Console</p>
              <h1 className="mt-1 text-[28px] font-black leading-none">{profile?.name || 'Bus Driver'}</h1>
              <p className="mt-2 text-sm font-medium text-white/70">
                {busService?.busName || 'No bus assigned'} {busService?.serviceNumber ? `· ${busService.serviceNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Schedules</p>
              <p className="mt-2 text-2xl font-black">{profile?.metrics?.totalSchedules || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Capacity</p>
              <p className="mt-2 text-2xl font-black">{profile?.metrics?.totalCapacity || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Bookings</p>
              <p className="mt-2 text-2xl font-black">{profile?.metrics?.upcomingBookings || 0}</p>
            </div>
          </div>
        </section>

        {!busService ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-lg font-black text-slate-900">No bus assigned yet</p>
            <p className="mt-2 text-sm text-slate-500">Assign this driver from the admin bus service page using driver name and phone.</p>
          </section>
        ) : (
          <>
            <section className="sticky top-3 z-20 rounded-[28px] border border-slate-200 bg-white/92 p-2 shadow-lg backdrop-blur-md">
              <div className="grid grid-cols-4 gap-2">
                {WORKSPACE_TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-2xl px-2 py-3 text-center transition ${
                        active ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <tab.Icon size={16} className="mx-auto mb-1" />
                      <span className="block text-[10px] font-black uppercase tracking-[0.12em]">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {activeTab === 'overview' ? renderOverviewTab() : null}
            {activeTab === 'schedule' ? renderScheduleTab() : null}
            {activeTab === 'desk' ? renderDeskTab() : null}
            {activeTab === 'bookings' ? renderBookingsTab() : null}
          </>
        )}
      </div>
      <BusDriverBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLogout={() => {
          clearDriverAuthState();
          navigate('/taxi/driver/login', { replace: true });
        }}
      />
    </div>
  );
};

export default BusDriverHome;
