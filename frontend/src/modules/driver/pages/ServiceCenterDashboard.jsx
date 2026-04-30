import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeIndianRupee,
  Building2,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  clearDriverAuthState,
  createServiceCenterStaff,
  createServiceCenterVehicle,
  deleteServiceCenterVehicle,
  getCurrentDriver,
  getServiceCenterBookings,
  getServiceCenterStaff,
  getServiceCenterVehicles,
  updateServiceCenterBooking,
} from '../services/registrationService';

const unwrap = (response) => response?.data?.data || response?.data || response || {};

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';
const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500';

const buildVehicleForm = () => ({
  name: '',
  short_description: '',
  description: '',
  vehicleCategory: 'Car',
  capacity: '4',
  luggageCapacity: '2',
  image: '',
  amenities: 'AC, GPS, Charging Port',
  price6: '799',
  price12: '1299',
  price24: '1999',
  status: 'active',
});

const buildStaffForm = () => ({
  name: '',
  phone: '',
});

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const statusBadgeClass = (status = '') => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'assigned') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (value === 'confirmed') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (value === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (value === 'end_requested') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const ServiceCenterDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingStaffOptions, setBookingStaffOptions] = useState([]);
  const [permissions, setPermissions] = useState({
    canManageStaff: false,
    canManageVehicles: false,
    canAssignBookings: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState('');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [error, setError] = useState('');
  const [vehicleForm, setVehicleForm] = useState(buildVehicleForm);
  const [staffForm, setStaffForm] = useState(buildStaffForm);
  const [activeTab, setActiveTab] = useState('overview');

  const role = String(profile?.onboarding?.role || '').toLowerCase();
  const isStaffUser = role === 'service_center_staff';

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const profileResponse = await getCurrentDriver();
      const nextProfile = unwrap(profileResponse);
      setProfile(nextProfile);

      const [vehicleResponse, bookingResponse] = await Promise.all([
        getServiceCenterVehicles(),
        getServiceCenterBookings(),
      ]);

      setVehicles(unwrap(vehicleResponse)?.results || []);

      const bookingData = unwrap(bookingResponse);
      setBookings(bookingData?.results || []);
      setPermissions(
        bookingData?.permissions || {
          canManageStaff: false,
          canManageVehicles: false,
          canAssignBookings: false,
        },
      );
      setBookingStaffOptions(bookingData?.staff || []);

      if (bookingData?.permissions?.canManageStaff) {
        const staffResponse = await getServiceCenterStaff();
        setStaff(unwrap(staffResponse)?.results || []);
      } else {
        setStaff([]);
      }
    } catch (err) {
      setError(err?.message || 'Unable to load service center dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const activeVehicles = vehicles.filter((item) => item.active !== false && item.status !== 'inactive').length;
    const pendingBookings = bookings.filter((item) => item.status === 'pending').length;
    const assignedBookings = bookings.filter((item) => item.status === 'assigned').length;
    const completedBookings = bookings.filter((item) => item.status === 'completed').length;

    return {
      activeVehicles,
      pendingBookings,
      assignedBookings,
      completedBookings,
    };
  }, [bookings, vehicles]);

  const tabs = useMemo(() => {
    const nextTabs = [
      { id: 'overview', label: 'Overview', helper: 'Center info', Icon: Building2 },
      { id: 'bookings', label: 'Bookings', helper: `${bookings.length} queue`, Icon: ClipboardList },
    ];

    if (!isStaffUser) {
      nextTabs.push(
        { id: 'staff', label: 'Staff', helper: `${staff.length} team`, Icon: Users },
        { id: 'vehicles', label: 'Vehicles', helper: `${vehicles.length} listed`, Icon: CarFront },
      );
    }

    return nextTabs;
  }, [bookings.length, isStaffUser, staff.length, vehicles.length]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || 'overview');
    }
  }, [activeTab, tabs]);

  const handleLogout = () => {
    clearDriverAuthState();
    navigate('/taxi/driver/login', { replace: true });
  };

  const handleVehicleChange = (field, value) => {
    setVehicleForm((current) => ({ ...current, [field]: value }));
  };

  const handleStaffChange = (field, value) => {
    setStaffForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateVehicle = async () => {
    if (!vehicleForm.name.trim()) {
      setError('Vehicle name is required');
      return;
    }

    setSavingVehicle(true);
    setError('');

    try {
      const payload = {
        transport_type: 'rental',
        name: vehicleForm.name.trim(),
        short_description: vehicleForm.short_description.trim(),
        description: vehicleForm.description.trim(),
        vehicleCategory: vehicleForm.vehicleCategory.trim() || 'Car',
        image: vehicleForm.image.trim(),
        coverImage: vehicleForm.image.trim(),
        capacity: Number(vehicleForm.capacity || 4),
        luggageCapacity: Number(vehicleForm.luggageCapacity || 0),
        amenities: vehicleForm.amenities.split(',').map((item) => item.trim()).filter(Boolean),
        pricing: [
          { id: 'pkg-6h', label: '6 Hours', durationHours: 6, price: Number(vehicleForm.price6 || 0), includedKm: 60, extraHourPrice: 120, extraKmPrice: 12, active: true },
          { id: 'pkg-12h', label: '12 Hours', durationHours: 12, price: Number(vehicleForm.price12 || 0), includedKm: 120, extraHourPrice: 110, extraKmPrice: 11, active: true },
          { id: 'pkg-24h', label: '24 Hours', durationHours: 24, price: Number(vehicleForm.price24 || 0), includedKm: 240, extraHourPrice: 95, extraKmPrice: 10, active: true },
        ],
        status: vehicleForm.status,
      };

      const response = await createServiceCenterVehicle(payload);
      const created = unwrap(response);
      setVehicles((current) => [created, ...current]);
      setVehicleForm(buildVehicleForm());
      setShowVehicleForm(false);
    } catch (err) {
      setError(err?.message || 'Unable to create vehicle');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Delete this rental vehicle?')) {
      return;
    }

    try {
      await deleteServiceCenterVehicle(vehicleId);
      setVehicles((current) => current.filter((item) => String(item.id || item._id) !== String(vehicleId)));
    } catch (err) {
      setError(err?.message || 'Unable to delete vehicle');
    }
  };

  const handleCreateStaff = async () => {
    if (!staffForm.name.trim()) {
      setError('Staff name is required');
      return;
    }

    if (staffForm.phone.replace(/\D/g, '').length !== 10) {
      setError('Staff number must be a valid 10-digit mobile number');
      return;
    }

    setSavingStaff(true);
    setError('');

    try {
      const response = await createServiceCenterStaff({
        name: staffForm.name.trim(),
        phone: staffForm.phone.replace(/\D/g, '').slice(-10),
      });
      const created = unwrap(response);
      setStaff((current) => [created, ...current]);
      setBookingStaffOptions((current) => [created, ...current]);
      setStaffForm(buildStaffForm());
      setShowStaffForm(false);
    } catch (err) {
      setError(err?.message || 'Unable to add staff');
    } finally {
      setSavingStaff(false);
    }
  };

  const patchBookingLocal = (bookingId, patch) => {
    setBookings((current) =>
      current.map((item) =>
        String(item.id || item._id) === String(bookingId) ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleBookingUpdate = async (bookingId, payload) => {
    setUpdatingBookingId(String(bookingId));
    setError('');

    try {
      const response = await updateServiceCenterBooking(bookingId, payload);
      const updated = unwrap(response);
      patchBookingLocal(bookingId, updated);
    } catch (err) {
      setError(err?.message || 'Unable to update booking');
    } finally {
      setUpdatingBookingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eefbf5_0%,#ffffff_100%)]">
        <Loader2 size={34} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#eefbf5_0%,#f8fffb_34%,#ffffff_100%)] px-5 pb-32 pt-6"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <main className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[30px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(16,185,129,0.12)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                <ShieldCheck size={14} />
                {isStaffUser ? 'Service Center Staff Panel' : 'Service Center Owner Panel'}
              </div>
              <div>
                <h1 className="text-[30px] font-semibold tracking-[-0.05em] text-slate-950">
                  {profile?.vehicleMake || profile?.name || 'Service Center'}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {isStaffUser
                    ? 'Work through your assigned rental bookings and update the request status from here.'
                    : 'Manage your service center profile, vehicles, staff members, and booking assignment queue through focused tabs.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Contact</p>
            <p className="mt-3 text-lg font-bold text-slate-900">{profile?.name || '-'}</p>
            <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <Phone size={15} />
              {profile?.phone || profile?.ownerPhone || '-'}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Coverage</p>
            <p className="mt-3 text-lg font-bold text-slate-900">{profile?.zone?.name || '-'}</p>
            <p className="mt-2 text-sm font-medium text-slate-500">{profile?.serviceLocation?.name || 'No service location'}</p>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Bookings</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{bookings.length}</p>
            <p className="mt-2 text-sm font-medium text-emerald-600">{stats.assignedBookings} assigned now</p>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {isStaffUser ? 'My Queue' : 'Team Size'}
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              {isStaffUser ? stats.pendingBookings : staff.length}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {isStaffUser ? 'Pending or active work items' : 'Registered center staff'}
            </p>
          </div>
        </section>

        {activeTab === 'overview' && (
          <section className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Center Details</h2>
                  <p className="mt-1 text-sm text-slate-500">The logged-in account is tied to this service center and service location.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                  <Building2 size={14} />
                  {profile?.status || 'active'}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Address</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{profile?.address || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pinned Location</p>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <MapPin size={15} className="text-emerald-600" />
                    {Number.isFinite(Number(profile?.latitude)) && Number.isFinite(Number(profile?.longitude))
                      ? `${Number(profile.latitude).toFixed(5)}, ${Number(profile.longitude).toFixed(5)}`
                      : '-'}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Pending Queue</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stats.pendingBookings}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Requests still waiting for movement.</p>
              </div>
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Completed Jobs</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stats.completedBookings}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Closed bookings from this dashboard.</p>
              </div>
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Live Snapshot</p>
                <p className="mt-3 text-lg font-bold text-slate-900">{isStaffUser ? 'Staff workflow' : 'Owner controls'}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {isStaffUser
                    ? 'Use the Bookings tab to update assigned work quickly.'
                    : 'Use the tabs below to move between bookings, team, and vehicles.'}
                </p>
              </div>
            </section>
          </section>
        )}

        {activeTab === 'bookings' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Bookings Queue</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isStaffUser
                    ? 'These are the bookings assigned to your login.'
                    : 'Assign center staff, track booking progress, and update handling notes.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                <ClipboardList size={14} />
                {bookings.length} bookings
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <div key={booking.id || booking._id} className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-950">{booking.bookingReference || 'Rental Booking'}</h3>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${statusBadgeClass(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          {(booking.customer?.name || 'Unknown customer') + ' - ' + (booking.customer?.phone || 'No phone')}
                        </p>
                        <p className="text-sm text-slate-500">
                          {(booking.vehicleName || 'Rental vehicle') + ' - ' + (booking.selectedPackage?.label || booking.vehicleCategory || 'Rental')}
                        </p>
                      </div>

                      <div className="text-sm font-medium text-slate-500">{formatDateTime(booking.pickupDateTime)}</div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pickup Location</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{booking.serviceLocation?.name || '-'}</p>
                        <p className="mt-1 text-sm text-slate-500">{booking.serviceLocation?.address || booking.serviceLocation?.city || '-'}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Booking Value</p>
                        <div className="mt-2 inline-flex items-center gap-1 text-lg font-black text-slate-950">
                          <BadgeIndianRupee size={18} />
                          {Number(booking.totalCost || 0)}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{`Advance ${Number(booking.payableNow || 0)} - ${booking.paymentStatus || 'pending'}`}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Assigned Staff</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{booking.assignedStaff?.name || 'Not assigned'}</p>
                        <p className="mt-1 text-sm text-slate-500">{booking.assignedStaff?.phone || 'Owner can assign from this panel'}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {permissions.canAssignBookings ? (
                        <div>
                          <label className={labelClass}>Assign Staff</label>
                          <select
                            value={booking.assignedStaff?.id || ''}
                            onChange={(event) =>
                              handleBookingUpdate(booking.id || booking._id, {
                                assignedStaffId: event.target.value,
                              })
                            }
                            disabled={updatingBookingId === String(booking.id || booking._id)}
                            className={inputClass}
                          >
                            <option value="">Unassigned</option>
                            {bookingStaffOptions.map((member) => (
                              <option key={member.id || member._id} value={member.id || member._id}>
                                {`${member.name} - ${member.phone}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className={labelClass}>Assignment</label>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                            {booking.assignedStaff?.name || 'Awaiting owner assignment'}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={labelClass}>Status</label>
                        <select
                          value={booking.status || 'pending'}
                          onChange={(event) =>
                            handleBookingUpdate(booking.id || booking._id, {
                              status: event.target.value,
                            })
                          }
                          disabled={updatingBookingId === String(booking.id || booking._id)}
                          className={inputClass}
                        >
                          {!isStaffUser && <option value="pending">Pending</option>}
                          <option value="assigned">Assigned</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="end_requested">End Requested</option>
                          <option value="completed">Completed</option>
                          {!isStaffUser && <option value="cancelled">Cancelled</option>}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={labelClass}>Handling Note</label>
                      <textarea
                        rows={3}
                        defaultValue={booking.serviceCenterNote || ''}
                        onBlur={(event) => {
                          if (event.target.value !== (booking.serviceCenterNote || '')) {
                            handleBookingUpdate(booking.id || booking._id, {
                              serviceCenterNote: event.target.value,
                            });
                          }
                        }}
                        className={`${inputClass} resize-none`}
                        placeholder="Add handling notes, call updates, or internal remarks"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                  No bookings are currently available for this panel.
                </div>
              )}
            </div>
          </section>
        )}

        {!isStaffUser && activeTab === 'staff' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Staff Members</h2>
                <p className="mt-1 text-sm text-slate-500">Add staff with their login number so they can handle assigned bookings.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffForm(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <UserRoundPlus size={16} />
                Add Staff
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {staff.length > 0 ? (
                staff.map((member) => (
                  <div key={member.id || member._id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{member.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{member.phone}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                        {member.bookingCount || 0} bookings
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                  No staff added yet.
                </div>
              )}
            </div>
          </section>
        )}

        {!isStaffUser && activeTab === 'vehicles' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Rental Vehicles</h2>
                <p className="mt-1 text-sm text-slate-500">Vehicles listed here are visible under this center's rental catalog.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVehicleForm(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Plus size={16} />
                Add Vehicle
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <div key={vehicle.id || vehicle._id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <CarFront size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{vehicle.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{`${vehicle.vehicleCategory || 'Car'} - ${vehicle.capacity || 0} seats`}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVehicle(vehicle.id || vehicle._id)}
                        className="rounded-xl border border-rose-200 bg-white p-2 text-rose-500 transition hover:bg-rose-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                  No rental vehicles added yet.
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 px-4 pb-4 pt-3 backdrop-blur-xl">
        <div className={`mx-auto grid max-w-4xl gap-2 rounded-[28px] border border-slate-200 bg-slate-50/90 p-2 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] ${isStaffUser ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
          {tabs.map(({ id, label, helper, Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-[22px] px-3 py-3 text-left transition ${
                  isActive ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? 'bg-white/15' : 'bg-slate-100 text-slate-700'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{label}</p>
                    <p className={`truncate text-[11px] font-medium ${isActive ? 'text-emerald-50' : 'text-slate-400'}`}>{helper}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showStaffForm ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full rounded-[30px] bg-white p-6 shadow-[0_28px_100px_rgba(15,23,42,0.22)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">Add Staff Member</h3>
                    <p className="mt-1 text-sm text-slate-500">The staff member can log into the same panel using this number.</p>
                  </div>
                  <button type="button" onClick={() => setShowStaffForm(false)} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className={labelClass}>Staff Name</label>
                    <input value={staffForm.name} onChange={(event) => handleStaffChange('name', event.target.value)} className={inputClass} placeholder="Enter staff name" />
                  </div>
                  <div>
                    <label className={labelClass}>Login Number</label>
                    <input value={staffForm.phone} onChange={(event) => handleStaffChange('phone', event.target.value.replace(/\D/g, ''))} className={inputClass} maxLength={10} placeholder="Enter 10 digit number" />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setShowStaffForm(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="button" disabled={savingStaff} onClick={handleCreateStaff} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                    {savingStaff ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                    Save Staff
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}

        {showVehicleForm ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="max-h-[92vh] w-full overflow-y-auto rounded-[30px] bg-white p-6 shadow-[0_28px_100px_rgba(15,23,42,0.22)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">Add Rental Vehicle</h3>
                    <p className="mt-1 text-sm text-slate-500">This vehicle will be assigned directly to your service center.</p>
                  </div>
                  <button type="button" onClick={() => setShowVehicleForm(false)} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Vehicle Name</label>
                    <input value={vehicleForm.name} onChange={(event) => handleVehicleChange('name', event.target.value)} className={inputClass} placeholder="Swift Dzire Rental" />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <input value={vehicleForm.vehicleCategory} onChange={(event) => handleVehicleChange('vehicleCategory', event.target.value)} className={inputClass} placeholder="Car" />
                  </div>
                  <div>
                    <label className={labelClass}>Image URL</label>
                    <input value={vehicleForm.image} onChange={(event) => handleVehicleChange('image', event.target.value)} className={inputClass} placeholder="https://..." />
                  </div>
                  <div>
                    <label className={labelClass}>Capacity</label>
                    <input type="number" min="1" value={vehicleForm.capacity} onChange={(event) => handleVehicleChange('capacity', event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Luggage Capacity</label>
                    <input type="number" min="0" value={vehicleForm.luggageCapacity} onChange={(event) => handleVehicleChange('luggageCapacity', event.target.value)} className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Short Description</label>
                    <input value={vehicleForm.short_description} onChange={(event) => handleVehicleChange('short_description', event.target.value)} className={inputClass} placeholder="Comfortable city rental" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Description</label>
                    <textarea rows={4} value={vehicleForm.description} onChange={(event) => handleVehicleChange('description', event.target.value)} className={`${inputClass} resize-none`} placeholder="Add details about this rental vehicle" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Amenities</label>
                    <input value={vehicleForm.amenities} onChange={(event) => handleVehicleChange('amenities', event.target.value)} className={inputClass} placeholder="AC, GPS, Charging Port" />
                  </div>
                  <div>
                    <label className={labelClass}>6 Hour Price</label>
                    <input type="number" min="0" value={vehicleForm.price6} onChange={(event) => handleVehicleChange('price6', event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>12 Hour Price</label>
                    <input type="number" min="0" value={vehicleForm.price12} onChange={(event) => handleVehicleChange('price12', event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>24 Hour Price</label>
                    <input type="number" min="0" value={vehicleForm.price24} onChange={(event) => handleVehicleChange('price24', event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={vehicleForm.status} onChange={(event) => handleVehicleChange('status', event.target.value)} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setShowVehicleForm(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="button" disabled={savingVehicle} onClick={handleCreateVehicle} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                    {savingVehicle ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Save Vehicle
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default ServiceCenterDashboard;
