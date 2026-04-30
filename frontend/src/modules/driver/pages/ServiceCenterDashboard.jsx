import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
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
  UserRound,
  UserRoundPlus,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  Search
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { uploadService } from '../../../shared/services/uploadService';
import {
  clearDriverAuthState,
  createServiceCenterStaff,
  createServiceCenterVehicle,
  deleteServiceCenterVehicle,
  getCurrentDriver,
  getServiceCenterBookings,
  getServiceCenterStaff,
  getServiceCenterVehicles,
  updateServiceCenterVehicle,
  updateServiceCenterBooking,
} from '../services/registrationService';

const unwrap = (response) => response?.data?.data || response?.data || response || {};

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';
const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500';

const beforeHandoverItems = [
  { key: 'exteriorOk', label: 'Exterior checked' },
  { key: 'interiorOk', label: 'Interior cleaned' },
  { key: 'dashboardOk', label: 'Dashboard photos matched' },
  { key: 'tyresOk', label: 'Tyres look good' },
  { key: 'fuelOk', label: 'Fuel level confirmed' },
  { key: 'documentsOk', label: 'Documents available' },
];

const afterReturnItems = [
  { key: 'exteriorChecked', label: 'Exterior rechecked' },
  { key: 'interiorChecked', label: 'Interior rechecked' },
  { key: 'dashboardChecked', label: 'Dashboard rechecked' },
  { key: 'fuelChecked', label: 'Fuel level noted' },
  { key: 'tyresChecked', label: 'Tyres rechecked' },
  { key: 'damageReviewed', label: 'Damage reviewed' },
];

const canCompleteBooking = (booking) => {
  const inspection = booking?.rentalInspection || {};
  const meter = Number(inspection.returnMeterReading);
  return (
    Number.isFinite(meter) &&
    meter >= 0 &&
    String(inspection.returnFuelLevel || '').trim() &&
    String(inspection.returnNotes || '').trim() &&
    Array.isArray(inspection.afterConditionImages) &&
    inspection.afterConditionImages.filter(Boolean).length > 0
  );
};

const canRequestEndRide = (booking) => {
  const status = String(booking?.status || '').toLowerCase();
  return ['confirmed', 'assigned'].includes(status);
};

const canFinalizeBooking = (booking) => {
  const status = String(booking?.status || '').toLowerCase();
  return canCompleteBooking(booking) && !['completed', 'cancelled'].includes(status);
};

const getCompletionRequirements = (booking) => {
  const inspection = booking?.rentalInspection || {};
  const missing = [];
  const meter = Number(inspection.returnMeterReading);

  if (!Number.isFinite(meter) || meter < 0) {
    missing.push('return meter reading');
  }

  if (!String(inspection.returnFuelLevel || '').trim()) {
    missing.push('return fuel level');
  }

  if (!String(inspection.returnNotes || '').trim()) {
    missing.push('return notes');
  }

  if (!Array.isArray(inspection.afterConditionImages) || inspection.afterConditionImages.filter(Boolean).length === 0) {
    missing.push('after-condition photos');
  }

  return missing;
};

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

const getCustomerDocumentCards = (booking) => {
  const docs = booking?.customerDocuments || {};
  return [
    {
      key: 'drivingLicense',
      label: 'Driving License',
      imageUrl: docs.drivingLicense?.imageUrl || '',
      fileName: docs.drivingLicense?.fileName || '',
      uploadedAt: docs.drivingLicense?.uploadedAt || null,
    },
    {
      key: 'aadhaarCard',
      label: 'Aadhaar Card',
      imageUrl: docs.aadhaarCard?.imageUrl || '',
      fileName: docs.aadhaarCard?.fileName || '',
      uploadedAt: docs.aadhaarCard?.uploadedAt || null,
    },
  ];
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected image'));
    reader.readAsDataURL(file);
  });

const statusBadgeClass = (status = '') => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'assigned') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (value === 'confirmed') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (value === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (value === 'end_requested') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const CollapsibleSection = ({ title, icon: Icon, children, badge }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
            <Icon size={18} />
          </div>
          <div className="text-left">
            <h4 className="font-['Outfit'] text-[15px] font-bold text-slate-900">{title}</h4>
            {badge && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{badge}</span>}
          </div>
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ServiceCenterDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [uploadingConditionSection, setUploadingConditionSection] = useState('');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState('');
  const [error, setError] = useState('');
  const [vehicleForm, setVehicleForm] = useState(buildVehicleForm);
  const [staffForm, setStaffForm] = useState(buildStaffForm);
  const [previewImage, setPreviewImage] = useState('');
  const [bookingDraft, setBookingDraft] = useState({
    assignedStaffId: '',
    status: 'pending',
    serviceCenterNote: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPerPage = 8;

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
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings;
    const lowerQuery = searchQuery.toLowerCase();
    return bookings.filter(b => 
      (b.bookingReference || '').toLowerCase().includes(lowerQuery) ||
      (b.customer?.name || '').toLowerCase().includes(lowerQuery) ||
      (b.vehicleName || '').toLowerCase().includes(lowerQuery)
    );
  }, [bookings, searchQuery]);

  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * bookingsPerPage;
    return filteredBookings.slice(startIndex, startIndex + bookingsPerPage);
  }, [filteredBookings, currentPage]);

  const totalPages = Math.ceil(filteredBookings.length / bookingsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
      { id: 'overview', label: 'Overview', shortLabel: 'Home', helper: 'Center info', Icon: Building2 },
      { id: 'bookings', label: 'Bookings', shortLabel: 'Jobs', helper: `${bookings.length} queue`, Icon: ClipboardList },
    ];

    if (!isStaffUser) {
      nextTabs.push(
        { id: 'staff', label: 'Staff', shortLabel: 'Team', helper: `${staff.length} team`, Icon: Users },
        { id: 'vehicles', label: 'Vehicles', shortLabel: 'Fleet', helper: `${vehicles.length} listed`, Icon: CarFront },
      );
    }

    nextTabs.push({ id: 'profile', label: 'Profile', shortLabel: 'Me', helper: 'Account', Icon: UserRound });

    return nextTabs;
  }, [bookings.length, isStaffUser, staff.length, vehicles.length]);

  const selectedBookingId = searchParams.get('booking') || '';
  const selectedBooking = useMemo(
    () =>
      bookings.find((item) => String(item.id || item._id) === String(selectedBookingId)) || null,
    [bookings, selectedBookingId],
  );
  const bookingDraftDirty = useMemo(() => {
    if (!selectedBooking) {
      return false;
    }

    return (
      String(bookingDraft.assignedStaffId || '') !== String(selectedBooking.assignedStaff?.id || '') ||
      String(bookingDraft.status || 'pending') !== String(selectedBooking.status || 'pending') ||
      String(bookingDraft.serviceCenterNote || '') !== String(selectedBooking.serviceCenterNote || '')
    );
  }, [bookingDraft.assignedStaffId, bookingDraft.serviceCenterNote, bookingDraft.status, selectedBooking]);
  const validTabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const fallbackTab = tabs[0]?.id || 'overview';
  const rawTab = searchParams.get('tab') || '';
  const activeTab = validTabIds.includes(rawTab) ? rawTab : fallbackTab;

  useEffect(() => {
    if (rawTab === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', activeTab);
    if (activeTab !== 'bookings') {
      nextParams.delete('booking');
    }
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabId);
    nextParams.delete('booking');
    setSearchParams(nextParams);
  };

  const handleBookingOpen = (bookingId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'bookings');
    nextParams.set('booking', String(bookingId));
    setSearchParams(nextParams);
  };

  const handleBookingClose = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'bookings');
    nextParams.delete('booking');
    setSearchParams(nextParams);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    if (!selectedBooking) {
      setBookingDraft({
        assignedStaffId: '',
        status: 'pending',
        serviceCenterNote: '',
      });
      return;
    }

    setBookingDraft({
      assignedStaffId: String(selectedBooking.assignedStaff?.id || ''),
      status: String(selectedBooking.status || 'pending'),
      serviceCenterNote: String(selectedBooking.serviceCenterNote || ''),
    });
  }, [selectedBooking]);

  const headerContent = useMemo(() => {
    if (activeTab === 'bookings') {
      return {
        badge: isStaffUser ? 'Booking Workbench' : 'Bookings Command',
        title: isStaffUser ? 'Assigned Bookings' : 'Bookings Queue',
        description: isStaffUser
          ? 'Handle the jobs assigned to your login, update status, and keep notes in one place.'
          : 'Track incoming requests, assign team members, and move bookings through the workflow.',
      };
    }

    if (activeTab === 'staff') {
      return {
        badge: 'Team Management',
        title: 'Service Team',
        description: 'Add staff, review your active team, and manage who can handle booking assignments.',
      };
    }

    if (activeTab === 'vehicles') {
      return {
        badge: 'Fleet Management',
        title: 'Rental Vehicles',
        description: 'Open any vehicle to view full details, edit pricing, and control what stays live in your catalog.',
      };
    }

    if (activeTab === 'profile') {
      return {
        badge: 'Account',
        title: 'Profile & Access',
        description: 'See account details tied to this service center login and manage your session.',
      };
    }

    return {
      badge: isStaffUser ? 'Service Center Staff Panel' : 'Service Center Owner Panel',
      title: profile?.vehicleMake || profile?.name || 'Service Center',
      description: isStaffUser
        ? 'Assigned work, updates, and progress all live in one mobile-friendly flow.'
        : 'Switch between overview, bookings, staff, and vehicles like a proper app screen.',
    };
  }, [activeTab, isStaffUser, profile?.name, profile?.vehicleMake]);

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

      if (editingVehicleId) {
        const response = await updateServiceCenterVehicle(editingVehicleId, payload);
        const updated = unwrap(response);
        setVehicles((current) =>
          current.map((item) =>
            String(item.id || item._id) === String(editingVehicleId) ? updated : item,
          ),
        );
      } else {
        const response = await createServiceCenterVehicle(payload);
        const created = unwrap(response);
        setVehicles((current) => [created, ...current]);
      }

      setVehicleForm(buildVehicleForm());
      setEditingVehicleId('');
      setShowVehicleForm(false);
    } catch (err) {
      setError(err?.message || (editingVehicleId ? 'Unable to update vehicle' : 'Unable to create vehicle'));
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

  const closeVehicleForm = () => {
    setShowVehicleForm(false);
    setEditingVehicleId('');
    setVehicleForm(buildVehicleForm());
  };

  const openCreateVehicleForm = () => {
    setEditingVehicleId('');
    setVehicleForm(buildVehicleForm());
    setShowVehicleForm(true);
  };

  const openVehicleEditor = (vehicle) => {
    const pricing = Array.isArray(vehicle?.pricing) ? vehicle.pricing : [];
    const sixHour = pricing.find((item) => Number(item?.durationHours) === 6);
    const twelveHour = pricing.find((item) => Number(item?.durationHours) === 12);
    const twentyFourHour = pricing.find((item) => Number(item?.durationHours) === 24);

    setEditingVehicleId(String(vehicle?.id || vehicle?._id || ''));
    setVehicleForm({
      name: vehicle?.name || '',
      short_description: vehicle?.short_description || '',
      description: vehicle?.description || '',
      vehicleCategory: vehicle?.vehicleCategory || 'Car',
      capacity: String(vehicle?.capacity ?? 4),
      luggageCapacity: String(vehicle?.luggageCapacity ?? 0),
      image: vehicle?.image || vehicle?.coverImage || '',
      amenities: Array.isArray(vehicle?.amenities) ? vehicle.amenities.join(', ') : '',
      price6: String(sixHour?.price ?? 0),
      price12: String(twelveHour?.price ?? 0),
      price24: String(twentyFourHour?.price ?? 0),
      status: vehicle?.status === 'inactive' ? 'inactive' : 'active',
    });
    setShowVehicleForm(true);
  };

  const patchBookingLocal = (bookingId, patch) => {
    setBookings((current) =>
      current.map((item) =>
        String(item.id || item._id) === String(bookingId) ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateBookingInspection = async (bookingId, section, key, value) => {
    await handleBookingUpdate(bookingId, {
      rentalInspection: {
        [section]: {
          [key]: value,
        },
      },
    });
  };

  const updateBookingInspectionNotes = async (bookingId, key, value) => {
    await handleBookingUpdate(bookingId, {
      rentalInspection: {
        [key]: value,
      },
    });
  };

  const uploadConditionImages = async (bookingId, field, fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) {
      return;
    }

    setUploadingConditionSection(field);
    setError('');

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        const uploadResult = await uploadService.uploadImage(dataUrl, 'service-center-condition');
        const imageUrl = uploadResult?.url || uploadResult?.secureUrl || '';
        if (imageUrl) {
          uploadedUrls.push(imageUrl);
        }
      }

      const currentBooking =
        bookings.find((item) => String(item.id || item._id) === String(bookingId)) || null;
      const currentInspection = currentBooking?.rentalInspection || {};
      const currentImages = Array.isArray(currentInspection[field]) ? currentInspection[field] : [];

      await handleBookingUpdate(bookingId, {
        rentalInspection: {
          [field]: [...currentImages, ...uploadedUrls],
        },
      });
    } catch (err) {
      setError(err?.message || 'Unable to upload condition images');
    } finally {
      setUploadingConditionSection('');
    }
  };

  const removeConditionImage = async (bookingId, field, imageToRemove) => {
    const currentBooking =
      bookings.find((item) => String(item.id || item._id) === String(bookingId)) || null;
    const currentInspection = currentBooking?.rentalInspection || {};
    const currentImages = Array.isArray(currentInspection[field]) ? currentInspection[field] : [];

    await handleBookingUpdate(bookingId, {
      rentalInspection: {
        [field]: currentImages.filter((item) => item !== imageToRemove),
      },
    });
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

  const saveBookingDraft = async () => {
    if (!selectedBooking || !bookingDraftDirty) {
      return;
    }

    if (bookingDraft.status === 'completed' && !canCompleteBooking(selectedBooking)) {
      const missing = getCompletionRequirements(selectedBooking);
      setError(`Complete the return checklist before marking completed: ${missing.join(', ')}`);
      return;
    }

    const payload = {
      status: bookingDraft.status,
      serviceCenterNote: bookingDraft.serviceCenterNote,
    };

    if (permissions.canAssignBookings) {
      payload.assignedStaffId = bookingDraft.assignedStaffId;
    }

    await handleBookingUpdate(selectedBooking.id || selectedBooking._id, payload);
  };

  const requestEndRide = async () => {
    if (!selectedBooking || !canRequestEndRide(selectedBooking)) {
      return;
    }

    await handleBookingUpdate(selectedBooking.id || selectedBooking._id, {
      status: 'end_requested',
    });
  };

  const completeRide = async () => {
    if (!selectedBooking || !canFinalizeBooking(selectedBooking)) {
      return;
    }

    await handleBookingUpdate(selectedBooking.id || selectedBooking._id, {
      status: 'completed',
    });
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
      className="min-h-screen bg-[linear-gradient(180deg,#eefbf5_0%,#f8fffb_34%,#ffffff_100%)] px-4 pb-36 pt-4"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <main className="mx-auto max-w-3xl space-y-4">
        {activeTab === 'overview' ? (
          <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(16,185,129,0.12)] backdrop-blur-sm">
            <div className="min-w-0 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                <ShieldCheck size={14} />
                {headerContent.badge}
              </div>
              <div>
                <h1 className="truncate text-[28px] font-semibold tracking-[-0.05em] text-slate-950">
                  {headerContent.title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {headerContent.description}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : null}

        {activeTab === 'overview' && (
          <section className="space-y-6">
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Pending Queue</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stats.pendingBookings}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Requests waiting for action</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Assigned Jobs</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stats.assignedBookings}</p>
                <p className="mt-2 text-sm font-medium text-emerald-600">Live bookings in progress</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Completed Jobs</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{stats.completedBookings}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Closed rental requests</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {isStaffUser ? 'My Queue' : 'Fleet Snapshot'}
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                  {isStaffUser ? stats.pendingBookings : stats.activeVehicles}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {isStaffUser ? 'Pending or active work items' : 'Active listed vehicles'}
                </p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Center Details</h2>
                    <p className="mt-1 text-sm text-slate-500">Primary service-center information for this operational panel.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                    <Building2 size={14} />
                    {profile?.status || 'active'}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Center Name</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{profile?.name || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Contact Number</p>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Phone size={15} className="text-emerald-600" />
                      {profile?.phone || profile?.ownerPhone || '-'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Zone</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{profile?.zone?.name || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Service Location</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{profile?.serviceLocation?.name || 'No service location'}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">Operations Snapshot</h2>
                <p className="mt-1 text-sm text-slate-500">Quick breakdown of what is live on this center right now.</p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Total Bookings</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{bookings.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{isStaffUser ? 'Work Mode' : 'Team Members'}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{isStaffUser ? 'Staff' : staff.length}</p>
                    <p className="mt-1 text-sm text-slate-500">{isStaffUser ? 'Assigned workflow access' : 'Registered center staff'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Live Snapshot</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{isStaffUser ? 'Staff workflow' : 'Owner controls'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isStaffUser
                        ? 'Use Bookings to update assigned work quickly.'
                        : 'Use Bookings, Staff, Vehicles, and Profile for daily control.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="space-y-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
                    <UserRound size={14} />
                    {headerContent.badge}
                  </div>
                  <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">{headerContent.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{headerContent.description}</p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                  {role || 'service_center'}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Account Name</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{profile?.name || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Phone Number</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{profile?.phone || profile?.ownerPhone || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Zone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{profile?.zone?.name || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Service Location</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{profile?.serviceLocation?.name || 'No service location'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Address</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{profile?.address || '-'}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-rose-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950">Session</h3>
              <p className="mt-1 text-sm text-slate-500">Use this action when you want to sign out from the service-center panel.</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                <LogOut size={16} />
                Logout
              </button>
            </section>
          </section>
        )}

        {activeTab === 'bookings' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-['Outfit'] text-lg font-bold text-slate-950">
                  {selectedBooking ? selectedBooking.bookingReference || 'Booking Details' : 'Bookings Queue'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  {selectedBooking
                    ? 'Review details, assign staff, and update notes.'
                    : isStaffUser
                      ? 'Bookings assigned to your login.'
                      : 'Assign staff and review details.'}
                </p>
              </div>
              {selectedBooking ? (
                <button
                  type="button"
                  onClick={handleBookingClose}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft size={14} />
                  Back To List
                </button>
              ) : (
                <div className="inline-flex items-center w-fit gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  <ClipboardList size={12} />
                  {bookings.length} bookings
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {selectedBooking ? (
                <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                  {(() => {
                    const inspection = selectedBooking.rentalInspection || {};
                    const beforeInspection = inspection.beforeHandover || {};
                    const afterInspection = inspection.afterReturn || {};
                    const beforeConditionImages = Array.isArray(inspection.beforeConditionImages)
                      ? inspection.beforeConditionImages
                      : [];
                    const afterConditionImages = Array.isArray(inspection.afterConditionImages)
                      ? inspection.afterConditionImages
                      : [];
                    const customerDocumentCards = getCustomerDocumentCards(selectedBooking);

                    const getPossessionTime = () => {
                      const start = new Date(selectedBooking.pickupDateTime);
                      const end = selectedBooking.status === 'completed' ? new Date(selectedBooking.updatedAt) : new Date();
                      const diffMs = Math.max(0, end - start);
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      const days = Math.floor(hours / 24);
                      
                      if (days > 0) return `${days}d ${hours % 24}h`;
                      if (hours > 0) return `${hours}h ${mins}m`;
                      return `${mins}m`;
                    };

                    return (
                      <div className="flex flex-col h-full">
                        {/* Header Summary */}
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-['Outfit'] text-xl font-bold text-slate-900 leading-tight">
                                {selectedBooking.bookingReference || 'Rental Booking'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusBadgeClass(selectedBooking.status)}`}>
                                  {selectedBooking.status}
                                </span>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-sm">
                                   <Clock size={10} className="text-emerald-400" />
                                   <span className="text-[9px] font-black uppercase tracking-widest">{getPossessionTime()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {new Date(selectedBooking.pickupDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-1 text-lg font-black text-slate-950">
                                <BadgeIndianRupee size={18} className="text-emerald-600" />
                                {Number(selectedBooking.totalCost || 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Content Area */}
                        <div className="divide-y divide-slate-100">
                          {/* 1. Customer & Documents */}
                          <CollapsibleSection 
                            title="Customer & Documents" 
                            icon={UserRound}
                            badge={`${customerDocumentCards.filter(d => d.imageUrl).length}/2 Uploaded`}
                          >
                            <div className="space-y-4">
                               <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                                      <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBooking.customer?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                                      <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBooking.customer?.phone || 'N/A'}</p>
                                    </div>
                                  </div>
                               </div>

                               <div className="grid grid-cols-2 gap-3">
                                  {customerDocumentCards.map((doc) => (
                                    <div key={doc.key} className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 aspect-[4/3]">
                                      {doc.imageUrl ? (
                                        <>
                                          <img src={doc.imageUrl} className="h-full w-full object-cover transition group-hover:scale-105" alt={doc.label} />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                                            <p className="text-[10px] font-black text-white/90 uppercase tracking-widest">{doc.label}</p>
                                            <button 
                                              onClick={() => setPreviewImage(doc.imageUrl)}
                                              className="mt-2 w-full py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white text-[10px] font-bold hover:bg-white/30 transition"
                                            >
                                              View Full
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                                          <ShieldCheck size={24} className="text-slate-300 mb-2" />
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting {doc.label}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                               </div>
                            </div>
                          </CollapsibleSection>

                          {/* 2. Before Handover */}
                          <CollapsibleSection title="Pickup Inspection" icon={ClipboardList} badge="Before Handover">
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {beforeHandoverItems.map((item) => {
                                    const active = beforeInspection[item.key] === true;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => updateBookingInspection(selectedBooking.id || selectedBooking._id, 'beforeHandover', item.key, !active)}
                                        className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {active ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                                          <span className="text-[11px] font-bold">{item.label}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Handover Photos</label>
                                    <label className="cursor-pointer text-[10px] font-black text-emerald-600 hover:text-emerald-700">
                                      + ADD NEW
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadConditionImages(selectedBooking.id || selectedBooking._id, 'beforeConditionImages', e.target.files)} />
                                    </label>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {beforeConditionImages.map((img, i) => (
                                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-100">
                                        <img src={img} className="h-full w-full object-cover" alt="" />
                                        <button onClick={() => removeConditionImage(selectedBooking.id || selectedBooking._id, 'beforeConditionImages', img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Pickup KM</p>
                                      <input type="number" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-emerald-500/20" defaultValue={inspection.pickupMeterReading} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'pickupMeterReading', e.target.value)} />
                                   </div>
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Fuel Level</p>
                                      <input type="text" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-emerald-500/20" defaultValue={inspection.pickupFuelLevel} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'pickupFuelLevel', e.target.value)} />
                                   </div>
                                </div>
                             </div>
                          </CollapsibleSection>

                          {/* 3. After Return */}
                          <CollapsibleSection title="Return Inspection" icon={CheckCircle2} badge="After Return">
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {afterReturnItems.map((item) => {
                                    const active = afterInspection[item.key] === true;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => updateBookingInspection(selectedBooking.id || selectedBooking._id, 'afterReturn', item.key, !active)}
                                        className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {active ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                                          <span className="text-[11px] font-bold">{item.label}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Return Photos</label>
                                    <label className="cursor-pointer text-[10px] font-black text-amber-600 hover:text-amber-700">
                                      + ADD NEW
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadConditionImages(selectedBooking.id || selectedBooking._id, 'afterConditionImages', e.target.files)} />
                                    </label>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {afterConditionImages.map((img, i) => (
                                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-100">
                                        <img src={img} className="h-full w-full object-cover" alt="" />
                                        <button onClick={() => removeConditionImage(selectedBooking.id || selectedBooking._id, 'afterConditionImages', img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Return KM</p>
                                      <input type="number" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-amber-500/20" defaultValue={inspection.returnMeterReading} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'returnMeterReading', e.target.value)} />
                                   </div>
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Return Fuel</p>
                                      <input type="text" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-amber-500/20" defaultValue={inspection.returnFuelLevel} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'returnFuelLevel', e.target.value)} />
                                   </div>
                                </div>
                             </div>
                          </CollapsibleSection>
                        </div>

                        {/* Bottom Action Section */}
                        <div className="p-5 sm:p-6 bg-slate-900 text-white mt-auto rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                           <div className="space-y-5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 {permissions.canAssignBookings && (
                                   <div className="space-y-1.5">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Assign Staff</label>
                                      <select 
                                        value={bookingDraft.assignedStaffId} 
                                        onChange={(e) => setBookingDraft(c => ({...c, assignedStaffId: e.target.value}))}
                                        className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-[13px] font-bold py-2.5 px-3 focus:ring-2 focus:ring-white/20 appearance-none"
                                      >
                                        <option value="" className="text-slate-900">Unassigned</option>
                                        {bookingStaffOptions.map(s => <option key={s.id || s._id} value={s.id || s._id} className="text-slate-900">{s.name}</option>)}
                                      </select>
                                   </div>
                                 )}
                                 <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Status</label>
                                    <select 
                                      value={bookingDraft.status} 
                                      onChange={(e) => setBookingDraft(c => ({...c, status: e.target.value}))}
                                      className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-[13px] font-bold py-2.5 px-3 focus:ring-2 focus:ring-white/20 appearance-none"
                                    >
                                      <option value="pending" className="text-slate-900">Pending</option>
                                      <option value="confirmed" className="text-slate-900">Confirmed</option>
                                      <option value="assigned" className="text-slate-900">Assigned</option>
                                      <option value="end_requested" className="text-slate-900">End Requested</option>
                                      <option value="completed" className="text-slate-900">Completed</option>
                                    </select>
                                 </div>
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Internal Handling Notes</label>
                                 <textarea 
                                    rows={2}
                                    value={bookingDraft.serviceCenterNote}
                                    onChange={(e) => setBookingDraft(c => ({...c, serviceCenterNote: e.target.value}))}
                                    className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-sm font-medium py-2 px-3 focus:ring-2 focus:ring-white/20 resize-none"
                                    placeholder="Add notes for the team..."
                                 />
                              </div>

                              <div className="flex items-center gap-3 pt-2">
                                 <button
                                    onClick={saveBookingDraft}
                                    disabled={!bookingDraftDirty || updatingBookingId === String(selectedBooking.id || selectedBooking._id)}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:opacity-50 text-white py-3 sm:py-3.5 rounded-2xl text-[13px] sm:text-sm font-black transition-all"
                                  >
                                    {updatingBookingId === String(selectedBooking.id || selectedBooking._id) ? 'Saving...' : 'Update Booking'}
                                 </button>
                                 {canFinalizeBooking(selectedBooking) && (
                                   <button onClick={completeRide} className="bg-white text-slate-900 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-[13px] sm:text-sm font-black hover:bg-slate-100 transition-all">
                                      Finalize
                                   </button>
                                 )}
                              </div>
                           </div>
                        </div>
                      </div>
                    );
                  })()}
               {selectedBooking ? (
                 <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                    <div className="flex flex-col h-full">
                        {/* Header Summary */}
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-['Outfit'] text-xl font-bold text-slate-900 leading-tight">
                                {selectedBooking.bookingReference || 'Rental Booking'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusBadgeClass(selectedBooking.status)}`}>
                                  {selectedBooking.status}
                                </span>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-sm">
                                   <Clock size={10} className="text-emerald-400" />
                                   <span className="text-[9px] font-black uppercase tracking-widest">{getPossessionTime()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {new Date(selectedBooking.pickupDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-1 text-lg font-black text-slate-950">
                                <BadgeIndianRupee size={18} className="text-emerald-600" />
                                {Number(selectedBooking.totalCost || 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Content Area */}
                        <div className="divide-y divide-slate-100">
                          {/* 1. Customer & Documents */}
                          <CollapsibleSection 
                            title="Customer & Documents" 
                            icon={UserRound}
                            badge={`${customerDocumentCards.filter(d => d.imageUrl).length}/2 Uploaded`}
                          >
                            <div className="space-y-4">
                               <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                                      <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBooking.customer?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                                      <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedBooking.customer?.phone || 'N/A'}</p>
                                    </div>
                                  </div>
                               </div>

                               <div className="grid grid-cols-2 gap-3">
                                  {customerDocumentCards.map((doc) => (
                                    <div key={doc.key} className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 aspect-[4/3]">
                                      {doc.imageUrl ? (
                                        <>
                                          <img src={doc.imageUrl} className="h-full w-full object-cover transition group-hover:scale-105" alt={doc.label} />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                                            <p className="text-[10px] font-black text-white/90 uppercase tracking-widest">{doc.label}</p>
                                            <button 
                                              onClick={() => setPreviewImage(doc.imageUrl)}
                                              className="mt-2 w-full py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white text-[10px] font-bold hover:bg-white/30 transition"
                                            >
                                              View Full
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                                          <ShieldCheck size={24} className="text-slate-300 mb-2" />
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting {doc.label}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                               </div>
                            </div>
                          </CollapsibleSection>

                          {/* 2. Before Handover */}
                          <CollapsibleSection title="Pickup Inspection" icon={ClipboardList} badge="Before Handover">
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {beforeHandoverItems.map((item) => {
                                    const active = beforeInspection[item.key] === true;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => updateBookingInspection(selectedBooking.id || selectedBooking._id, 'beforeHandover', item.key, !active)}
                                        className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {active ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                                          <span className="text-[11px] font-bold">{item.label}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Handover Photos</label>
                                    <label className="cursor-pointer text-[10px] font-black text-emerald-600 hover:text-emerald-700">
                                      + ADD NEW
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadConditionImages(selectedBooking.id || selectedBooking._id, 'beforeConditionImages', e.target.files)} />
                                    </label>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {beforeConditionImages.map((img, i) => (
                                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-100">
                                        <img src={img} className="h-full w-full object-cover" alt="" />
                                        <button onClick={() => removeConditionImage(selectedBooking.id || selectedBooking._id, 'beforeConditionImages', img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Pickup KM</p>
                                      <input type="number" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-emerald-500/20" defaultValue={inspection.pickupMeterReading} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'pickupMeterReading', e.target.value)} />
                                   </div>
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Fuel Level</p>
                                      <input type="text" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-emerald-500/20" defaultValue={inspection.pickupFuelLevel} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'pickupFuelLevel', e.target.value)} />
                                   </div>
                                </div>
                             </div>
                          </CollapsibleSection>

                          {/* 3. After Return */}
                          <CollapsibleSection title="Return Inspection" icon={CheckCircle2} badge="After Return">
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {afterReturnItems.map((item) => {
                                    const active = afterInspection[item.key] === true;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => updateBookingInspection(selectedBooking.id || selectedBooking._id, 'afterReturn', item.key, !active)}
                                        className={`rounded-xl border p-3 text-left transition-all ${active ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {active ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                                          <span className="text-[11px] font-bold">{item.label}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Return Photos</label>
                                    <label className="cursor-pointer text-[10px] font-black text-amber-600 hover:text-amber-700">
                                      + ADD NEW
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadConditionImages(selectedBooking.id || selectedBooking._id, 'afterConditionImages', e.target.files)} />
                                    </label>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {afterConditionImages.map((img, i) => (
                                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-100">
                                        <img src={img} className="h-full w-full object-cover" alt="" />
                                        <button onClick={() => removeConditionImage(selectedBooking.id || selectedBooking._id, 'afterConditionImages', img)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Return KM</p>
                                      <input type="number" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-amber-500/20" defaultValue={inspection.returnMeterReading} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'returnMeterReading', e.target.value)} />
                                   </div>
                                   <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Return Fuel</p>
                                      <input type="text" className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold p-3 focus:ring-2 focus:ring-amber-500/20" defaultValue={inspection.returnFuelLevel} onBlur={(e) => updateBookingInspectionNotes(selectedBooking.id || selectedBooking._id, 'returnFuelLevel', e.target.value)} />
                                   </div>
                                </div>
                             </div>
                          </CollapsibleSection>
                        </div>

                        {/* Bottom Action Section */}
                        <div className="p-5 sm:p-6 bg-slate-900 text-white mt-auto rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                           <div className="space-y-5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 {permissions.canAssignBookings && (
                                   <div className="space-y-1.5">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Assign Staff</label>
                                      <select 
                                        value={bookingDraft.assignedStaffId} 
                                        onChange={(e) => setBookingDraft(c => ({...c, assignedStaffId: e.target.value}))}
                                        className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-[13px] font-bold py-2.5 px-3 focus:ring-2 focus:ring-white/20 appearance-none"
                                      >
                                        <option value="" className="text-slate-900">Unassigned</option>
                                        {bookingStaffOptions.map(s => <option key={s.id || s._id} value={s.id || s._id} className="text-slate-900">{s.name}</option>)}
                                      </select>
                                   </div>
                                 )}
                                 <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Status</label>
                                    <select 
                                      value={bookingDraft.status} 
                                      onChange={(e) => setBookingDraft(c => ({...c, status: e.target.value}))}
                                      className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-[13px] font-bold py-2.5 px-3 focus:ring-2 focus:ring-white/20 appearance-none"
                                    >
                                      <option value="pending" className="text-slate-900">Pending</option>
                                      <option value="confirmed" className="text-slate-900">Confirmed</option>
                                      <option value="assigned" className="text-slate-900">Assigned</option>
                                      <option value="end_requested" className="text-slate-900">End Requested</option>
                                      <option value="completed" className="text-slate-900">Completed</option>
                                    </select>
                                 </div>
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Internal Handling Notes</label>
                                 <textarea 
                                    rows={2}
                                    value={bookingDraft.serviceCenterNote}
                                    onChange={(e) => setBookingDraft(c => ({...c, serviceCenterNote: e.target.value}))}
                                    className="w-full bg-white/10 border-none rounded-xl text-[12px] sm:text-sm font-medium py-2 px-3 focus:ring-2 focus:ring-white/20 resize-none"
                                    placeholder="Add notes for the team..."
                                 />
                              </div>

                              <div className="flex items-center gap-3 pt-2">
                                 <button
                                    onClick={saveBookingDraft}
                                    disabled={!bookingDraftDirty || updatingBookingId === String(selectedBooking.id || selectedBooking._id)}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:opacity-50 text-white py-3 sm:py-3.5 rounded-2xl text-[13px] sm:text-sm font-black transition-all"
                                  >
                                    {updatingBookingId === String(selectedBooking.id || selectedBooking._id) ? 'Saving...' : 'Update Booking'}
                                 </button>
                                 {canFinalizeBooking(selectedBooking) && (
                                   <button onClick={completeRide} className="bg-white text-slate-900 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-[13px] sm:text-sm font-black hover:bg-slate-100 transition-all">
                                      Finalize
                                   </button>
                                 )}
                              </div>
                           </div>
                        </div>
                      </div>
                 </div>
               ) : (
                 <>
                   <div className="relative mb-6">
                     <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                       type="text" 
                       placeholder="Search by ID, name, or vehicle..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full bg-slate-50 border-slate-100 rounded-[20px] py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-200 transition-all"
                     />
                   </div>

                   {paginatedBookings.length > 0 ? (
                     <>
                       <div className="space-y-3">
                         {paginatedBookings.map((booking) => (
                           <motion.button
                             key={booking.id || booking._id}
                             whileHover={{ x: 4 }}
                             whileTap={{ scale: 0.99 }}
                             onClick={() => handleBookingOpen(booking.id || booking._id)}
                             className="w-full flex items-center gap-3 rounded-[24px] border border-slate-100 bg-white p-3 sm:p-4 text-left shadow-sm transition-all hover:border-emerald-200 hover:shadow-md group relative"
                           >
                             <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${statusBadgeClass(booking.status).replace('text-', 'bg-').split(' ')[0]} opacity-10 group-hover:opacity-20 transition-opacity`} />
                             <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl absolute left-3 sm:left-4">
                               <ClipboardList size={18} className={statusBadgeClass(booking.status).split(' ')[1]} />
                             </div>

                             <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between gap-2">
                                 <h3 className="font-['Outfit'] text-[13px] sm:text-[15px] font-bold text-slate-900 truncate">
                                   {booking.bookingReference || 'Rental Booking'}
                                 </h3>
                               </div>
                               
                               <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <p className="text-[10px] sm:text-[12px] font-bold text-slate-500">
                                   {booking.vehicleName || 'Vehicle'}
                                 </p>
                                 <span className="hidden sm:block h-1 w-1 rounded-full bg-slate-300" />
                                 <p className="text-[9px] sm:text-[11px] font-medium text-slate-400">
                                   {booking.customer?.name || 'Customer'}
                                 </p>
                               </div>
                               <div className="mt-1 sm:hidden">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${statusBadgeClass(booking.status)}`}>
                                   {booking.status}
                                 </span>
                               </div>
                             </div>

                             <div className="shrink-0 text-right space-y-0.5">
                               <p className="text-[12px] sm:text-[13px] font-black text-slate-900">₹{Number(booking.totalCost || 0)}</p>
                               <p className="text-[9px] font-bold text-slate-400">{new Date(booking.pickupDateTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                             </div>

                             <div className="hidden sm:flex ml-1 shrink-0 h-7 w-7 rounded-full bg-slate-50 items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-all">
                               <ChevronRight size={14} strokeWidth={3} />
                             </div>
                           </motion.button>
                         ))}
                       </div>

                       {totalPages > 1 && (
                         <div className="mt-8 flex items-center justify-between px-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
                            <div className="flex items-center gap-2">
                               <button 
                                 disabled={currentPage === 1}
                                 onClick={() => setCurrentPage(c => c - 1)}
                                 className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 disabled:opacity-30 transition hover:bg-slate-100 hover:text-slate-600"
                               >
                                  <ChevronRight size={16} className="rotate-180" />
                               </button>
                               <button 
                                 disabled={currentPage === totalPages}
                                 onClick={() => setCurrentPage(c => c + 1)}
                                 className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 disabled:opacity-30 transition hover:bg-slate-100 hover:text-slate-600"
                               >
                                  <ChevronRight size={16} />
                               </button>
                            </div>
                         </div>
                       )}
                     </>
                   ) : (
                     <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                        <Search size={32} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-sm font-bold text-slate-500">No matching bookings found</p>
                        <p className="mt-1 text-xs text-slate-400">Try searching for a different name or reference</p>
                     </div>
                   )}
                 </>
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
                onClick={openCreateVehicleForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Plus size={16} />
                Add Vehicle
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id || vehicle._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openVehicleEditor(vehicle)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openVehicleEditor(vehicle);
                      }
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/70"
                  >
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
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteVehicle(vehicle.id || vehicle._id);
                        }}
                        className="rounded-xl border border-rose-200 bg-white p-2 text-rose-500 transition hover:bg-rose-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-500">
                        Tap to view full details
                      </span>
                      <span className={`rounded-full px-3 py-1 ${vehicle?.status === 'inactive' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {vehicle?.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
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

      <div className="fixed inset-x-0 bottom-0 z-40 bg-transparent px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto max-w-3xl rounded-[26px] border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_-10px_28px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <div className={`grid gap-1.5 ${isStaffUser ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {tabs.map(({ id, label, shortLabel, helper, Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`rounded-[18px] px-1.5 py-2.5 text-center transition sm:px-2 ${
                  isActive ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'
                }`}
              >
                <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white/15' : 'bg-slate-100 text-slate-700'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.06em] sm:hidden">
                      {shortLabel || label}
                    </p>
                    <p className="hidden truncate text-[13px] font-bold sm:block">{label}</p>
                    <p className={`hidden truncate text-[11px] font-medium sm:block ${isActive ? 'text-emerald-50' : 'text-slate-400'}`}>{helper}</p>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewImage ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/75 p-4 backdrop-blur-sm">
            <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full overflow-hidden rounded-[28px] border border-white/15 bg-slate-950 shadow-[0_28px_100px_rgba(15,23,42,0.4)]">
                <button
                  type="button"
                  onClick={() => setPreviewImage('')}
                  className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
                <img src={previewImage} alt="Rental vehicle preview" className="max-h-[80vh] w-full object-contain" />
              </motion.div>
            </div>
          </motion.div>
        ) : null}

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
                    <h3 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                      {editingVehicleId ? 'Vehicle Details' : 'Add Rental Vehicle'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {editingVehicleId
                        ? 'View and edit the complete vehicle setup for this service-center listing.'
                        : 'This vehicle will be assigned directly to your service center.'}
                    </p>
                  </div>
                  <button type="button" onClick={closeVehicleForm} className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
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
                  <button type="button" onClick={closeVehicleForm} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="button" disabled={savingVehicle} onClick={handleCreateVehicle} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                    {savingVehicle ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {editingVehicleId ? 'Save Changes' : 'Save Vehicle'}
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
