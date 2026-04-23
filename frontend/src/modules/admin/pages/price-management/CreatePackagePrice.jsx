import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown,
  Loader2,
  Save,
  ArrowLeft
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../../shared/api/axiosInstance';
import toast from 'react-hot-toast';

const inputClass = "w-full border border-gray-200 rounded-md px-4 py-2.5 text-[13px] text-gray-800 bg-white focus:border-indigo-500 transition-all outline-none placeholder:text-gray-300";
const labelClass = "block text-[12px] font-semibold text-gray-700 mb-1.5";

const CreatePackagePrice = ({ mode = 'create' }) => {
  const { id, packageId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packageTypes, setPackageTypes] = useState([]);
  
  const [formData, setFormData] = useState({
    package_type_id: '',
    base_price: '',
    free_distance: '',
    distance_price: '',
    free_time: '',
    time_price: '',
    admin_commision_type: '',
    admin_commision: '',
    admin_commission_type_from_driver: '',
    admin_commission_from_driver: '',
    admin_commission_type_for_owner: '',
    admin_commission_for_owner: '',
    service_tax: '',
    cancellation_fee: ''
  });

  useEffect(() => {
    fetchPackageTypes();
    if (mode === 'edit' && packageId) {
      fetchPackageDetail();
    }
  }, [packageId, mode]);

  const fetchPackageTypes = async () => {
    try {
      const res = await api.get('/admin/types/rental-package-types');
      setPackageTypes(res.data?.results || []);
    } catch (err) {
      console.error('Fetch package types fail', err);
    }
  };

  const fetchPackageDetail = async () => {
    setLoading(true);
    try {
       // Mock or real API fetch
       // const res = await api.get(`/admin/types/package-prices/${packageId}`);
       // setFormData(res.data);
    } catch (err) {
      toast.error('Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // API call to save
      toast.success('Package price saved successfully!');
      navigate(-1);
    } catch (err) {
      toast.error('Failed to save package price');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-6 lg:p-8 font-sans">
      
      {/* Header Block */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-8">
        <h1 className="text-sm font-bold text-[#1E293B] uppercase tracking-[0.15em]">{mode === 'edit' ? 'EDIT' : 'CREATE'}</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium tracking-tight">
           <span className="hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/admin/pricing/set-price')}>Set Prices</span>
           <ChevronRight size={10} className="text-slate-300" />
           <span className="text-slate-800 font-bold">{mode === 'edit' ? 'Edit' : 'Create'}</span>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 lg:p-10 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
             <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        )}

        <div className="flex justify-end mb-6">
           <button className="text-[11px] font-bold text-[#00BFA5] underline decoration-dotted underline-offset-4">How It Works</button>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              
              <div>
                 <label className={labelClass}>Package Type <span className="text-rose-500">*</span></label>
                 <div className="relative">
                    <select 
                      required 
                      className={inputClass + " appearance-none"} 
                      value={formData.package_type_id} 
                      onChange={e => handleChange('package_type_id', e.target.value)}
                    >
                       <option value="">Select Package Type</option>
                       {packageTypes.map(t => (
                         <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                       ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>

              <div>
                 <label className={labelClass}>Base Price Inclusive of tax <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="Enter Base Price Inclusive of tax"
                   value={formData.base_price}
                   onChange={e => handleChange('base_price', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Free Distance * (Kilometers)</label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="Enter Free Distance"
                   value={formData.free_distance}
                   onChange={e => handleChange('free_distance', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Distance Price <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="Enter Price Per Distance"
                   value={formData.distance_price}
                   onChange={e => handleChange('distance_price', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Free Time in Minute</label>
                 <input 
                   type="number" 
                   className={inputClass} 
                   placeholder="Enter Free minute"
                   value={formData.free_time}
                   onChange={e => handleChange('free_time', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Time Price in Mintue <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="Enter Time Price"
                   value={formData.time_price}
                   onChange={e => handleChange('time_price', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Admin Commission Type From Customer <span className="text-rose-500">*</span></label>
                 <div className="relative">
                    <select 
                      required 
                      className={inputClass + " appearance-none"}
                      value={formData.admin_commision_type}
                      onChange={e => handleChange('admin_commision_type', e.target.value)}
                    >
                       <option value="">Select Admin Commission Type From Customer</option>
                       <option value="1">Percentage</option>
                       <option value="2">Fixed</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>

              <div>
                 <label className={labelClass}>Admin Commission From Customer <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="0"
                   value={formData.admin_commision}
                   onChange={e => handleChange('admin_commision', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Admin Commission Type From Driver <span className="text-rose-500">*</span></label>
                 <div className="relative">
                    <select 
                      required 
                      className={inputClass + " appearance-none"}
                      value={formData.admin_commission_type_from_driver}
                      onChange={e => handleChange('admin_commission_type_from_driver', e.target.value)}
                    >
                       <option value="">Select Admin Commission Type From Driver</option>
                       <option value="1">Percentage</option>
                       <option value="2">Fixed</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>

              <div>
                 <label className={labelClass}>Admin Commission From Driver <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="0"
                   value={formData.admin_commission_from_driver}
                   onChange={e => handleChange('admin_commission_from_driver', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Admin Commission Type From Owner <span className="text-rose-500">*</span></label>
                 <div className="relative">
                    <select 
                      required 
                      className={inputClass + " appearance-none"}
                      value={formData.admin_commission_type_for_owner}
                      onChange={e => handleChange('admin_commission_type_for_owner', e.target.value)}
                    >
                       <option value="">Select Admin Commission Type From Owner</option>
                       <option value="1">Percentage</option>
                       <option value="2">Fixed</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>

              <div>
                 <label className={labelClass}>Admin Commission From Owner <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="0"
                   value={formData.admin_commission_for_owner}
                   onChange={e => handleChange('admin_commission_for_owner', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Service Tax (%) <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="0"
                   value={formData.service_tax}
                   onChange={e => handleChange('service_tax', e.target.value)}
                 />
              </div>

              <div>
                 <label className={labelClass}>Cancellation Fee <span className="text-rose-500">*</span></label>
                 <input 
                   type="number" 
                   required 
                   className={inputClass} 
                   placeholder="Cancellation Fee"
                   value={formData.cancellation_fee}
                   onChange={e => handleChange('cancellation_fee', e.target.value)}
                 />
              </div>

           </div>

           <div className="flex justify-end pt-6">
              <button 
                type="submit" 
                disabled={saving}
                className="bg-[#00BFA5] text-white px-10 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
              </button>
           </div>
        </form>

        {/* Floating Toggle Design Element */}
        <div className="absolute right-8 top-[380px] z-50">
          <button type="button" className="w-14 h-14 bg-[#00BFA5] text-white rounded-full flex items-center justify-center shadow-2xl hover:rotate-[360deg] transition-all duration-700">
             <div className="flex flex-col gap-1.5 items-center">
                <div className="w-6 h-[2.5px] bg-white rounded-full"></div>
                <div className="w-6 h-[2px] bg-white/70 rounded-full"></div>
                <div className="w-6 h-[1.5px] bg-white/40 rounded-full"></div>
             </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePackagePrice;
