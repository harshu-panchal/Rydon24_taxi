import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileUp, MapPin, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'admin_management_admins_v1';

const inputClass =
  'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors';
const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5';

const loadAdmins = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveAdmins = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const AdminCreate = () => {
  const navigate = useNavigate();
  const roles = useMemo(() => ['Manager', 'Finance Analyst', 'Operations Manager'], []);
  const areas = useMemo(() => ['India', 'UAE', 'Saudi', 'Qatar'], []);
  const countries = useMemo(() => ['India', 'UAE', 'Saudi Arabia', 'Qatar'], []);

  const [form, setForm] = useState({
    role: '',
    area: '',
    name: '',
    address: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
    state: '',
    city: '',
    postalCode: '',
    image: null,
    active: true,
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const mobile = form.mobile.trim();

    if (!form.role || !form.area || !name || !email || !mobile || !form.password) {
      return;
    }
    if (form.password !== form.confirmPassword) {
      return;
    }

    const existing = loadAdmins();
    const next = [
      {
        _id: `adm_${Date.now()}`,
        role: form.role,
        area: form.area,
        name,
        address: form.address.trim(),
        mobile,
        email,
        country: form.country,
        state: form.state.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        active: Boolean(form.active),
        createdAt: new Date().toISOString(),
      },
      ...existing,
    ];

    saveAdmins(next);
    navigate('/admin/management/admins');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Admin Management</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">Create Admin</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Create Admin</h1>
          <button
            type="button"
            onClick={() => navigate('/admin/management/admins')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Admin Details</h3>
                <p className="text-xs text-gray-400">Create a new admin account</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  <Shield size={12} className="inline mr-1 text-gray-400" />
                  Select Role *
                </label>
                <select value={form.role} onChange={(e) => setField('role', e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  <MapPin size={12} className="inline mr-1 text-gray-400" />
                  Select Area *
                </label>
                <select value={form.area} onChange={(e) => setField('area', e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Name *</label>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass} placeholder="Enter Name" />
              </div>
              <div>
                <label className={labelClass}>Address *</label>
                <input
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className={inputClass}
                  placeholder="Enter Address"
                />
              </div>
              <div>
                <label className={labelClass}>Mobile Number *</label>
                <input
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  className={inputClass}
                  placeholder="Enter Mobile Number"
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass} placeholder="Enter Email" />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className={inputClass}
                  placeholder="Enter Password"
                />
              </div>
              <div>
                <label className={labelClass}>Confirm Password *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  className={inputClass}
                  placeholder="Confirm Password"
                />
              </div>
              <div>
                <label className={labelClass}>Select Country *</label>
                <select value={form.country} onChange={(e) => setField('country', e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>State *</label>
                <input value={form.state} onChange={(e) => setField('state', e.target.value)} className={inputClass} placeholder="Enter State" />
              </div>
              <div>
                <label className={labelClass}>City *</label>
                <input value={form.city} onChange={(e) => setField('city', e.target.value)} className={inputClass} placeholder="Enter City" />
              </div>
              <div>
                <label className={labelClass}>Postal Code *</label>
                <input
                  value={form.postalCode}
                  onChange={(e) => setField('postalCode', e.target.value)}
                  className={inputClass}
                  placeholder="Enter Postal Code"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <FileUp size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Profile Image</h3>
                <p className="text-xs text-gray-400">Upload admin profile image</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Upload Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setField('image', e.target.files?.[0] || null)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.active ? 'active' : 'disabled'} onChange={(e) => setField('active', e.target.value === 'active')} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Create Admin
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/management/admins')}
              className="w-full py-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminCreate;

