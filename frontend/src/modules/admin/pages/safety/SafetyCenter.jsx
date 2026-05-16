import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  PhoneCall,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { socketService } from '../../../../shared/api/socket';
import { adminService } from '../../services/adminService';
import { HAS_VALID_GOOGLE_MAPS_KEY, INDIA_CENTER, useAppGoogleMapsLoader } from '../../utils/googleMaps';

const mapContainerStyle = { width: '100%', height: '100%' };

const formatRelativeTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';

  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getParticipantTitle = (alert) =>
  alert?.sourceApp === 'driver'
    ? alert?.driverName || 'Driver'
    : alert?.riderName || 'Rider';

const getDriverLabel = (alert) => alert?.driverName || 'Unassigned driver';
const getRiderLabel = (alert) => alert?.riderName || 'User';

const getMapCenter = (alert) =>
  Number.isFinite(Number(alert?.location?.lat)) && Number.isFinite(Number(alert?.location?.lng))
    ? { lat: Number(alert.location.lat), lng: Number(alert.location.lng) }
    : INDIA_CENTER;

const SOSCard = ({ alert, isActive, onClick }) => (
  <div
    onClick={onClick}
    className={`p-5 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${
      isActive 
        ? 'bg-rose-50 border-rose-500 shadow-xl shadow-rose-200/50' 
        : 'bg-white border-slate-50 hover:border-rose-200'
    }`}
  >
    <div className="flex justify-between items-start mb-3 gap-3">
      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.15em] ${isActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-rose-100 text-rose-600'}`}>
        Emergency
      </span>
      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
        <Clock size={12} strokeWidth={2.5} /> {formatRelativeTime(alert?.createdAt)}
      </div>
    </div>

    <h4 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight mb-1">
      {getParticipantTitle(alert)}
    </h4>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
      {alert?.tripCode || alert?.rideId || 'GEN-SOS-INT'}
    </p>

    <div className="space-y-1.5 border-t border-slate-100 pt-4">
      <p className="text-[12px] font-black text-slate-700 leading-none">{getDriverLabel(alert)}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
        {alert?.vehicleLabel || alert?.serviceType || 'Unknown Fleet Unit'}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
         <MapPin size={12} className="text-rose-500" />
         <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tighter">
            {alert?.locationLabel || alert?.pickupAddress || 'Locating...'}
         </p>
      </div>
    </div>
  </div>
);

const SafetyCenter = () => {
  const { isLoaded, loadError } = useAppGoogleMapsLoader();
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState('');
  const [checklist, setChecklist] = useState({
    pcall: false,
    dcall: false,
    police: false,
    nearby: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [logDraft, setLogDraft] = useState('');

  const selectedAlert = useMemo(
    () => alerts.find((entry) => entry.id === selectedAlertId) || alerts[0] || null,
    [alerts, selectedAlertId],
  );

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getSafetyAlerts({ status: 'active', limit: 50 });
      const results = response?.data?.data?.results || response?.data?.results || [];
      setAlerts(results);
      setSelectedAlertId((current) => current || results[0]?.id || '');
    } catch (error) {
      console.error('Failed to load safety alerts:', error);
      toast.error(error?.message || 'Terminal: SOS Sync Failed');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    const handleNewAlert = (payload = {}) => {
      setAlerts((current) => [payload, ...current.filter((item) => item.id !== payload.id)]);
      setSelectedAlertId((current) => current || payload.id || '');
      toast.error(`SOS TRIGGERED: ${getParticipantTitle(payload)}`, { 
        duration: 5000,
        style: { background: '#991B1B', color: '#fff', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' } 
      });
    };

    const handleUpdatedAlert = (payload = {}) => {
      setAlerts((current) =>
        current
          .map((item) => (item.id === payload.id ? payload : item))
          .filter((item) => String(item.status || '').toLowerCase() !== 'resolved'),
      );
      setSelectedAlertId((current) => (current === payload.id ? '' : current));
    };

    socketService.on('new_sos', handleNewAlert);
    socketService.on('safety:alert:new', handleNewAlert);
    socketService.on('safety:alert:updated', handleUpdatedAlert);

    return () => {
      socketService.off('new_sos', handleNewAlert);
      socketService.off('safety:alert:new', handleNewAlert);
      socketService.off('safety:alert:updated', handleUpdatedAlert);
    };
  }, []);

  useEffect(() => {
    if (!selectedAlertId && alerts.length > 0) {
      setSelectedAlertId(alerts[0].id);
    }
  }, [alerts, selectedAlertId]);

  const handleResolve = async () => {
    if (!selectedAlert?.id) return;

    setIsResolving(true);
    try {
      await adminService.resolveSafetyAlert(selectedAlert.id, logDraft.trim());
      setAlerts((current) => current.filter((item) => item.id !== selectedAlert.id));
      setSelectedAlertId('');
      setLogDraft('');
      toast.success('INCIDENT RESOLVED & ARCHIVED');
    } catch (error) {
      console.error('Failed to resolve safety alert:', error);
      toast.error(error?.message || 'Resolution failed');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-96 shrink-0 flex flex-col space-y-6 overflow-y-auto no-scrollbar pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-200">
                <ShieldAlert size={24} strokeWidth={2.5} className="animate-pulse" />
             </div>
             <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">SOS Terminal</h1>
                <p className="text-rose-600 font-black text-[10px] mt-1 uppercase tracking-[0.2em] leading-none">
                  Critical Response Interface
                </p>
             </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Radio size={14} className="text-rose-600 animate-ping" /> Active Incidents ({alerts.length})
            </span>
            <button 
              onClick={loadAlerts} 
              className="text-[10px] font-black text-slate-900 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-[2rem] border-2 border-slate-50 bg-white p-8 text-center">
               <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mx-auto mb-4" />
               <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Syncing Encrypted Feed...</p>
            </div>
          ) : null}

          {!isLoading && alerts.length === 0 ? (
            <div className="rounded-[2.5rem] border-2 border-slate-50 bg-white p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                 <CheckCircle2 size={32} />
              </div>
              <p className="text-[14px] font-black text-slate-900 tracking-tight">System Status: All Clear</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest">No active distress signals</p>
            </div>
          ) : null}

          <div className="space-y-4">
            {alerts.map((alert) => (
              <SOSCard
                key={alert.id}
                alert={alert}
                isActive={selectedAlert?.id === alert.id}
                onClick={() => setSelectedAlertId(alert.id)}
              />
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl shadow-slate-900/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center">
               <LifeBuoy size={18} className="text-rose-500" />
            </div>
            <h5 className="text-[12px] font-black uppercase tracking-[0.2em]">Response Protocol</h5>
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
            Target response time: <span className="text-white font-black underline decoration-rose-500 decoration-2">{"<"} 30s</span>. 
            Initiate communication immediately. If unresponsive for 120s, escalate to authorities.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pr-2 pb-10">
        {selectedAlert ? (
          <>
            <div className="bg-white border-2 border-rose-100 rounded-[3rem] p-8 flex items-center justify-between gap-8 shadow-2xl shadow-rose-200/20">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 bg-rose-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-rose-600/30 relative border-4 border-rose-50">
                  <ShieldAlert size={36} strokeWidth={2.5} className="animate-bounce" />
                  <div className="absolute -top-2 -right-2 px-2.5 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black tracking-[0.2em]">
                    PRIO-1
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-3">
                    {getParticipantTitle(selectedAlert)} triggered SOS
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                      <MapPin size={16} className="text-rose-600" />
                      <p className="text-[13px] font-black text-slate-900 uppercase tracking-tighter">
                        {selectedAlert.locationLabel || selectedAlert.pickupAddress || 'Locating distress source...'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 rounded-2xl border border-rose-100">
                       <Clock size={14} className="text-rose-600" />
                       <p className="text-[11px] font-black text-rose-700 uppercase">{formatRelativeTime(selectedAlert.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.open('tel:100', '_self')}
                  className="bg-rose-600 text-white px-8 py-4 rounded-[1.5rem] text-[15px] font-black hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 flex items-center justify-center gap-3 active:scale-95"
                >
                  <PhoneCall size={20} strokeWidth={3} /> EMERGENCY (100)
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] text-[13px] font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-60 active:scale-95 uppercase tracking-widest"
                >
                  <CheckCircle2 size={18} /> {isResolving ? 'Archiving...' : 'Close Incident'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="bg-white rounded-[3rem] border-2 border-slate-50 p-10 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h4 className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase">Distress Analytics</h4>
                    <MoreHorizontal size={20} className="text-slate-200" />
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-10">
                    <div className="rounded-[2rem] bg-slate-50 p-6 border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Subject Source</p>
                      <p className="text-[18px] font-black text-slate-900 tracking-tight leading-none mb-1">{getParticipantTitle(selectedAlert)}</p>
                      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-tighter">
                        {selectedAlert.sourceApp === 'driver' ? selectedAlert.driverPhone || '--' : selectedAlert.riderPhone || '--'}
                      </p>
                    </div>
                    <div className="rounded-[2rem] bg-slate-50 p-6 border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Linked Counterpart</p>
                      <p className="text-[18px] font-black text-slate-900 tracking-tight leading-none mb-1">
                        {selectedAlert.sourceApp === 'driver' ? getRiderLabel(selectedAlert) : getDriverLabel(selectedAlert)}
                      </p>
                      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-tighter">
                        {selectedAlert.sourceApp === 'driver' ? selectedAlert.riderPhone || '--' : selectedAlert.driverPhone || '--'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[2.5rem] p-8 space-y-4">
                    <div className="flex justify-between items-center text-[13px] font-black uppercase tracking-widest border-b border-white/5 pb-4">
                      <span className="text-slate-500">Service Class</span>
                      <span className="text-white bg-white/10 px-3 py-1 rounded-full">{selectedAlert.serviceType || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] font-black uppercase tracking-widest border-b border-white/5 pb-4">
                      <span className="text-slate-500">Incident Reference</span>
                      <span className="text-white">{selectedAlert.tripCode || selectedAlert.id.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] font-black uppercase tracking-widest">
                      <span className="text-slate-500">Fleet Identifier</span>
                      <span className="text-white">{selectedAlert.vehicleLabel || 'UN-IDENTIFIED'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[3rem] border-2 border-slate-50 p-10 shadow-sm">
                  <h4 className="text-[11px] font-black text-slate-900 tracking-[0.2em] uppercase mb-8 flex items-center gap-3">
                    <div className="h-6 w-6 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                       <AlertCircle size={16} strokeWidth={2.5} />
                    </div>
                    Mandatory Response Checklist
                  </h4>
                  <div className="space-y-5">
                    {[
                      { id: 'pcall', label: `Establish comms with ${selectedAlert.sourceApp === 'driver' ? 'Driver' : 'Rider'}` },
                      { id: 'dcall', label: `Verify status with ${selectedAlert.sourceApp === 'driver' ? 'Rider' : 'Driver'}` },
                      { id: 'police', label: 'Alert local law enforcement dispatch' },
                      { id: 'nearby', label: 'Signal nearby units for perimeter support' },
                    ].map((step) => (
                      <button 
                        key={step.id} 
                        onClick={() => setChecklist((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                        className={`flex items-center gap-5 w-full text-left p-4 rounded-2xl transition-all ${checklist[step.id] ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checklist[step.id] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white'}`}>
                           {checklist[step.id] && <CheckCircle2 size={14} strokeWidth={3} />}
                        </div>
                        <span className={`text-[14px] font-black uppercase tracking-tighter ${checklist[step.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {step.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white h-[400px] rounded-[3rem] border-2 border-slate-50 shadow-2xl shadow-slate-200/20 overflow-hidden relative group">
                  {loadError ? (
                    <div className="absolute inset-0 flex items-center justify-center p-10 text-center bg-slate-50">
                      <div>
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
                           <MapPin size={32} />
                        </div>
                        <p className="text-[12px] font-black text-rose-600 uppercase tracking-[0.2em]">Map Feed Offline</p>
                        <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-tight">Encryption layer failed to decrypt spatial data</p>
                      </div>
                    </div>
                  ) : HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={getMapCenter(selectedAlert)}
                      zoom={16}
                      options={{
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: true,
                        styles: [
                           { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
                           { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
                           { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
                           { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
                           { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
                           { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
                           { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
                           { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
                           { "featureType": "road.active", "elementType": "geometry.fill", "stylers": [{ "color": "#dc2626" }] },
                        ]
                      }}
                    >
                      {selectedAlert?.location ? (
                        <MarkerF
                          position={getMapCenter(selectedAlert)}
                          title={`${getParticipantTitle(selectedAlert)} distress location`}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 12,
                            fillColor: '#E11D48',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 4,
                          }}
                        />
                      ) : null}
                    </GoogleMap>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-12 text-center bg-slate-50">
                      <div className="max-w-[280px]">
                        <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-300 mx-auto mb-6">
                           <Globe size={32} />
                        </div>
                        <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] mb-3">Spatial Data Restricted</p>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Active API key required to visualize SOS coordinates in the terminal.</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-6 right-6 flex flex-col gap-3">
                    <button className="bg-white/90 backdrop-blur-md p-3 rounded-[1.25rem] shadow-xl border border-white text-slate-900 hover:scale-105 transition-all">
                      <MoreHorizontal size={20} strokeWidth={2.5} />
                    </button>
                    <button className="bg-rose-600 p-3 rounded-[1.25rem] shadow-xl border border-rose-500 text-white hover:scale-110 transition-all animate-pulse">
                      <MapPin size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white h-[calc(100%-432px)] flex flex-col shadow-2xl shadow-slate-900/40">
                  <div className="flex items-center justify-between mb-8">
                     <h4 className="text-[11px] font-black text-slate-500 tracking-[0.3em] uppercase flex items-center gap-3">
                       <History size={18} /> Incident Log
                     </h4>
                     <div className="h-2 w-2 bg-rose-600 rounded-full animate-ping" />
                  </div>
                  
                  <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                    {[
                      {
                        createdAt: selectedAlert.createdAt,
                        message: `DISTRESS SIGNAL RECEIVED VIA ${selectedAlert.sourceApp.toUpperCase()} GATEWAY.`,
                      },
                      ...(Array.isArray(selectedAlert.logs) ? selectedAlert.logs : []),
                    ].map((log, index) => (
                      <div key={`${log.createdAt || 'log'}-${index}`} className="flex gap-5 group">
                        <div className="flex flex-col items-center">
                           <div className={`h-2.5 w-2.5 rounded-full border-2 ${index === 0 ? 'bg-rose-600 border-rose-400 animate-pulse' : 'bg-slate-700 border-slate-600'}`} />
                           {index < (selectedAlert.logs?.length || 0) && <div className="w-0.5 flex-1 bg-slate-800 my-1" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1.5">
                             {formatDateTime(log.createdAt)}
                           </p>
                           <p className="text-[13px] font-black text-slate-300 tracking-tight leading-tight uppercase">
                             {log.message}
                           </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 relative">
                    <input
                      type="text"
                      value={logDraft}
                      onChange={(event) => setLogDraft(event.target.value)}
                      placeholder="Add cryptographic entry..."
                      className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-4 px-6 text-[13px] font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/50 outline-none transition-all uppercase tracking-tight"
                    />
                    <button
                      onClick={handleResolve}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-white rounded-xl text-slate-900 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"
                    >
                      <ArrowRight size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center flex-col text-center p-20">
            <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-200 mb-8 border-4 border-white shadow-inner">
              <ShieldAlert size={64} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3 uppercase">Standby Mode</h3>
              <p className="text-slate-400 font-bold text-[12px] uppercase tracking-[0.2em] max-w-[320px] leading-relaxed">
                Terminal is polling for emergency distress signals. Select an active incident to initiate SOP.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyCenter;
