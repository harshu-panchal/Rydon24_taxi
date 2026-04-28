import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Car,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PoolingVehicles = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    vehicleModel: '',
    vehicleNumber: '',
    capacity: 4,
    color: '',
    status: 'active'
  });

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const response = await adminService.getPoolingVehicles();
      setVehicles(response.data || []);
    } catch (error) {
      toast.error('Failed to load pooling vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await adminService.updatePoolingVehicle(editingVehicle._id, formData);
        toast.success('Vehicle updated successfully');
      } else {
        await adminService.createPoolingVehicle(formData);
        toast.success('Vehicle added successfully');
      }
      setShowModal(false);
      setEditingVehicle(null);
      setFormData({
        name: '',
        vehicleModel: '',
        vehicleNumber: '',
        capacity: 4,
        color: '',
        status: 'active'
      });
      loadVehicles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await adminService.deletePoolingVehicle(id);
      toast.success('Vehicle deleted');
      loadVehicles();
    } catch (error) {
      toast.error('Failed to delete vehicle');
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          <span>Car Pooling</span>
          <ChevronRight size={12} />
          <span className="text-indigo-600">Vehicles</span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Pooling Vehicles</h1>
            <p className="text-sm font-medium text-slate-500">Manage dedicated fleet for car pooling services</p>
          </div>
          <button
            onClick={() => navigate('/admin/pooling/vehicles/create')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Plus size={18} />
            Add New Vehicle
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Car size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cars</p>
              <p className="text-xl font-black text-slate-900">{vehicles.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</p>
              <p className="text-xl font-black text-slate-900">{vehicles.filter(v => v.status === 'active').length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Info size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Capacity Avg</p>
              <p className="text-xl font-black text-slate-900">
                {vehicles.length ? (vehicles.reduce((acc, curr) => acc + curr.capacity, 0) / vehicles.length).toFixed(1) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or plate number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle._id} className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-100/50">
              <div className="relative h-48 bg-slate-100">
                {vehicle.images && vehicle.images.length > 0 ? (
                  <img src={vehicle.images[0]} alt={vehicle.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <Car size={64} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute right-4 top-4 flex flex-col gap-2 items-end">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm border ${
                    vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {vehicle.status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {vehicle.status}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-600 border border-indigo-100 shadow-sm">
                    {vehicle.vehicleType || 'sedan'}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{vehicle.name}</h3>
                    <p className="text-sm font-bold text-slate-400">{vehicle.vehicleModel}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600 border border-slate-100">
                    {vehicle.vehicleNumber}
                  </div>
                </div>
                
                {/* Mini Blueprint Preview */}
                <div className="mb-6 rounded-2xl bg-slate-50/80 p-3 border border-slate-100">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Layout Preview</p>
                  <div 
                    className="grid gap-1.5"
                    style={{ 
                      gridTemplateColumns: `repeat(${vehicle.blueprint?.cols || 2}, minmax(0, 1fr))`
                    }}
                  >
                    {(vehicle.blueprint?.layout || []).map((s, i) => (
                      <div 
                        key={i} 
                        className={`h-4 rounded-md ${
                          s.type === 'seat' ? 'bg-indigo-400' : s.type === 'driver' ? 'bg-slate-900' : 'bg-slate-200'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-indigo-50/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Capacity</p>
                    <p className="text-sm font-black text-indigo-900">{vehicle.capacity} Seats</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</p>
                    <p className="text-sm font-black text-slate-900">{vehicle.color || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/admin/pooling/vehicles/edit/${vehicle._id}`)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Edit Vehicle
                  </button>
                  <button 
                    onClick={() => handleDelete(vehicle._id)}
                    className="rounded-xl border border-rose-100 p-2.5 text-rose-500 transition hover:bg-rose-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {filteredVehicles.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-50 p-6 text-slate-300">
                <Car size={48} strokeWidth={1} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No vehicles found</h3>
              <p className="mt-2 max-w-xs text-sm font-medium text-slate-400">Try adjusting your search or add a new vehicle to the pooling fleet.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal removed - navigating to separate page */}
    </div>
  );
};

export default PoolingVehicles;
