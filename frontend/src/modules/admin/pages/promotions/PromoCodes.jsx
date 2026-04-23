import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Filter,
  ChevronRight,
  Trash2,
  Loader2,
  Ticket,
  MapPin,
  Users,
  Zap,
  Percent,
  ArrowLeft,
  Save,
  IndianRupee,
  Calendar,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

const BASE = globalThis.__LEGACY_BACKEND_ORIGIN__ + '/api/v1/admin/promos';
const LIST_PATH = '/admin/promotions/promo-codes';
const CREATE_PATH = '/admin/promotions/promo-codes/create';
const Motion = motion;

const inputClass =
  'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';
const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5';

const createInitialFormData = () => ({
  service_location_id: '',
  transport_type: '',
  user_specific: false,
  user_id: '',
  code: '',
  minimum_trip_amount: '',
  maximum_discount_amount: '',
  cumulative_max_discount_amount: '',
  discount_percentage: '',
  from: '',
  to: '',
  uses_per_user: '1',
  active: true,
});

const HeaderBlock = ({ isCreateRoute, onBack }) => (
  <div className="mb-6">
    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
      <span>Promotions</span>
      <ChevronRight size={12} />
      <span className="text-gray-700">{isCreateRoute ? 'Create Promo Code' : 'Promo Code'}</span>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold text-gray-900">{isCreateRoute ? 'Create Promo Code' : 'Promo Code'}</h1>
      {isCreateRoute ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
      ) : null}
    </div>
  </div>
);

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const FieldLabel = ({ icon: Icon, children, required = false }) => (
  <label className={labelClass}>
    <Icon size={12} className="inline mr-1 text-gray-400" />
    {children}
    {required ? ' *' : ''}
  </label>
);

const PromoCodes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCreateRoute = location.pathname === CREATE_PATH;

  const [promos, setPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [formData, setFormData] = useState(createInitialFormData);

  const token = localStorage.getItem('adminToken') || '';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const bootstrapRes = await fetch(`${globalThis.__LEGACY_BACKEND_ORIGIN__}/api/v1/admin/promotions/bootstrap`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (bootstrapRes.ok) {
        const bootstrapData = await bootstrapRes.json();
        if (bootstrapData.success) {
          setPromos(bootstrapData.data?.promo_codes || []);
          setLocations(bootstrapData.data?.service_locations || []);
          setUsersList(bootstrapData.data?.users || []);
          return;
        }
      }

      const [promosRes, locRes, usersRes] = await Promise.all([
        fetch(BASE, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(globalThis.__LEGACY_BACKEND_ORIGIN__ + '/api/v1/admin/service-locations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(globalThis.__LEGACY_BACKEND_ORIGIN__ + '/api/v1/admin/promos/users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const pData = await promosRes.json();
      const lData = await locRes.json();
      const uData = await usersRes.json();

      if (pData.success) setPromos(pData.data?.results || []);
      if (lData.success) setLocations(Array.isArray(lData.data) ? lData.data : lData.data?.results || []);
      if (uData.success) setUsersList(uData.data?.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isCreateRoute) {
      setFormData(createInitialFormData());
    }
  }, [isCreateRoute]);

  const handleFieldChange = (key, value) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleUserSpecificChange = (checked) => {
    setFormData((current) => ({
      ...current,
      user_specific: checked,
      user_id: checked ? current.user_id : '',
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        user_id: formData.user_specific ? formData.user_id : '',
      };

      const res = await fetch(BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setFormData(createInitialFormData());
        await fetchData();
        navigate(LIST_PATH);
      } else {
        alert(data.message || 'Failed to create promo');
      }
    } catch (error) {
      console.error(error);
      alert('Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPromos = promos;

  return (
    <div className="min-h-full bg-gray-50 text-gray-900">
      <HeaderBlock isCreateRoute={isCreateRoute} onBack={() => navigate(LIST_PATH)} />

      <AnimatePresence mode="wait">
        {!isCreateRoute ? (
          <Motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="font-medium text-gray-600">Promo codes management</span>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span>Total: {filteredPromos.length}</span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Filter size={16} /> Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(CREATE_PATH)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} /> Add Promo Code
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-500">
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Transport Type</th>
                      <th className="px-6 py-4">Service Location</th>
                      <th className="px-6 py-4">From - To Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-16 text-center text-sm text-gray-400">
                          Accessing Promotions Vault...
                        </td>
                      </tr>
                    ) : filteredPromos.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <Ticket size={44} strokeWidth={1.5} />
                            <p className="text-sm font-medium">No promo codes found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPromos.map((promo) => (
                        <tr key={promo._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                              {promo.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 capitalize">{promo.transport_type}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{promo.service_location_name || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {promo.from} to {promo.to}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                promo.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {promo.active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Motion.div>
        ) : (
          <Motion.form
            key="form"
            onSubmit={handleSave}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"
          >
            <div className="space-y-6">
              <SectionCard
                icon={Ticket}
                title="Promo Configuration"
                description="Create and target a redemption incentive without changing backend fields."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <FieldLabel icon={MapPin} required>
                      Service Locations
                    </FieldLabel>
                    <select
                      required
                      value={formData.service_location_id}
                      onChange={(e) => handleFieldChange('service_location_id', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select Service Locations</option>
                      {locations.map((locationItem) => (
                        <option key={locationItem._id} value={locationItem._id}>
                          {locationItem.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel icon={Zap} required>
                      Transport Type
                    </FieldLabel>
                    <select
                      required
                      value={formData.transport_type}
                      onChange={(e) => handleFieldChange('transport_type', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select</option>
                      <option value="taxi">Taxi</option>
                      <option value="delivery">Delivery</option>
                      <option value="all">All</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel icon={Users} required={formData.user_specific}>
                      Users
                    </FieldLabel>
                    <select
                      required={formData.user_specific}
                      disabled={!formData.user_specific}
                      value={formData.user_id}
                      onChange={(e) => handleFieldChange('user_id', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{formData.user_specific ? 'Select Users' : 'All Users'}</option>
                      {usersList.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel icon={ShieldCheck}>User Specific</FieldLabel>
                    <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={formData.user_specific}
                        onChange={(e) => handleUserSpecificChange(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Apply for selected user only</p>
                        <p className="text-xs text-gray-400">Unchecked rehne par promo all users ke liye available rahega.</p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <FieldLabel icon={Ticket} required>
                      Code
                    </FieldLabel>
                    <input
                      type="text"
                      placeholder="Enter Code"
                      required
                      value={formData.code}
                      onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={IndianRupee} required>
                      Minimum Trip Amount
                    </FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter Minimum Trip Amount"
                      required
                      value={formData.minimum_trip_amount}
                      onChange={(e) => handleFieldChange('minimum_trip_amount', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={IndianRupee} required>
                      Maximum Discount Amount
                    </FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter Maximum Discount Amount"
                      required
                      value={formData.maximum_discount_amount}
                      onChange={(e) => handleFieldChange('maximum_discount_amount', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={IndianRupee} required>
                      Cumulative Maximum Discount Amount
                    </FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter Cumulative Maximum Discount Amount"
                      required
                      value={formData.cumulative_max_discount_amount}
                      onChange={(e) => handleFieldChange('cumulative_max_discount_amount', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={Percent} required>
                      Discount Percentage
                    </FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter Discount Percentage"
                      required
                      value={formData.discount_percentage}
                      onChange={(e) => handleFieldChange('discount_percentage', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={Calendar} required>
                      From Date
                    </FieldLabel>
                    <input
                      type="date"
                      required
                      value={formData.from}
                      onChange={(e) => handleFieldChange('from', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <FieldLabel icon={Calendar} required>
                      To Date
                    </FieldLabel>
                    <input
                      type="date"
                      required
                      value={formData.to}
                      onChange={(e) => handleFieldChange('to', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel icon={Hash} required>
                      How many times the user can use Same promo code?
                    </FieldLabel>
                    <input
                      type="number"
                      min="1"
                      placeholder="Enter how many times the user can use same promo code"
                      required
                      value={formData.uses_per_user}
                      onChange={(e) => handleFieldChange('uses_per_user', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Promo Code
                </button>
                <button
                  type="button"
                  onClick={() => navigate(LIST_PATH)}
                  className="w-full py-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">How It Works</h3>
                <p className="text-xs leading-5 text-gray-500">
                  Service location, user targeting, discount limits, trip minimum, date range, and uses-per-user sab fields active hain.
                </p>
              </div>
            </div>
          </Motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PromoCodes;
