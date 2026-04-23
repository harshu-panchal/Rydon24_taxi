import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Navigation,
  Loader2,
  ChevronRight,
  Target,
  Zap,
  Tag,
  Save,
  ArrowLeft,
  Maximize2,
  Map as MapIcon,
  Globe,
  Info,
  Layers,
  MousePointer2
} from "lucide-react";
import {
  GoogleMap,
  DrawingManager,
  Polygon,
  Autocomplete,
} from "@react-google-maps/api";
import { useAppGoogleMapsLoader } from "../../utils/googleMaps";
import { adminService } from "../../services/adminService";
import {
  buildCountryBoundaryUrl,
  normalizeBoundaryRings,
  isDriverAvailable,
} from "../../utils/mapUtils";

const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";
const cardClass = "bg-white rounded-xl border border-gray-200 p-6 shadow-sm";

const ZoneManagement = ({ mode: initialMode = "list" }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [view, setView] = useState(initialMode);
  const [zones, setZones] = useState([]);
  const [serviceLocations, setServiceLocations] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [saving, setSaving] = useState(false);
  const [enablePeakZoneGlobal, setEnablePeakZoneGlobal] = useState(true);
  const [editingId, setEditingId] = useState(id || null);
  const [mapCenter, setMapCenter] = useState({ lat: 21.1458, lng: 79.0882 }); 
  const [autocomplete, setAutocomplete] = useState(null);
  const [countryBoundaryPaths, setCountryBoundaryPaths] = useState([]);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const mapRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('English');

  // Map & Drawing States
  const [polygonCoords, setPolygonCoords] = useState([]);
  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  // Form State
  const [formData, setFormData] = useState({
    service_location_id: '',
    name: { English: '', Arabic: '', French: '', Spanish: '' },
    unit: '',
    peak_zone_ride_count: '',
    peak_zone_radius: '',
    peak_zone_selection_duration: '',
    peak_zone_duration: '',
    peak_zone_surge_percentage: '',
    maximum_distance_for_regular_rides: '',
    maximum_distance_for_outstation_rides: '',
    status: 'active'
  });

  useEffect(() => {
    setView(initialMode);
    if (initialMode === 'list') {
      resetForm();
    }
  }, [initialMode]);

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [zoneRes, slRes, driverRes] = await Promise.all([
        adminService.getZones(),
        adminService.getServiceLocations(),
        adminService.getDrivers(1, 200),
      ]);

      if (zoneRes) {
        const zoneData = zoneRes.success ? (zoneRes.data?.results || zoneRes.data) : zoneRes;
        setZones(Array.isArray(zoneData) ? zoneData : []);
      }

      if (slRes) {
        const locs = slRes.success ? (slRes.data?.results || slRes.data) : slRes;
        setServiceLocations(Array.isArray(locs) ? locs : []);
      }

      if (driverRes) {
        const driverItems = driverRes.success ? (driverRes.data?.results || driverRes.data) : driverRes;
        setDrivers(Array.isArray(driverItems) ? driverItems : []);
      }

      if (id && initialMode === 'edit') {
        const zoneToEdit = Array.isArray(zones) && zones.find(z => (z._id || z.id) === id);
        if (zoneToEdit) handleEdit(zoneToEdit);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setFetchError(`Zone data could not be loaded.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (id && zones.length > 0 && initialMode === 'edit') {
      const zoneToEdit = zones.find(z => (z._id || z.id) === id);
      if (zoneToEdit) handleEdit(zoneToEdit);
    }
  }, [id, zones]);

  const filteredZones = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return zones;
    return zones.filter(z => (z.name || z.zone_name || '').toLowerCase().includes(query));
  }, [zones, searchTerm]);

  const fitMapToPaths = (paths) => {
    if (!mapRef.current || !window.google || !Array.isArray(paths) || paths.length === 0) {
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoint = false;
    paths.forEach((ring) => {
      ring.forEach((point) => {
        if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) {
          bounds.extend(point);
          hasPoint = true;
        }
      });
    });
    if (hasPoint) {
      mapRef.current.fitBounds(bounds, 40);
    }
  };

  const onPolygonComplete = (polygon) => {
    const coords = polygon.getPath().getArray().map(p => ({
      lat: p.lat(),
      lng: p.lng()
    }));
    setPolygonCoords(coords);
    polygon.setMap(null);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const loc = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setMapCenter(loc);
        mapRef.current?.panTo(loc);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name.English.trim() || polygonCoords.length === 0) {
      alert("Please add a zone name and draw a polygon on the map.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        coordinates: polygonCoords,
        name: formData.name.English
      };
      const res = editingId 
        ? await adminService.updateZone(editingId, payload)
        : await adminService.createZone(payload);
      if (res.success) {
        resetForm();
        navigate("/admin/pricing/zone");
        fetchData();
      } else {
        alert(res.message || "Operation failed");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error connecting to server.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      service_location_id: '',
      name: { English: '', Arabic: '', French: '', Spanish: '' },
      unit: '',
      peak_zone_ride_count: '',
      peak_zone_radius: '',
      peak_zone_selection_duration: '',
      peak_zone_duration: '',
      peak_zone_surge_percentage: '',
      maximum_distance_for_regular_rides: '',
      maximum_distance_for_outstation_rides: '',
      status: 'active'
    });
    setPolygonCoords([]);
    setCountryBoundaryPaths([]);
  };

  const handleStatusToggle = async (zoneId, currentIsActive) => {
    try {
      const res = await adminService.toggleZoneStatus(zoneId);
      if (res.success) {
        setZones(prev => prev.map(z => (z._id === zoneId || z.id === zoneId) ? { ...z, active: !currentIsActive } : z));
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleDelete = async (zoneId) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      const res = await adminService.deleteZone(zoneId);
      if (res.success) {
        setZones(prev => prev.filter(z => (z._id !== zoneId && z.id !== zoneId)));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleEdit = (zone) => {
    const zid = zone._id || zone.id;
    setEditingId(zid);
    let zoneName = typeof zone.name === 'string' ? zone.name : (zone.name?.English || zone.zone_name || '');
    setFormData({
      service_location_id: zone.service_location_id || '',
      name: { English: zoneName, Arabic: '', French: '', Spanish: '' },
      unit: zone.unit || '',
      peak_zone_ride_count: zone.peak_zone_ride_count || '',
      peak_zone_radius: zone.peak_zone_radius || '',
      peak_zone_selection_duration: zone.peak_zone_selection_duration || '',
      peak_zone_duration: zone.peak_zone_duration || '',
      peak_zone_surge_percentage: zone.peak_zone_surge_percentage || '',
      maximum_distance_for_regular_rides: zone.maximum_distance_for_regular_rides || '',
      maximum_distance_for_outstation_rides: zone.maximum_distance_for_outstation_rides || '',
      status: zone.active ? 'active' : 'inactive'
    });
    let parsedCoords = [];
    if (Array.isArray(zone.coordinates)) {
      parsedCoords = zone.coordinates.map(coord => {
        if (Array.isArray(coord)) return { lat: coord[1], lng: coord[0] };
        if (coord && typeof coord === 'object') return { lat: Number(coord.lat), lng: Number(coord.lng) };
        return coord;
      });
    }
    if (parsedCoords.length > 0) setMapCenter(parsedCoords[0]);
    setPolygonCoords(parsedCoords);
  };

  const selectedServiceLocation = serviceLocations.find(l => String(l._id || l.id) === String(formData.service_location_id));
  const selectedCountry = selectedServiceLocation?.country || selectedServiceLocation?.name || '';

  useEffect(() => {
    if (view === 'list' || !selectedCountry) return;
    let cancelled = false;
    const loadCountryBoundary = async () => {
      setBoundaryLoading(true);
      try {
        const response = await fetch(buildCountryBoundaryUrl(selectedCountry));
        if (!response.ok) throw new Error();
        const payload = await response.json();
        const feature = Array.isArray(payload) ? payload[0] : null;
        const nextPaths = normalizeBoundaryRings(feature?.geojson);
        if (!cancelled) {
          setCountryBoundaryPaths(nextPaths);
          if (nextPaths.length > 0) fitMapToPaths(nextPaths);
        }
      } catch (error) {
        if (!cancelled) setCountryBoundaryPaths([]);
      } finally {
        if (!cancelled) setBoundaryLoading(false);
      }
    };
    loadCountryBoundary();
    return () => { cancelled = true; };
  }, [selectedCountry, view]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 animate-in fade-in duration-500">
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div 
            key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="max-w-7xl mx-auto space-y-6"
          >
            <div className="mb-6">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                <span>Pricing</span>
                <ChevronRight size={12} />
                <span className="text-gray-700">Zone Management</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Zone Management</h1>
                  <p className="text-xs text-gray-400 mt-1">Configure geofenced boundaries for operational control.</p>
                </div>
                <button 
                  onClick={() => navigate("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus size={16} /> Add Market Zone
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enablePeakZoneGlobal ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-300'}`}>
                     <Zap size={20} className={enablePeakZoneGlobal ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                     <h3 className="text-sm font-semibold text-gray-900">Dynamic Peak Pricing</h3>
                     <p className="text-[11px] text-gray-400">Toggle surge modifiers across all zones globally</p>
                  </div>
               </div>
               <button 
                 onClick={() => setEnablePeakZoneGlobal(!enablePeakZoneGlobal)}
                 className={`relative w-11 h-6 rounded-full transition-colors ${enablePeakZoneGlobal ? 'bg-indigo-600' : 'bg-gray-200'}`}
               >
                 <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enablePeakZoneGlobal ? 'translate-x-5' : ''}`} />
               </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="relative w-full max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search zones..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                    <p className="text-xs text-gray-400 font-medium">Loading data...</p>
                  </div>
                ) : filteredZones.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">S.No</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Market Zone Identity</th>
                        <th className="px-6 py-3.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-3.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredZones.map((zone, idx) => (
                        <tr key={zone._id || zone.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-400">{(idx + 1).toString().padStart(2, '0')}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50 transition-transform group-hover:scale-105">
                                <Target size={16} />
                              </div>
                              <span className="font-semibold text-gray-900">{zone.name || zone.zone_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button 
                               onClick={() => handleStatusToggle(zone._id || zone.id, zone.active)} 
                               className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${zone.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}
                            >
                               {zone.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                               <button onClick={() => navigate(`edit/${zone._id || zone.id}`)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                               <button onClick={() => handleDelete(zone._id || zone.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                               <button onClick={() => handleEdit(zone)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Globe size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mx-auto mb-4"><Navigation size={32} /></div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">No Zones Configured</h3>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">Map your operational sector boundaries to initiate geofencing.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-7xl mx-auto space-y-6 pb-20"
          >
            <div className="mb-6">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                <span>Pricing</span>
                <ChevronRight size={12} />
                <span>Zone Management</span>
                <ChevronRight size={12} />
                <span className="text-gray-700">{editingId ? 'Edit' : 'Create'}</span>
              </div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-gray-900">{editingId ? 'Edit Market Zone' : 'Add Market Zone'}</h1>
                <button 
                  onClick={() => navigate("/admin/pricing/zone")}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Form Section */}
              <div className="xl:col-span-4 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                   <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Tag size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Zone Identity</h3>
                        <p className="text-xs text-gray-400">Basic identification settings</p>
                      </div>
                   </div>
                   
                   <div className="space-y-5">
                      <div>
                        <label className={labelClass}>Service Location</label>
                        <select 
                          value={formData.service_location_id}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setFormData({...formData, service_location_id: nextId});
                            const loc = serviceLocations.find(l => String(l._id || l.id) === String(nextId));
                            if (loc?.latitude) {
                              const center = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
                              setMapCenter(center);
                              mapRef.current?.panTo(center);
                            }
                          }}
                          className={inputClass}
                        >
                          <option value="">Select Service Location</option>
                          {serviceLocations.map(sl => (
                            <option key={sl._id || sl.id} value={sl._id || sl.id}>{sl.name || sl.service_location_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 border-b border-gray-100 mb-4">
                          {['English', 'Arabic', 'French', 'Spanish'].map(lang => (
                            <button
                              key={lang}
                              onClick={() => setActiveTab(lang)}
                              className={`px-4 py-2 text-xs font-medium transition-colors relative ${activeTab === lang ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                              {lang}
                              {activeTab === lang && (
                                <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-indigo-600" />
                              )}
                            </button>
                          ))}
                        </div>
                        
                        <div>
                          <label className={labelClass}>Zone Name *</label>
                          <input 
                            type="text" 
                            value={formData.name[activeTab] || ''}
                            onChange={(e) => setFormData({...formData, name: { ...formData.name, [activeTab]: e.target.value }})}
                            placeholder={`Name in ${activeTab}`}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Select Unit</label>
                        <select 
                           value={formData.unit} 
                           onChange={(e) => setFormData({...formData, unit: e.target.value})} 
                           className={inputClass}
                        >
                           <option value="">Choose Unit</option>
                           <option value="km">KM</option>
                           <option value="miles">Miles</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className={labelClass}>Peak Zone Ride Count *</label>
                            <input 
                              type="number" value={formData.peak_zone_ride_count}
                              onChange={(e) => setFormData({...formData, peak_zone_ride_count: e.target.value})}
                              placeholder="Ride Count"
                              className={inputClass}
                            />
                         </div>
                         <div>
                            <label className={labelClass}>Peak Zone Radius *</label>
                            <input 
                              type="number" value={formData.peak_zone_radius}
                              onChange={(e) => setFormData({...formData, peak_zone_radius: e.target.value})}
                              placeholder="Radius"
                              className={inputClass}
                            />
                         </div>
                         <div>
                            <label className={labelClass}>Peak Selection Duration (mins) *</label>
                            <input 
                              type="number" value={formData.peak_zone_selection_duration}
                              onChange={(e) => setFormData({...formData, peak_zone_selection_duration: e.target.value})}
                              placeholder="Duration in mins"
                              className={inputClass}
                            />
                         </div>
                         <div>
                            <label className={labelClass}>Peak Zone Duration (mins) *</label>
                            <input 
                              type="number" value={formData.peak_zone_duration}
                              onChange={(e) => setFormData({...formData, peak_zone_duration: e.target.value})}
                              placeholder="Duration in mins"
                              className={inputClass}
                            />
                         </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                           <label className={labelClass + " mb-0"}>Peak Zone Surge percentage *</label>
                           <button className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 tracking-wider uppercase">How It Works</button>
                        </div>
                        <input 
                           type="number" value={formData.peak_zone_surge_percentage}
                           onChange={(e) => setFormData({...formData, peak_zone_surge_percentage: e.target.value})}
                           placeholder="Enter Surge percentage"
                           className={inputClass}
                        />
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3 shadow-sm">
                   <button 
                     disabled={saving} onClick={handleSave}
                     className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                     {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                     {editingId ? 'Update Zone' : 'Save'}
                   </button>
                   <button 
                     onClick={() => navigate("/admin/pricing/zone")}
                     className="w-full py-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                   >
                     Cancel
                   </button>
                </div>
              </div>

              {/* Map Section */}
              <div className="xl:col-span-8 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm relative overflow-hidden h-[650px]">
                   {isLoaded ? (
                     <div className="w-full h-full rounded-lg overflow-hidden relative">
                       <div className="absolute left-6 top-6 z-10 w-full max-w-md pr-12">
                            <div className="flex h-12 w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white/95 px-4 shadow-2xl backdrop-blur-sm">
                               <Search className="text-gray-400" size={18} />
                               <Autocomplete 
                                  onLoad={a => setAutocomplete(a)} 
                                  onPlaceChanged={onPlaceChanged}
                                  className="flex-1"
                                >
                                  <input 
                                    type="text" placeholder="Search for a city" 
                                    className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400"
                                  />
                               </Autocomplete>
                            </div>
                       </div>

                       {/* Clear Map button - Stacked Vertically on the Right */}
                       <div className="absolute right-3 top-[100px] z-50 flex flex-col gap-2">
                             <button 
                               onClick={() => setPolygonCoords([])}
                               className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[11px] font-black uppercase tracking-widest text-rose-600 shadow-2xl transition-all border border-gray-100 hover:bg-rose-50 active:scale-95"
                             >
                                Clear Map
                             </button>
                       </div>
                       
                       <GoogleMap
                         mapContainerStyle={{ width: '100%', height: '100%' }}
                         center={mapCenter} zoom={12}
                         onLoad={m => { mapRef.current = m; }}
                         options={{
                            styles: [
                                { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
                                { elementType: "labels.icon", stylers: [{ visibility: "off" }] }
                            ],
                            disableDefaultUI: false,
                            zoomControl: true,
                            mapTypeControl: true,
                            streetViewControl: false,
                            fullscreenControl: true
                         }}
                       >
                         <DrawingManager
                           onPolygonComplete={onPolygonComplete}
                           options={{
                             drawingControl: true,
                             drawingControlOptions: {
                               position: window.google.maps.ControlPosition.RIGHT_TOP,
                               drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
                             },
                             polygonOptions: {
                               fillColor: '#4f46e5',
                               fillOpacity: 0.15,
                               strokeColor: '#4f46e5',
                               strokeWeight: 2,
                               editable: true,
                             },
                           }}
                         />
                         {polygonCoords.length > 0 && (
                           <Polygon
                             paths={polygonCoords}
                             options={{ fillColor: '#4f46e5', strokeColor: '#4f46e5', strokeWeight: 2, fillOpacity: 0.25, editable: true, draggable: true }}
                           />
                         )}
                         {countryBoundaryPaths.map((path, index) => (
                            <Polygon
                              key={index} paths={path}
                              options={{ strokeColor: '#f43f5e', fillOpacity: 0.05, fillColor: '#f43f5e', strokeWeight: 1.5, strokeDasharray: '5,5', clickable: false }}
                            />
                         ))}
                       </GoogleMap>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                        <Loader2 className="animate-spin text-gray-300" size={32} />
                     </div>
                   )}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-800 flex items-start gap-3 shadow-sm">
                   <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
                   <p className="text-sm font-medium">
                     Avoid drawing multiple zones that overlap with each other.
                   </p>
                </div>

                <div className="bg-indigo-900 rounded-xl p-6 text-white overflow-hidden relative shadow-md">
                    <Maximize2 className="absolute -right-4 -bottom-4 text-white/10" size={120} />
                    <h4 className="text-sm font-semibold mb-2">Instructions</h4>
                    <p className="text-xs text-indigo-100 leading-relaxed">
                      Use the polygon tool at the top center of the map to draw your zone. Click to place vertices and return to the first point to close the shape. 
                      The red dashed line represents the country boundary for reference.
                    </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ZoneManagement;
