import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DELHI_CENTER, HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../utils/googleMaps';

const mapContainerStyle = { width: '100%', height: '100%' };

const DriverDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isLoaded, loadError } = useAppGoogleMapsLoader();
  const [activeTab, setActiveTab] = useState('Driver Profile');
  const [profile, setProfile] = useState(null);
  const [walletForm, setWalletForm] = useState({ amount: '', operation: 'credit', isSubmitting: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const tabs = [
    'Driver Profile',
    'Request List',
    'Payment History',
    'Withdrawal History',
    'Review History',
    'Documents',
    'Subscription',
  ];

  const fetchProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('adminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${globalThis.__LEGACY_BACKEND_ORIGIN__}/api/v1/admin/drivers/${id}/profile`,
        { headers },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.data);
      } else {
        setError(data.message || 'Unable to load driver profile');
      }
    } catch (err) {
      setError('Unable to load driver profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && tabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const mapCenter = useMemo(() => {
    if (!profile?.location?.lat || !profile?.location?.lng) return DELHI_CENTER;
    return { lat: profile.location.lat, lng: profile.location.lng };
  }, [profile]);

  const stats = profile?.stats || {};
  const earnings = profile?.earnings || {};
  const requests = profile?.requests || [];
  const withdrawals = profile?.withdrawals || [];
  const documents = useMemo(() => {
    const raw = profile?.documents;
    if (Array.isArray(raw)) {
      return raw.map((doc) => {
        const images = Array.isArray(doc?.images)
          ? doc.images.filter(Boolean)
          : doc?.image
            ? [doc.image]
            : doc?.url
              ? [doc.url]
              : [];
        return {
          name: doc?.name || '',
          identify_number: doc?.identify_number ?? doc?.identifyNumber ?? doc?.number ?? doc?.id_number ?? '',
          expiry_date: doc?.expiry_date ?? doc?.expiryDate ?? doc?.expiry ?? '',
          status: doc?.status ?? '',
          comment: doc?.comment ?? '',
          images,
        };
      });
    }
    if (!raw || typeof raw !== 'object') {
      return [];
    }
    return Object.entries(raw).flatMap(([key, value]) => {
      if (!value) return [];
      const normalizeOne = (doc) => {
        const images = Array.isArray(doc?.images)
          ? doc.images.filter(Boolean)
          : doc?.image
            ? [doc.image]
            : doc?.url
              ? [doc.url]
              : [];
        return {
          name: doc?.name || key,
          identify_number: doc?.identify_number ?? doc?.identifyNumber ?? doc?.number ?? doc?.id_number ?? '',
          expiry_date: doc?.expiry_date ?? doc?.expiryDate ?? doc?.expiry ?? '',
          status: doc?.status ?? '',
          comment: doc?.comment ?? '',
          images,
        };
      };
      return Array.isArray(value) ? value.map(normalizeOne) : [normalizeOne(value)];
    });
  }, [profile]);
  const chart = profile?.chart || { months: [], earnings: [], trips: { completed: [], cancelled: [] } };

  const acceptanceRate = requests.length
    ? Math.round((stats.completed_trips / requests.length) * 100)
    : 0;
  const cancellationRate = requests.length
    ? Math.round((stats.cancelled_trips / requests.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Loading driver profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-rose-600">{error || 'Driver not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 font-sans text-gray-900">
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Drivers</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">Driver Profile</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Driver Profile</h1>
          <button
            onClick={() => navigate('/admin/drivers')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-6 items-center">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
              <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{profile.name}</h2>
              <p className="text-sm text-gray-500">{profile.city || 'India'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <span>{profile.phone || profile.mobile || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-gray-400" />
              <span>{profile.email || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span>{profile.joined_at}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={profile.vehicle_image}
                alt="Vehicle"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-sm text-gray-600">
              <p className="text-gray-900 font-semibold">{profile.vehicle?.type || 'Vehicle'}</p>
              <p>{profile.vehicle?.make}</p>
              <p>{profile.vehicle?.model}</p>
              <p>{profile.vehicle?.number}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-2 flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab !== 'Driver Profile' ? (
        <>
          {activeTab === 'Request List' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Completed Rides</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.completed_trips || 0}</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Acceptance Rate</p>
                    <p className="text-2xl font-semibold text-gray-900">{acceptanceRate}%</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Cancellation Rate</p>
                    <p className="text-2xl font-semibold text-gray-900">{cancellationRate}%</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Cancelled Rides</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.cancelled_trips || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                        <th className="px-6 py-3">Request Id</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">User Name</th>
                        <th className="px-4 py-3">Driver Name</th>
                        <th className="px-4 py-3">Trip Status</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Payment Option</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-gray-400">No data found.</td>
                        </tr>
                      ) : (
                        requests.map((item) => (
                          <tr key={item.request_id}>
                            <td className="px-6 py-3">{item.request_id.slice(-8).toUpperCase()}</td>
                            <td className="px-4 py-3">
                              {item.date ? new Date(item.date).toLocaleString('en-IN') : 'N/A'}
                            </td>
                            <td className="px-4 py-3">{item.user_name}</td>
                            <td className="px-4 py-3">{item.driver_name}</td>
                            <td className="px-4 py-3 capitalize">{item.trip_status}</td>
                            <td className="px-4 py-3">{item.paid ? 'Yes' : 'No'}</td>
                            <td className="px-4 py-3 capitalize">{item.payment_option}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Payment History' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-2xl font-semibold text-gray-900">₹ {earnings.total_earnings || 0}</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Spend Amount</p>
                    <p className="text-2xl font-semibold text-gray-900">₹ {earnings.spend_amount || 0}</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Balance Amount</p>
                    <p className="text-2xl font-semibold text-gray-900">₹ {earnings.balance_amount || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Credit or Debit wallet</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount *</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                      placeholder="Enter Amount"
                      value={walletForm.amount}
                      onChange={(e) => setWalletForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Operation *</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                      value={walletForm.operation}
                      onChange={(e) => setWalletForm((prev) => ({ ...prev, operation: e.target.value }))}
                    >
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={walletForm.isSubmitting || !walletForm.amount}
                    onClick={async () => {
                      setWalletForm((prev) => ({ ...prev, isSubmitting: true }));
                      try {
                        const token = localStorage.getItem('adminToken');
                        await fetch(
                          `${globalThis.__LEGACY_BACKEND_ORIGIN__}/api/v1/admin/wallet/drivers/${id}/adjust`,
                          {
                            method: 'POST',
                            headers: {
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              amount: Number(walletForm.amount),
                              operation: walletForm.operation,
                            }),
                          },
                        );
                        setWalletForm({ amount: '', operation: 'credit', isSubmitting: false });
                        await fetchProfile();
                      } catch (err) {
                        setWalletForm((prev) => ({ ...prev, isSubmitting: false }));
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    {walletForm.isSubmitting ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Withdrawal History' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Mobile Number</th>
                      <th className="px-4 py-3">Requested Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-400">No data found.</td>
                      </tr>
                    ) : (
                      withdrawals.map((item) => (
                        <tr key={item._id}>
                          <td className="px-6 py-3">{item.date ? new Date(item.date).toLocaleString('en-IN') : 'N/A'}</td>
                          <td className="px-4 py-3">{item.name}</td>
                          <td className="px-4 py-3">{item.mobile}</td>
                          <td className="px-4 py-3">₹ {item.requested_amount}</td>
                          <td className="px-4 py-3 capitalize">{item.status}</td>
                          <td className="px-4 py-3">-</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Review History' && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
              No reviews found.
            </div>
          )}

          {activeTab === 'Documents' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                      <th className="px-6 py-3">Document Name</th>
                      <th className="px-4 py-3">Identify Number</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Comment</th>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-400">No documents found.</td>
                      </tr>
                    ) : (
                      documents.map((doc, idx) => (
                        <tr key={`${doc.name}-${idx}`}>
                          <td className="px-6 py-3">{doc.name}</td>
                          <td className="px-4 py-3">{doc.identify_number}</td>
                          <td className="px-4 py-3">{doc.expiry_date}</td>
                          <td className="px-4 py-3 capitalize">{doc.status}</td>
                          <td className="px-4 py-3">{doc.comment}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(doc.images || []).slice(0, 1).map((url, i) => (
                                <button
                                  key={`view-${i}`}
                                  onClick={() => window.open(url, '_blank')}
                                  className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                                >
                                  <Eye size={12} /> View
                                </button>
                              ))}
                              {(doc.images || []).slice(0, 1).map((url, i) => (
                                <a
                                  key={`download-${i}`}
                                  href={url}
                                  download
                                  className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors inline-flex items-center gap-1"
                                >
                                  <Download size={12} /> Download
                                </a>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-md hover:bg-rose-100 transition-colors">
                              Decline
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Subscription' && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
              No subscription data available.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">General Report</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-500">Today Trips</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.today_trips || 0}</p>
              </div>
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-500">Today Earnings</p>
                <p className="text-2xl font-semibold text-gray-900">₹ {earnings.today_earnings || 0}</p>
              </div>
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Trips</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_trips || 0}</p>
              </div>
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Earnings</p>
                <p className="text-2xl font-semibold text-gray-900">₹ {earnings.total_earnings || 0}</p>
              </div>
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm text-gray-500">Today Cancelled</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.today_cancelled || 0}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Driver Location</h3>
              <div className="h-80 rounded-xl overflow-hidden border border-gray-100">
                {loadError ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500 bg-gray-50">
                    Map unavailable.
                  </div>
                ) : HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={13}
                    options={{ streetViewControl: false, mapTypeControl: true, fullscreenControl: true }}
                  >
                    <MarkerF position={mapCenter} />
                  </GoogleMap>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-500 bg-gray-50">
                    Configure `VITE_GOOGLE_MAPS_API_KEY` to show map.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Earnings</h3>
              <div className="h-52 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="relative h-full">
                  <ChartGrid height={170} />
                  <svg viewBox="0 0 400 170" className="absolute inset-0 w-full h-full">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points={buildLinePoints(chart.earnings || [], 400, 170)}
                    />
                  </svg>
                </div>
                <div className="mt-3 grid grid-cols-4 text-xs text-gray-400">
                  {(chart.months || []).map((m) => (
                    <span key={m} className="text-center">{m}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Today Earnings</p>
                  <p className="text-lg font-semibold">₹ {earnings.today_earnings || 0}</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Admin Commission</p>
                  <p className="text-lg font-semibold">₹ {earnings.admin_commission || 0}</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Drivers Earnings</p>
                  <p className="text-lg font-semibold">₹ {earnings.driver_earnings || 0}</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">By Cash</p>
                  <p className="text-lg font-semibold">₹ {earnings.by_cash || 0}</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">By Wallet</p>
                  <p className="text-lg font-semibold">₹ {earnings.by_wallet || 0}</p>
                </div>
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">By Card/Online</p>
                  <p className="text-lg font-semibold">₹ {earnings.by_card || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Trips</h3>
            <div className="h-52 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
              <div className="relative h-full">
                <ChartGrid height={170} />
                <svg viewBox="0 0 400 170" className="absolute inset-0 w-full h-full">
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    points={buildLinePoints(chart.trips?.completed || [], 400, 170)}
                  />
                  <polyline
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    points={buildLinePoints(chart.trips?.cancelled || [], 400, 170)}
                  />
                </svg>
              </div>
              <div className="mt-3 grid grid-cols-4 text-xs text-gray-400">
                {(chart.months || []).map((m) => (
                  <span key={m} className="text-center">{m}</span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Completed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Cancelled
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-gray-100 rounded-lg p-3">
                <p className="text-xs text-gray-500">Completed Trips</p>
                <p className="text-lg font-semibold">{stats.completed_trips || 0}</p>
              </div>
              <div className="border border-gray-100 rounded-lg p-3">
                <p className="text-xs text-gray-500">Cancelled Trips</p>
                <p className="text-lg font-semibold">{stats.cancelled_trips || 0}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DriverDetails;
  const buildLinePoints = (values, width, height, padding = 16) => {
    if (!values.length) return '';
    const maxValue = Math.max(...values, 1);
    const stepX = (width - padding * 2) / (values.length - 1 || 1);
    return values
      .map((value, index) => {
        const x = padding + index * stepX;
        const y = height - padding - (Number(value) / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const ChartGrid = ({ height = 180 }) => (
    <svg viewBox={`0 0 400 ${height}`} className="w-full h-full">
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="24"
          x2="376"
          y1={24 + i * ((height - 48) / 3)}
          y2={24 + i * ((height - 48) / 3)}
          stroke="#e5e7eb"
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  );
