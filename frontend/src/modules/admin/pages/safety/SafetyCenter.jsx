import React, { useState, useEffect } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { 
  ShieldAlert, 
  MapPin, 
  PhoneCall, 
  User, 
  Car, 
  Clock, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertCircle,
  History,
  LifeBuoy,
  XCircle,
  Radio,
  ArrowRight
} from 'lucide-react';
import { HAS_VALID_GOOGLE_MAPS_KEY, INDIA_CENTER, useAppGoogleMapsLoader } from '../../utils/googleMaps';

const mapContainerStyle = { width: '100%', height: '100%' };

const SOSCard = ({ alert, isActive, onClick }) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
      isActive 
        ? 'bg-red-50 border-red-200' 
        : 'bg-white border-gray-100 hover:border-red-100'
    }`}
  >
    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>}
    
    <div className="flex justify-between items-start mb-2">
       <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Live SOS</span>
       <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
          <Clock size={12} /> {alert.time}
       </div>
    </div>
    
    <h4 className="text-[14px] font-black text-gray-900 tracking-tight leading-none mb-1">{alert.passenger}</h4>
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter mb-3">{alert.tripId}</p>
    
    <div className="flex items-center gap-3 border-t border-gray-50 pt-3">
       <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
          <Car size={16} />
       </div>
       <div className="leading-none">
          <p className="text-[12px] font-bold text-gray-700">{alert.driver}</p>
          <p className="text-[10px] font-medium text-gray-400 mt-1 uppercase">{alert.vehicle}</p>
       </div>
    </div>
  </div>
);

const SafetyCenter = () => {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [checklist, setChecklist] = useState({
    pcall: false,
    dcall: false,
    police: false,
    nearby: false
  });

  const alerts = [
    { id: 1, passenger: 'Sneha Reddy', driver: 'Vikram Singh', vehicle: 'White Dzire (MP-09-XY-1234)', tripId: 'TRP-102942', time: '2m ago', location: 'Vijay Nagar Sq.', lat: 22.7533, lng: 75.8937 },
    { id: 2, passenger: 'Amit Khanna', driver: 'Rohan Patil', vehicle: 'Bike (MP-04-QR-5542)', tripId: 'TRP-102943', time: '5m ago', location: 'Rajwada Market', lat: 22.7177, lng: 75.8545 },
  ];
  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  useEffect(() => {
    if (!selectedAlert && alerts.length > 0) {
      setSelectedAlert(alerts[0]);
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Alert Sidebar */}
      <div className="w-80 shrink-0 flex flex-col space-y-6 overflow-y-auto no-scrollbar pb-10">
         <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-red-600 flex items-center gap-3">
               <ShieldAlert size={28} strokeWidth={2.5} className="animate-bounce" /> Safety Center
            </h1>
            <p className="text-gray-400 font-bold text-[11px] mt-1 uppercase tracking-widest leading-none">Real-time Emergency Monitoring</p>
         </div>

         <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between px-1 mb-4">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <Radio size={14} className="text-red-500" /> Active Alerts ({alerts.length})
               </span>
               <button className="text-[10px] font-bold text-primary uppercase">Refresh</button>
            </div>
            {alerts.map(alert => (
               <SOSCard 
                 key={alert.id} 
                 alert={alert} 
                 isActive={selectedAlert?.id === alert.id}
                 onClick={() => setSelectedAlert(alert)}
               />
            ))}
         </div>

         <div className="bg-gray-900 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-3 mb-3">
               <LifeBuoy size={18} className="text-primary" />
               <h5 className="text-[12px] font-black uppercase tracking-widest">SOP Support</h5>
            </div>
            <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase">
               Response time must be below <span className="text-white">60 Seconds</span>. Call local police immediately if signal is lost.
            </p>
         </div>
      </div>

      {/* Main Investigation Area */}
      <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
         {selectedAlert ? (
           <>
              {/* Top Summary Bar */}
              <div className="bg-white border-2 border-red-100 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-red-50">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 border-4 border-red-50 relative">
                       <ShieldAlert size={32} />
                       <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter">RED</div>
                    </div>
                    <div>
                       <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none mb-2">{selectedAlert.passenger} is distressed</h2>
                       <p className="text-[13px] font-bold text-gray-500 flex items-center gap-2 font-black">
                         <MapPin size={16} className="text-red-500" /> Last Known Location: {selectedAlert.location}
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-3">
                    <button className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[14px] font-black hover:bg-red-700 transition-all shadow-xl shadow-red-200 flex items-center gap-2">
                       <PhoneCall size={18} strokeWidth={2.5} /> DIAL POLICE (100)
                    </button>
                    <button className="bg-white border-2 border-gray-100 text-gray-900 px-6 py-3 rounded-2xl text-[14px] font-black hover:bg-gray-50 transition-all flex items-center gap-2">
                       <CheckCircle2 size={18} /> RESOLVE INCIDENT
                    </button>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 {/* Participant Details */}
                 <div className="space-y-6">
                    <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
                       <h4 className="text-[12px] font-black text-gray-400 tracking-widest uppercase mb-8 flex items-center justify-between">
                         Distress Context <MoreHorizontal size={16} />
                       </h4>
                       <div className="flex items-center gap-8 mb-10">
                          <div className="text-center group cursor-pointer">
                             <div className="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden mb-3 border-2 border-white group-hover:border-red-200 transition-all shadow-lg">
                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200" className="w-full h-full object-cover" alt="Passenger" />
                             </div>
                             <p className="text-[14px] font-black text-gray-900 leading-tight">{selectedAlert.passenger}</p>
                             <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Passenger</span>
                             <div className="mt-3 bg-gray-50 p-2 rounded-lg text-primary hover:bg-primary/10 transition-all"><PhoneCall size={18} className="mx-auto" /></div>
                          </div>
                          
                          <div className="flex-1 flex flex-col items-center justify-center gap-2">
                              <div className="w-12 h-px bg-gray-100"></div>
                              <Car size={24} className="text-gray-300" />
                              <div className="w-12 h-px bg-gray-100"></div>
                          </div>

                          <div className="text-center group cursor-pointer">
                             <div className="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden mb-3 border-2 border-white group-hover:border-gray-200 transition-all shadow-lg">
                                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200" className="w-full h-full object-cover" alt="Driver" />
                             </div>
                             <p className="text-[14px] font-black text-gray-900 leading-tight">{selectedAlert.driver}</p>
                             <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Driver</span>
                             <div className="mt-3 bg-gray-50 p-2 rounded-lg text-gray-900 hover:bg-gray-100 transition-all"><PhoneCall size={18} className="mx-auto" /></div>
                          </div>
                       </div>

                       <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                          <div className="flex justify-between items-center text-[13px] font-bold">
                             <span className="text-gray-400">Total Distance:</span>
                             <span className="text-gray-900">4.2 KM / 12.0 KM</span>
                          </div>
                          <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                             <div className="bg-primary h-full w-[35%] rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-2 pt-2 text-green-600 font-bold text-[12px]">
                             <CheckCircle2 size={14} /> Trip verified as Active via GPS
                          </div>
                       </div>
                    </div>

                    <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
                       <h4 className="text-[12px] font-black text-gray-900 tracking-widest uppercase mb-6 flex items-center gap-2">
                         <AlertCircle size={18} className="text-blue-500" /> Dispatch SOP Checklist
                       </h4>
                       <div className="space-y-4">
                          {[
                            { id: 'pcall', label: 'Call Passenger to verify status' },
                            { id: 'dcall', label: 'Call Driver to confirm situation' },
                            { id: 'police', label: 'Notify nearest Police hub (Vijay Nagar)' },
                            { id: 'nearby', label: 'Dispatch nearby Driver Partners' },
                          ].map(step => (
                            <div key={step.id} className="flex items-center gap-4">
                               <input 
                                 type="checkbox" 
                                 checked={checklist[step.id]}
                                 onChange={() => setChecklist(prev => ({...prev, [step.id]: !prev[step.id]}))}
                                 className="w-5 h-5 rounded-md border-gray-200 text-primary focus:ring-primary/20" 
                               />
                               <span className={`text-[13px] font-bold ${checklist[step.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.label}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 {/* GPS Map View & Logs */}
                 <div className="space-y-6">
                    <div className="bg-white h-[320px] rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative">
                       {loadError ? (
                         <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-slate-50">
                            <div>
                               <p className="text-[12px] font-black text-rose-600 uppercase tracking-widest">Map unavailable</p>
                               <p className="text-sm text-gray-500 mt-2">Google Maps could not be loaded for Safety Center.</p>
                            </div>
                         </div>
                       ) : HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                         <GoogleMap
                           mapContainerStyle={mapContainerStyle}
                           center={selectedAlert ? { lat: selectedAlert.lat, lng: selectedAlert.lng } : INDIA_CENTER}
                           zoom={15}
                           options={{
                             streetViewControl: false,
                             mapTypeControl: false,
                             fullscreenControl: true
                           }}
                         >
                           {selectedAlert ? (
                             <MarkerF
                               position={{ lat: selectedAlert.lat, lng: selectedAlert.lng }}
                               title={`${selectedAlert.passenger} distress location`}
                               icon={{
                                 path: window.google.maps.SymbolPath.CIRCLE,
                                 scale: 10,
                                 fillColor: '#DC2626',
                                 fillOpacity: 1,
                                 strokeColor: '#ffffff',
                                 strokeWeight: 3
                               }}
                             />
                           ) : null}
                         </GoogleMap>
                       ) : (
                         <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-[linear-gradient(135deg,#fee2e2_0%,#fff1f2_100%)]">
                            <div>
                               <p className="text-[12px] font-black text-red-600 uppercase tracking-widest">Add Google Maps key</p>
                               <p className="text-sm text-gray-500 mt-2">Safety Center will show the live incident map after `VITE_GOOGLE_MAPS_API_KEY` is set.</p>
                            </div>
                         </div>
                       )}

                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="relative">
                             <div className="w-12 h-12 bg-red-600/20 rounded-full animate-ping absolute inset-0"></div>
                             <div className="w-12 h-12 bg-red-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white relative z-10">
                                <Car size={24} />
                             </div>
                             <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap shadow-2xl">
                                IN DISTRESS
                             </div>
                          </div>
                       </div>

                       <div className="absolute top-4 right-4 flex flex-col gap-2">
                          <button className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-white text-gray-500 hover:text-black transition-all"><MoreHorizontal size={18} /></button>
                          <button className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-white text-primary hover:scale-105 transition-all"><MapPin size={18} /></button>
                       </div>
                    </div>

                    <div className="bg-[#0F172A] rounded-[32px] p-8 text-white h-[calc(100%-344px)] flex flex-col">
                       <h4 className="text-[12px] font-black text-gray-500 tracking-widest uppercase mb-6 flex items-center justify-between">
                         Live Incident Log <History size={16} />
                       </h4>
                       <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
                          {[
                            { time: '12:44 PM', log: 'SOS Alert triggered by Passenger App.' },
                            { time: '12:44 PM', log: 'GPS Tracking Locked onto MH-09-XY-1234.' },
                            { time: '12:45 PM', log: 'Dispatcher (Admin) opened incident report.' },
                            { time: '12:46 PM', log: 'Passenger not reachable on primary number.' },
                          ].map((log, i) => (
                            <div key={i} className="flex gap-4 group">
                               <span className="text-[11px] font-black text-gray-600 whitespace-nowrap mt-0.5">{log.time}</span>
                               <p className="text-[13px] font-bold text-gray-300 tracking-tight leading-snug group-last:text-white uppercase tracking-tighter">
                                  {log.log} {i === 3 && <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse ml-2"></span>}
                               </p>
                            </div>
                          ))}
                       </div>
                       <div className="mt-8 relative">
                          <input type="text" placeholder="Add incident log entry..." className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-white/20 transition-all" />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-lg text-black hover:bg-white/90"><ArrowRight size={16} /></button>
                       </div>
                    </div>
                 </div>
              </div>
           </>
         ) : (
           <div className="h-full flex items-center justify-center flex-col text-center space-y-4">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                 <ShieldAlert size={40} />
              </div>
              <div>
                 <h3 className="text-xl font-black text-gray-900 tracking-tight">No Incidents Selected</h3>
                 <p className="text-gray-400 font-bold text-[12px] uppercase">Please select an active alert to start intervention</p>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default SafetyCenter;
