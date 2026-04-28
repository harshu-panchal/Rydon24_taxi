import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { socketService } from '../../../shared/api/socket';
import { useSettings } from '../../../shared/context/SettingsContext';
import { adminService } from '../services/adminService';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Bell,
  Briefcase,
  Car,
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Home,
  IndianRupee,
  Layers,
  LogOut,
  MapPin,
  MessageCircle,
  Monitor,
  Package,
  PlusCircle,
  Search,
  Settings,
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

const ADMIN_MODE = 'admin';
const OWNER_MODE = 'owner';
const MODE_STORAGE_KEY = 'adminPanelMode';
const SIDEBAR_EXPANSION_STORAGE_KEY = 'adminSidebarExpandedGroups';

const pathMatches = (pathname, targetPath) =>
  pathname === targetPath || pathname.startsWith(`${targetPath}/`);

const hasActiveChild = (pathname, items = []) =>
  items.some((item) => {
    if (item.path && pathMatches(pathname, item.path)) return true;
    if (item.subItems) return hasActiveChild(pathname, item.subItems);
    return false;
  });

const flattenItems = (sections = []) =>
  sections.flatMap((section) => section.items ?? []);

const flattenSearchEntries = (items = [], parentLabels = []) =>
  items.flatMap((item) => {
    const currentTrail = [...parentLabels, item.label].filter(Boolean);

    if (item.path) {
      return [
        {
          label: item.label,
          path: item.path,
          trail: parentLabels,
          keywords: currentTrail.join(' ').toLowerCase(),
        },
      ];
    }

    if (item.subItems) {
      return flattenSearchEntries(item.subItems, currentTrail);
    }

    return [];
  });

const NOTIFICATION_PAGE_SIZE = 5;

const dedupeAdminChatNotifications = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item.id || '').trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const formatRelativeAdminTime = (value) => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
};

const looksLikeCoordinateLabel = (value = '') =>
  /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(String(value || '').trim());

const formatAdminNotificationLocation = (value, fallback) => {
  const text = String(value || '').trim();

  if (!text || looksLikeCoordinateLabel(text)) {
    return fallback;
  }

  return text;
};

const resolvePageTitle = (pathname, sections, appName) => {
  const findLabel = (items = []) => {
    for (const item of items) {
      if (item.path && pathMatches(pathname, item.path)) return item.label;
      if (item.subItems) {
        const nested = findLabel(item.subItems);
        if (nested) return nested;
      }
    }
    return null;
  };

  const label = findLabel(flattenItems(sections));
  if (label) return label;
  if (pathname.includes('/owners')) return 'Owner Management';
  if (pathname.includes('/fleet')) return 'Fleet Management';
  if (pathname.includes('/settings')) return 'Settings';
  if (pathname.includes('/reports')) return 'Reports';
  return `${appName || 'App'} Admin`;
};

const SidebarItem = ({ icon, label, path, isCollapsed }) => (
  <NavLink
    to={path}
    end
    className={({ isActive }) =>
      `group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`
    }
  >
    {React.createElement(icon, { size: 18, className: 'shrink-0' })}
    {!isCollapsed && <span className="text-[14px] font-bold tracking-tight">{label}</span>}
  </NavLink>
);

const SidebarGroup = ({
  icon,
  label,
  subItems,
  isCollapsed,
  pathname,
  forceOpen = false,
  groupKey,
  expandedGroups,
  setExpandedGroups,
}) => {
  const isActive = hasActiveChild(pathname, subItems);
  const isOpen = expandedGroups.includes(groupKey);
  const isExpanded = forceOpen || isActive || isOpen;
  const toggleGroup = () => {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]
    );
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggleGroup}
        className={`group w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 ${
          isActive || isExpanded ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {React.createElement(icon, {
            size: 18,
            className: `shrink-0 ${isActive || isExpanded ? 'text-indigo-400' : ''}`,
          })}
          {!isCollapsed && <span className="text-[14px] font-bold tracking-tight">{label}</span>}
        </div>
        {!isCollapsed && (
          <ChevronRight size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        )}
      </button>

      {!isCollapsed && isExpanded && (
        <div className="pl-6 pr-2 space-y-1">
          {subItems.map((item) =>
            item.subItems ? (
              <NestedGroup
                key={item.label}
                label={item.label}
                subItems={item.subItems}
                pathname={pathname}
                forceOpen={forceOpen}
                groupKey={`${groupKey}:${item.label}`}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
              />
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive: childActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    childActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                  }`
                }
              >
                <div className="h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </div>
      )}
    </div>
  );
};

const NestedGroup = ({
  label,
  subItems,
  pathname,
  forceOpen = false,
  groupKey,
  expandedGroups,
  setExpandedGroups,
}) => {
  const isActive = hasActiveChild(pathname, subItems);
  const isOpen = expandedGroups.includes(groupKey);
  const isExpanded = forceOpen || isActive || isOpen;
  const toggleGroup = () => {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]
    );
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggleGroup}
        className={`group w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all ${
          isActive || isExpanded ? 'text-white' : 'text-slate-500 hover:text-slate-200'
        }`}
      >
        <span className="flex items-center gap-3 text-[12px] font-medium">
          <div className="h-1 w-1 shrink-0 rounded-full bg-slate-600" />
          <span>{label}</span>
        </span>
        <ChevronRight size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {isExpanded && (
        <div className="pl-4 space-y-1">
          {subItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive: childActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  childActive ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-300'
                }`
              }
            >
              <div className="h-0.5 w-0.5 shrink-0 rounded-full bg-slate-700" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

const ModeSwitcher = ({ mode, setMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { id: ADMIN_MODE, label: 'Admin', subtitle: 'Core control panel' },
    { id: OWNER_MODE, label: 'Owner', subtitle: 'Owner management modules' },
  ];

  const active = options.find((option) => option.id === mode) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:border-indigo-400/30 hover:shadow-md active:scale-95"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
          <Briefcase size={16} />
        </div>
        <div className="text-left leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Panel Mode</p>
          <p className="text-[13px] font-extrabold text-slate-900">{active.label}</p>
        </div>
        <ChevronDown size={14} className="text-slate-300 transition-transform group-hover:text-indigo-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option) => {
            const selected = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setMode(option.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                  selected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    selected ? 'bg-white' : 'bg-slate-300'
                  }`}
                />
                <span className="flex-1">
                  <span className={`block text-[13px] font-bold ${selected ? 'text-white' : 'text-slate-900'}`}>
                    {option.label}
                  </span>
                  <span className={`block text-[11px] ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {option.subtitle}
                  </span>
                </span>
                {selected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [isSidebarOpen] = useState(true);
  const [isCollapsed, setCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('ride_requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [rideRequestFeed, setRideRequestFeed] = useState({
    results: [],
    paginator: { current_page: 1, last_page: 1, total: 0 },
  });
  const [bookingsFeed, setBookingsFeed] = useState([]);
  const [chatNotifications, setChatNotifications] = useState([]);
  const [rideRequestPage, setRideRequestPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(SIDEBAR_EXPANSION_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  });
  const userMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);

  const appName = settings.general?.app_name || 'App';
  const appLogo = settings.general?.logo || settings.customization?.logo;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_EXPANSION_STORAGE_KEY,
      JSON.stringify(expandedSidebarGroups)
    );
  }, [expandedSidebarGroups]);

  const adminSections = useMemo(
    () => [
      {
        title: 'Home',
        items: [
          { icon: Home, label: 'Dashboard', path: '/admin/dashboard' },
          { icon: IndianRupee, label: 'Admin Earnings', path: '/admin/earnings' },
          { icon: MessageCircle, label: 'Chat', path: '/admin/chat' },
          {
            icon: TrendingUp,
            label: 'Promotions Management',
            subItems: [
              { label: 'Promo Code', path: '/admin/promotions/promo-codes' },
              { label: 'Push Notifications', path: '/admin/promotions/send-notification' },
              { label: 'Banner Image', path: '/admin/promotions/banner-image' },
            ],
          },
          {
            icon: IndianRupee,
            label: 'Price Management',
            subItems: [
              { label: 'Service Location', path: '/admin/pricing/service-location' },
              { label: 'Service Stores', path: '/admin/pricing/service-stores' },
              { label: 'Zone', path: '/admin/pricing/zone' },
              { label: 'Airport', path: '/admin/pricing/airport' },
              { label: 'App Modules', path: '/admin/pricing/app-modules' },
              { label: 'Vehicle Type', path: '/admin/pricing/vehicle-type' },
              { label: 'Rental Package Types', path: '/admin/pricing/rental-packages' },
              { label: 'Set Price', path: '/admin/pricing/set-price' },
              { label: 'Goods Types', path: '/admin/pricing/goods-types' },
            ],
          },
          {
            icon: Bus,
            label: 'Bus Service',
            path: '/admin/bus-service',
          },
          {
            icon: MapPin,
            label: 'Geofencing',
            subItems: [
              { label: 'Heat Map', path: '/admin/geo/heatmap' },
              { label: "God's Eye", path: '/admin/geo/gods-eye' },
              { label: 'Peak Zone', path: '/admin/geo/peak-zone' },
            ],
          },
          { icon: Car, label: 'Trip Requests', path: '/admin/trips' },
          { icon: Package, label: 'Delivery Requests', path: '/admin/deliveries' },
          { icon: Clock, label: 'Ongoing Requests', path: '/admin/ongoing' },
        ],
      },
      {
        title: 'Users',
        items: [
          {
            icon: Users,
            label: 'Customer Management',
            subItems: [
              { label: 'User List', path: '/admin/users' },
              { label: 'Delete Request Users', path: '/admin/users/delete-requests' },
              { label: 'User Bulk Upload', path: '/admin/users/bulk-upload' },
            ],
          },
          { icon: Wallet, label: 'Wallet Payment', path: '/admin/wallet/payment' },
          {
            icon: Car,
            label: 'Driver Management',
            subItems: [
              { label: 'Pending Drivers', path: '/admin/drivers/pending' },
              { label: 'Approved Drivers', path: '/admin/drivers' },
              { label: 'Active Drivers', path: '/admin/drivers/active' },
              { label: 'Subscription', path: '/admin/drivers/subscription' },
              { label: 'Drivers Ratings', path: '/admin/drivers/ratings' },
              {
                label: 'Driver Wallet',
                subItems: [
                  { label: 'Withdrawal Requests', path: '/admin/drivers/wallet/withdrawals' },
                  { label: 'Negative Balance Drivers', path: '/admin/drivers/wallet/negative' },
                ],
              },
              { label: 'Delete Request Drivers', path: '/admin/drivers/delete-requests' },
              { label: 'Driver Needed Documents', path: '/admin/drivers/documents' },
              { label: 'Driver Bulk Upload', path: '/admin/drivers/bulk-upload' },
              { label: 'Payment Methods', path: '/admin/drivers/payment-methods' },
            ],
          },
          {
            icon: Share2,
            label: 'Referral Management',
            subItems: [
              { label: 'Referral Dashboard', path: '/admin/referrals/dashboard' },
              { label: 'User Referral Settings', path: '/admin/referrals/user-settings' },
              { label: 'Driver Referral Settings', path: '/admin/referrals/driver-settings' },
              { label: 'Referral Translation', path: '/admin/referrals/translation' },
            ],
          },
          {
            icon: UserCog,
            label: 'Admin Management',
            subItems: [
              { label: 'Admins', path: '/admin/management/admins' },
            ],
          },
          { icon: Briefcase, label: 'Owner Management', path: '/admin/owners/dashboard' },
          {
            icon: FileText,
            label: 'Report',
            subItems: [
              { label: 'User Report', path: '/admin/reports/user' },
              { label: 'Driver Report', path: '/admin/reports/driver' },
              { label: 'Driver Duty Report', path: '/admin/reports/driver-duty' },
              { label: 'Owner Report', path: '/admin/reports/owner' },
              { label: 'Finance Report', path: '/admin/reports/finance' },
              { label: 'Fleet Finance Report', path: '/admin/reports/fleet-finance' },
            ],
          },
          {
            icon: ShieldCheck,
            label: 'Support Management',
            subItems: [
              { label: 'Ticket Title', path: '/admin/support/ticket-title' },
              { label: 'Support Tickets', path: '/admin/support/tickets' },
            ],
          },
        ],
      },
      {
        title: 'Masters',
        items: [
          { icon: Globe, label: 'Language', path: '/admin/masters/languages' },
          // { icon: Star, label: 'Preferences', path: '/admin/masters/preferences' },
          // { icon: ShieldCheck, label: 'Roles', path: '/admin/masters/roles' },
        ],
      },
      {
        title: 'Settings',
        items: [
          {
            icon: Settings,
            label: 'Business Settings',
            subItems: [
              { label: 'General Settings', path: '/admin/settings/business/general' },
              { label: 'Customization Settings', path: '/admin/settings/business/customization' },
              { label: 'Transport Ride Settings', path: '/admin/settings/business/transport-ride' },
              { label: 'Bid Ride Settings', path: '/admin/settings/business/bid-ride' },
            ],
          },
          {
            icon: Smartphone,
            label: 'App Settings',
            subItems: [
              { label: 'Wallet Settings', path: '/admin/settings/app/wallet' },
              { label: 'Tip Settings', path: '/admin/settings/app/tip' },
              { label: 'Mobile App Landing/Onboard Screens Settings', path: '/admin/settings/app/onboard' },
            ],
          },
          {
            icon: Settings2,
            label: 'Third-party Settings',
            subItems: [
              { label: 'Payment Gateway Settings', path: '/admin/settings/third-party/payment' },
              { label: 'SMS Gateway Settings', path: '/admin/settings/third-party/sms' },
              { label: 'Firebase Settings', path: '/admin/settings/third-party/firebase' },
              { label: 'Map and Map APIs Settings', path: '/admin/settings/third-party/map-apis' },
              { label: 'Mail Configuration', path: '/admin/settings/third-party/mail' },
              // { label: 'Notification Channel', path: '/admin/settings/third-party/notification-channel' },
            ],
          },
          // {
          //   icon: PlusCircle,
          //   label: 'Addons',
          //   subItems: [{ label: 'Dispatcher Addons', path: '/admin/settings/addons/dispatcher' }],
          // },
          {
            icon: Monitor,
            label: 'CMS-Landing Website',
            subItems: [
              { label: 'Header-Footer', path: '/admin/settings/cms/header-footer' },
              { label: 'Home', path: '/admin/settings/cms/home' },
              { label: 'About Us', path: '/admin/settings/cms/about' },
              { label: 'Driver', path: '/admin/settings/cms/driver' },
              { label: 'User', path: '/admin/settings/cms/user' },
              { label: 'Contact', path: '/admin/settings/cms/contact' },
              { label: 'Privacy Policy, T&C and DMV', path: '/admin/settings/cms/legal' },
            ],
          },
        ],
      },
    ],
    []
  );

  const ownerSections = useMemo(
    () => [
      {
        title: 'Owner Mode',
        items: [
          {
            icon: Briefcase,
            label: 'Owner Management',
            subItems: [
              { label: 'Owner Dashboard', path: '/admin/owners/dashboard' },
              { label: 'Pending Owners', path: '/admin/owners/pending' },
              { label: 'Manage Owners', path: '/admin/owners' },
              {
                label: 'Owner Wallet',
                subItems: [{ label: 'Withdrawal Requests', path: '/admin/owners/wallet/withdrawals' }],
              },
              {
                label: 'Fleet Management',
                subItems: [
                  { label: 'Fleet Drivers', path: '/admin/fleet/drivers' },
                  { label: 'Pending Fleet Drivers', path: '/admin/fleet/blocked' },
                  { label: 'Fleet Needed Document', path: '/admin/fleet/documents' },
                  { label: 'Manage Fleet', path: '/admin/fleet/manage' },
                ],
              },
              { label: 'Owner Needed Document', path: '/admin/owners/documents' },
              { label: 'Deleted Owners', path: '/admin/owners/deleted' },
              { label: 'Bookings', path: '/admin/owners/bookings' },
            ],
          },
        ],
      },
    ],
    []
  );

  const isOwnerRoute = location.pathname.startsWith('/admin/owners') || location.pathname.startsWith('/admin/fleet');
  const mode = isOwnerRoute ? OWNER_MODE : ADMIN_MODE;
  const sidebarSections = mode === OWNER_MODE ? ownerSections : adminSections;
  const pageTitle = resolvePageTitle(location.pathname, sidebarSections, appName);
  const searchEntries = useMemo(() => flattenSearchEntries(flattenItems(sidebarSections)), [sidebarSections]);
  const filteredSearchEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return searchEntries.slice(0, 10);
    }

    return searchEntries
      .filter((entry) => entry.keywords.includes(query) || entry.path.toLowerCase().includes(query))
      .slice(0, 14);
  }, [searchEntries, searchTerm]);

  const pagedBookings = useMemo(() => {
    const total = bookingsFeed.length;
    const lastPage = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
    const currentPage = Math.min(bookingPage, lastPage);
    const start = (currentPage - 1) * NOTIFICATION_PAGE_SIZE;

    return {
      results: bookingsFeed.slice(start, start + NOTIFICATION_PAGE_SIZE),
      paginator: {
        current_page: currentPage,
        last_page: lastPage,
        total,
      },
    };
  }, [bookingPage, bookingsFeed]);

  const activeNotificationMeta =
    notificationTab === 'ride_requests'
      ? rideRequestFeed.paginator
      : notificationTab === 'bookings'
        ? pagedBookings.paginator
        : { current_page: 1, last_page: 1, total: chatNotifications.length };

  const totalNotificationItems =
    Number(rideRequestFeed?.paginator?.total || 0) + Number(bookingsFeed.length || 0) + Number(chatNotifications.length || 0);

  const setMode = (nextMode) => {
    localStorage.setItem(MODE_STORAGE_KEY, nextMode);

    if (nextMode === OWNER_MODE && !isOwnerRoute) {
      navigate('/admin/owners/dashboard');
    }

    if (nextMode === ADMIN_MODE && isOwnerRoute) {
      navigate('/admin/dashboard');
    }
  };

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false);
      }

      if (!notificationsMenuRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    setIsSearchOpen(false);
    setSearchTerm('');
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    let isMounted = true;

    const fetchNotifications = async () => {
      setNotificationsLoading(true);

      try {
        if (notificationTab === 'ride_requests') {
          const response = await adminService.getRideRequests({
            page: rideRequestPage,
            limit: NOTIFICATION_PAGE_SIZE,
            tab: 'all',
            search: '',
          });

          if (!isMounted) return;

          setRideRequestFeed({
            results: response?.data?.results || response?.results || [],
            paginator: response?.data?.paginator || response?.paginator || { current_page: 1, last_page: 1, total: 0 },
          });
          return;
        }

        if (notificationTab === 'chats') {
          return;
        }

        const response = await adminService.getOwnerBookings();
        if (!isMounted) return;

        setBookingsFeed(response?.data?.results || response?.results || []);
      } catch (error) {
        console.error('Failed to load admin notifications:', error);

        if (!isMounted) return;

        if (notificationTab === 'ride_requests') {
          setRideRequestFeed({
            results: [],
            paginator: { current_page: 1, last_page: 1, total: 0 },
          });
        } else if (notificationTab === 'bookings') {
          setBookingsFeed([]);
        }
      } finally {
        if (isMounted) {
          setNotificationsLoading(false);
        }
      }
    };

    fetchNotifications();

    return () => {
      isMounted = false;
    };
  }, [bookingPage, isNotificationsOpen, notificationTab, rideRequestPage]);

  useEffect(() => {
    if (!isSearchOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token && !window.location.pathname.includes('/admin/login')) {
      navigate('/admin/login');
      return undefined;
    }

    if (!token) return undefined;

    socketService.connect({ role: 'admin', token });

    socketService.on('new_sos', (data) => {
      console.log('SOS ALERT RECEIVED:', data);
      alert(`SOS ALERT: Driver ${data.driver_name} is in trouble!`);
    });

    socketService.on('new_driver_registration', (data) => {
      console.log('New driver registration:', data);
    });

    const handleSupportChatNotification = (payload = {}) => {
      const senderRole = String(payload.senderRole || payload.sender?.role || '').toLowerCase();
      const receiverRole = String(payload.receiverRole || payload.receiver?.role || '').toLowerCase();
      const messageBody = String(payload.message || payload.body || '').trim();

      if (!messageBody || senderRole === 'admin' || receiverRole !== 'admin') {
        return;
      }

      const senderName =
        String(payload.sender?.name || '').trim() ||
        (senderRole === 'driver' ? 'Driver' : senderRole === 'user' ? 'User' : 'Support contact');

      const nextItem = {
        id: `support-chat:${payload.id || payload._id || payload.conversationKey || `${Date.now()}-${messageBody}`}`,
        title: `${senderName} sent a new chat`,
        body: messageBody,
        senderRole: senderRole || 'user',
        createdAt: payload.createdAt || new Date().toISOString(),
      };

      let wasAdded = false;

      setChatNotifications((current) => {
        const next = dedupeAdminChatNotifications([nextItem, ...current]).slice(0, 25);
        wasAdded = next.some((item) => item.id === nextItem.id) && !current.some((item) => item.id === nextItem.id);
        return next;
      });

      if (wasAdded) {
        toast(nextItem.body, {
          duration: 4500,
          className: 'font-bold text-[13px] rounded-2xl shadow-xl border border-sky-50 bg-white',
        });
      }
    };

    socketService.on('chat:message', handleSupportChatNotification);

    return () => {
      socketService.off('new_sos');
      socketService.off('new_driver_registration');
      socketService.off('chat:message', handleSupportChatNotification);
    };
  }, [navigate]);

  const handleLogout = () => {
    socketService.disconnect();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    setIsUserMenuOpen(false);
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] font-sans text-gray-900">
      <aside
        className={`relative z-50 flex h-screen flex-col overflow-hidden bg-[#0F172A] transition-all duration-500 ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-full flex-col">
          <div className="group/sidebar-head relative mb-4 flex h-24 items-center border-b border-white/5 px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 bg-white/5 p-1 transition-all group-hover/sidebar-head:scale-105">
                {settings.general?.logo || settings.customization?.logo ? (
                  <img src={settings.general?.logo || settings.customization?.logo} alt={appName} className="h-10 w-10 object-contain" />
                ) : (
                  <Zap size={24} className="text-white fill-white" />
                )}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <h3 className="text-[15px] font-extrabold leading-tight text-white tracking-tight">
                    {mode === OWNER_MODE ? 'Owner Dashboard' : `${appName || 'App'} Admin`}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {mode === OWNER_MODE ? 'Fleet Control' : 'System Admin'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              className="absolute -right-3 top-9 z-[60] hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-lg ring-4 ring-[#0F172A] transition-all hover:bg-indigo-600 hover:text-white hover:border-indigo-500 hover:scale-110 active:scale-90 lg:flex group/collapse"
            >
              {isCollapsed ? (
                <ChevronRight size={12} strokeWidth={3.5} className="transition-transform group-hover/collapse:translate-x-0.5" />
              ) : (
                <ChevronLeft size={12} strokeWidth={3.5} className="transition-transform group-hover/collapse:-translate-x-0.5" />
              )}
            </button>
          </div>

          <nav className="no-scrollbar mt-0 flex-1 space-y-8 overflow-y-auto px-4 pb-12 scroll-smooth">
            {sidebarSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-4 mb-4 flex items-center gap-2">
                    <div className="h-3 w-1 rounded-full bg-white" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-white/90">
                      {section.title}
                    </span>
                  </div>
                )}
                {section.items.map((item) =>
                  item.subItems ? (
                    <SidebarGroup
                      key={item.label}
                      {...item}
                      forceOpen={mode === OWNER_MODE}
                      isCollapsed={isCollapsed}
                      pathname={location.pathname}
                      groupKey={`${section.title}:${item.label}`}
                      expandedGroups={expandedSidebarGroups}
                      setExpandedGroups={setExpandedSidebarGroups}
                    />
                  ) : (
                    <SidebarItem key={item.path} {...item} isCollapsed={isCollapsed} />
                  )
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f0f4f8]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-indigo-600" />
            <h2 className="text-[15px] font-bold tracking-tight text-slate-800">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-3">
            <ModeSwitcher mode={mode} setMode={setMode} />

            <div className="mr-1 flex items-center gap-1 border-r border-gray-100 pr-4 leading-none">
              <button
                type="button"
                onClick={() => setIsSearchOpen((current) => !current)}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
              >
                <Search size={18} />
              </button>

              <div ref={notificationsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen((current) => !current)}
                  className="relative rounded-lg p-2 text-gray-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <Bell size={18} />
                  {totalNotificationItems > 0 ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                  ) : null}
                </button>

                <div
                  className={`absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-2xl transition-all ${
                    isNotificationsOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                  }`}
                >
                  <div className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">Notifications</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          Latest bookings, ride requests, and support chats
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                        {totalNotificationItems}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationTab('ride_requests');
                          setRideRequestPage(1);
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          notificationTab === 'ride_requests'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Ride Requests
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationTab('bookings');
                          setBookingPage(1);
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          notificationTab === 'bookings'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Bookings
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationTab('chats');
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          notificationTab === 'chats'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Chats
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-3">
                    {notificationsLoading ? (
                      <div className="flex items-center justify-center px-4 py-12 text-sm font-semibold text-slate-500">
                        Loading notifications...
                      </div>
                    ) : notificationTab === 'ride_requests' ? (
                      rideRequestFeed.results.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                          <p className="text-sm font-bold text-slate-900">No ride requests found</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">New ride requests will show up here.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rideRequestFeed.results.map((item) => (
                            <button
                              key={item.id || item.requestId}
                              type="button"
                              onClick={() => {
                                navigate('/admin/trips');
                                setIsNotificationsOpen(false);
                              }}
                              className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/40"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {item.requestId} · {item.userName}
                                  </p>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                    Pickup: {formatAdminNotificationLocation(item.pickupLabel, 'Pickup location set')}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  {item.tripStatus || 'Upcoming'}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
                                <span>
                                  Destination: {formatAdminNotificationLocation(item.dropLabel, 'Destination set')}
                                </span>
                                <span>{formatRelativeAdminTime(item.date)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )
                    ) : notificationTab === 'bookings' ? pagedBookings.results.length === 0 ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-900">No bookings found</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Recent bookings will show up here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pagedBookings.results.map((item) => (
                          <button
                            key={item._id || item.id || item.booking_reference}
                            type="button"
                            onClick={() => {
                              navigate('/admin/owners/bookings');
                              setIsNotificationsOpen(false);
                            }}
                            className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {item.booking_reference || 'Booking'} · {item.customer_name || 'Customer'}
                                </p>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                  {item.pickup_location || 'Pickup'} to {item.dropoff_location || 'Drop'}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                {item.booking_status || 'Pending'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
                              <span>{item.owner_id?.name || item.owner_id?.company_name || 'Owner booking'}</span>
                              <span>{formatRelativeAdminTime(item.trip_date || item.createdAt)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : chatNotifications.length === 0 ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-900">No new chats found</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">New user and driver support messages will show up here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chatNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              navigate('/admin/chat');
                              setChatNotifications([]);
                              setIsNotificationsOpen(false);
                            }}
                            className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.body}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                                {item.senderRole}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-end text-[11px] font-semibold text-slate-400">
                              <span>{formatRelativeAdminTime(item.createdAt)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      disabled={(activeNotificationMeta?.current_page || 1) <= 1}
                      onClick={() => {
                        if (notificationTab === 'ride_requests') {
                          setRideRequestPage((current) => Math.max(1, current - 1));
                        } else {
                          setBookingPage((current) => Math.max(1, current - 1));
                        }
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Page {activeNotificationMeta?.current_page || 1} of {activeNotificationMeta?.last_page || 1}
                    </span>

                    <button
                      type="button"
                      disabled={(activeNotificationMeta?.current_page || 1) >= (activeNotificationMeta?.last_page || 1)}
                      onClick={() => {
                        if (notificationTab === 'ride_requests') {
                          setRideRequestPage((current) => current + 1);
                        } else {
                          setBookingPage((current) => current + 1);
                        }
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                className="group flex cursor-pointer items-center gap-3 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 transition-all hover:bg-gray-100"
                onClick={() => setIsUserMenuOpen((current) => !current)}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-all group-hover:bg-primary group-hover:text-white">
                  <Users size={14} />
                </div>
                <span className="text-[11px] font-black text-gray-950">Admin</span>
                <ChevronDown size={14} className="text-gray-300" />
              </button>

              <div
                className={`absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl transition-all ${
                  isUserMenuOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-600 transition-all hover:bg-red-50"
                >
                  <LogOut size={16} />
                  <span className="text-[12px] font-bold">Logout Session</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {isSearchOpen && (
          <div
            className="fixed inset-0 z-[70] bg-slate-900/10 backdrop-blur-[1px]"
            onClick={() => setIsSearchOpen(false)}
          >
            <div className="mx-auto mt-20 w-full max-w-2xl px-4">
              <div
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Search size={18} className="text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search sidebar options..."
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-200/70"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto p-3">
                  {filteredSearchEntries.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                      <p className="text-sm font-bold text-slate-900">No sidebar option found</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Try searching for drivers, trips, pricing, reports, or settings.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSearchEntries.map((entry) => (
                        <button
                          key={entry.path}
                          type="button"
                          onClick={() => {
                            navigate(entry.path);
                            setIsSearchOpen(false);
                            setSearchTerm('');
                          }}
                          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{entry.label}</p>
                            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                              {[...entry.trail, entry.path].join(' • ')}
                            </p>
                          </div>
                          <ChevronRight size={16} className="shrink-0 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="no-scrollbar flex-1 overflow-y-auto p-4 scroll-smooth lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
