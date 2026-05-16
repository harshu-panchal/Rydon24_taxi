import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Crown,
  FileSearch,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const Admins = () => {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const response = await adminService.getAdmins();
      setAdmins(Array.isArray(response?.data?.results) ? response.data.results : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to load admins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return admins;

    return admins.filter((item) =>
      [
        item.name,
        item.email,
        item.phone,
        item.role,
        item.admin_type,
        ...(item.service_locations || []).map((loc) => loc.name),
        ...(item.zones || []).map((zone) => zone.name),
      ].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [admins, searchTerm]);

  const stats = useMemo(() => {
    const superadmins = admins.filter((item) => item.admin_type === 'superadmin').length;
    const subadmins = admins.filter((item) => item.admin_type === 'subadmin').length;
    const activeAdmins = admins.filter((item) => item.active !== false).length;
    return { superadmins, subadmins, activeAdmins, total: admins.length };
  }, [admins]);

  const handleDelete = async (admin) => {
    if (!window.confirm(`Permanently delete ${admin.name || 'this admin'}?`)) return;

    setDeletingId(String(admin.id || admin._id));
    try {
      await adminService.deleteAdminAccount(admin.id || admin._id);
      toast.success('Admin deleted successfully');
      loadAdmins();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 font-['Inter']">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Simplified Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Accounts</h1>
            <p className="text-sm text-slate-500 mt-1">Manage platform administrators and their access levels.</p>
          </div>
          <button
            onClick={() => navigate('/admin/management/admins/create')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-all shadow-sm"
          >
            <Plus size={18} />
            <span>Add Administrator</span>
          </button>
        </div>

        {/* Minimal Stats Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Admins', value: stats.total, icon: Users, color: 'text-slate-600' },
            { label: 'Superadmins', value: stats.superadmins, icon: Crown, color: 'text-amber-600' },
            { label: 'Subadmins', value: stats.subadmins, icon: Shield, color: 'text-blue-600' },
            { label: 'Active Now', value: stats.activeAdmins, icon: UserCheck, color: 'text-emerald-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl bg-slate-50 ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Refined Data Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/30">
            <div className="relative w-full max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search admins..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all"
              />
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {filteredAdmins.length} Results
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-32 flex flex-col items-center justify-center gap-4">
                <Loader2 size={32} className="animate-spin text-slate-300" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Synchronizing...</span>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="py-32 flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4">
                  <FileSearch size={32} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No admins found</h3>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search filters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/50">
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Account Type</th>
                    <th className="px-6 py-4">Access Scope</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredAdmins.map((admin) => {
                    const isSuper = admin.admin_type === 'superadmin';
                    const isActive = admin.active !== false;
                    const id = admin.id || admin._id;
                    
                    return (
                      <tr key={id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isSuper ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                              {admin.name?.[0]?.toUpperCase() || <Shield size={16} />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{admin.name}</p>
                              <p className="text-xs text-slate-500">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isSuper ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                            {isSuper ? 'Superadmin' : admin.role || 'Subadmin'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-[300px]">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-700">
                              {isSuper ? 'Unlimited Access' : `${(admin.permissions || []).length} Permission Modules`}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {isSuper ? 'Full administrative control' : (admin.permissions || []).join(', ') || 'No specific modules'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className={`text-xs font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/management/admins/edit/${id}`)}
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                              title="Edit Admin"
                            >
                              <Pencil size={16} />
                            </button>
                            {!isSuper && (
                              <button
                                disabled={deletingId === String(id)}
                                onClick={() => handleDelete(admin)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Admin"
                              >
                                {deletingId === String(id) ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admins;
