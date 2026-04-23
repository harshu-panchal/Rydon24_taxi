import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronRight,
  Loader2,
  X,
  MoreVertical,
  Minus,
  Layout,
  ArrowLeft,
  Search,
  CheckCircle2,
  Edit,
  Trash2,
  Users
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import toast from 'react-hot-toast';

const OnboardingScreens = () => {
  const [loading, setLoading] = useState(true);
  const [screens, setScreens] = useState([]);
  const [entries, setEntries] = useState(10);

  const fetchAllScreens = async () => {
    try {
      setLoading(true);
      const [userRes, driverRes, ownerRes] = await Promise.all([
        adminService.getOnboardingScreens('user'),
        adminService.getOnboardingScreens('driver'),
        adminService.getOnboardingScreens('owner').catch(() => ({ results: [] }))
      ]);
      
      const combined = [
        ...(userRes.results || userRes.data?.results || []),
        ...(driverRes.results || driverRes.data?.results || []),
        ...(ownerRes.results || ownerRes.data?.results || [])
      ];
      
      setScreens(combined);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load screens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllScreens();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 font-sans">
      
      {/* Header Block */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Settings</span>
          <ChevronRight size={12} />
          <span>App Configuration</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">Onboarding Flow</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Landing & Onboarding</h1>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Statistics & Quick Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {['user', 'driver', 'owner'].map(role => (
             <div key={role} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-default group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${role === 'user' ? 'bg-indigo-50 text-indigo-600' : role === 'driver' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                   <Users size={20} />
                </div>
                <div>
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{role} screens</h4>
                   <p className="text-xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {screens.filter(s => s.screen === role || s.audience === role).length}
                   </p>
                </div>
             </div>
           ))}
        </div>

        {/* Main Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
             <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter onboarding content..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
             </div>
             <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase mr-2">Show</label>
                <select 
                  value={entries} 
                  onChange={(e) => setEntries(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Audience</th>
                  <th className="px-6 py-4 text-center">Order</th>
                  <th className="px-6 py-4">Title & Description</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                     <tr key={i} className="animate-pulse">
                       <td colSpan="5" className="px-6 py-10"><div className="h-4 bg-gray-50 rounded w-full"></div></td>
                     </tr>
                   ))
                ) : screens.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center text-gray-400 text-sm italic">No onboarding screens found in the registry.</td>
                  </tr>
                ) : (
                  screens.slice(0, Number(entries)).map((s) => (
                    <tr key={s._id} className="group hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${s.screen === 'driver' ? 'bg-amber-50 text-amber-600 border-amber-100' : s.screen === 'owner' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                           {s.screen}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-black text-gray-400">0{s.order}</span>
                      </td>
                      <td className="px-6 py-5">
                         <div>
                            <p className="text-sm font-bold text-gray-900 mb-0.5">{s.title}</p>
                            <p className="text-[11px] text-gray-400 font-medium leading-relaxed max-w-md">{s.description}</p>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {s.active ? (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                              <CheckCircle2 size={10} /> Live
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 text-gray-400 text-[10px] font-bold uppercase">
                              Hidden
                           </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-indigo-100"><Edit size={16} /></button>
                          <button className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-all border border-transparent hover:border-red-100"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Area */}
          <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
              Showing {Math.min(1, screens.length)} to {Math.min(Number(entries), screens.length)} of {screens.length} Registry Items
            </div>
            <div className="flex items-center gap-1">
              <button disabled className="px-4 py-1.5 text-[11px] font-bold text-gray-400 bg-white border border-gray-200 rounded-lg disabled:opacity-50">PREVIOUS</button>
              <button className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg text-xs font-black shadow-sm">1</button>
              <button disabled className="px-4 py-1.5 text-[11px] font-bold text-gray-400 bg-white border border-gray-200 rounded-lg disabled:opacity-50">NEXT</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OnboardingScreens;
