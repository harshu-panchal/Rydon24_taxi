import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Filter,
  Loader2,
  Trash2,
  Edit2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../../shared/api/axiosInstance';

const SetPackagePrices = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    // Simulated fetch - replace with real API call if needed
    setTimeout(() => {
      setPackages([]);
      setLoading(false);
    }, 800);
  }, [id]);

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-6 lg:p-8 font-sans">
      
      {/* Header Block */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
        <h1 className="text-sm font-bold text-[#1E293B] uppercase tracking-[0.15em]">SET PACKAGE PRICES</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium tracking-tight">
           <span className="hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/admin/pricing/set-price')}>Set Package Prices</span>
           <ChevronRight size={10} className="text-slate-300" />
           <span className="text-slate-800 font-bold">Set Package Prices</span>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          {/* Table Controls */}
          <div className="p-5 flex items-center justify-between border-b border-gray-50 bg-white px-8">
              <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                <span>show</span>
                <div className="relative">
                  <select className="appearance-none bg-white border border-gray-200 rounded px-4 py-1.5 pr-8 focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700 font-bold text-[13px]">
                    <option>10</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <span>entries</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-6 py-2 bg-[#F37048] text-white rounded text-sm font-bold shadow-sm">
                  <Filter size={16} /> Filters
                </button>
                <button onClick={() => navigate(`/admin/pricing/set-price/packages/create/${id}`)} className="flex items-center gap-2 px-6 py-2 bg-[#44516F] text-white rounded text-sm font-bold shadow-sm">
                  <Plus size={18} /> Add Package Price
                </button>
              </div>
          </div>

          {/* Table Area */}
          <div className="flex-grow flex flex-col">
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#FBFCFF]">
                      <tr className="border-b border-gray-100 text-[11px] text-slate-800 uppercase font-black tracking-[0.1em]">
                          <th className="px-8 py-5">S.NO</th>
                          <th className="px-8 py-5">Packages</th>
                          <th className="px-8 py-5">Status</th>
                          <th className="px-8 py-5">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="4" className="py-24 text-center">
                              <Loader2 className="w-10 h-10 text-indigo-200 animate-spin mx-auto mb-4" />
                              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Scanning Packages...</p>
                            </td>
                          </tr>
                        ) : packages.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-24">
                              <div className="flex flex-col items-center justify-center gap-4">
                                 {/* Custom SVG Icon for No Data found as seen in image */}
                                 <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-200">
                                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="2" />
                                    <line x1="20" y1="20" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
                                 </svg>
                                 <p className="text-sm font-bold text-[#1E293B]">No Data Found</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          packages.map((pkg, idx) => (
                            <tr key={pkg.id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                               <td className="px-8 py-5 text-sm text-slate-500 font-medium">{idx + 1}</td>
                               <td className="px-8 py-5 text-sm text-slate-700 font-bold">{pkg.name}</td>
                               <td className="px-8 py-5 font-bold text-xs"><span className={`px-3 py-1 rounded-full ${pkg.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{pkg.status}</span></td>
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                     <button className="w-8 h-8 rounded bg-gray-50 text-slate-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Edit2 size={14} /></button>
                                     <button className="w-8 h-8 rounded bg-gray-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all"><Trash2 size={14} /></button>
                                  </div>
                               </td>
                            </tr>
                          ))
                        )}
                    </tbody>
                  </table>
              </div>
          </div>

          {/* Footer Area */}
          <div className="p-8 border-t border-gray-50 flex items-center justify-between">
              <p className="text-[13px] text-slate-400 font-medium">Showing to of 0 entries</p>
              <div className="flex items-center gap-1">
                 <button className="px-4 py-1.5 text-slate-400 text-sm font-bold hover:bg-gray-100 rounded transition-all">Prev</button>
                 <button className="w-8 h-8 flex items-center justify-center bg-[#44516F] text-white rounded font-bold text-sm">1</button>
                 <button className="px-4 py-1.5 text-slate-400 text-sm font-bold hover:bg-gray-100 rounded transition-all">Next</button>
              </div>
          </div>
      </div>
      
      {/* Floating Design Element */}
      <div className="fixed bottom-10 right-10">
         <button className="w-14 h-14 bg-[#00BFA5] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all">
            <div className="flex flex-col gap-1 items-center">
               <div className="w-6 h-0.5 bg-white rounded-full"></div>
               <div className="w-6 h-0.5 bg-white/70 rounded-full"></div>
               <div className="w-6 h-0.5 bg-white/40 rounded-full"></div>
            </div>
         </button>
      </div>

    </div>
  );
};

export default SetPackagePrices;
