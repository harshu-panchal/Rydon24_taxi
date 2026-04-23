import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  IndianRupee, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  User, 
  Phone, 
  CreditCard, 
  Calendar,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building,
  MoreHorizontal,
  ChevronDown,
  Eye,
  Search
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const WithdrawalRequestDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeMenu, setActiveMenu] = useState(null);
  const [history, setHistory] = useState([]);
  const [driver, setDriver] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const toggleMenu = (e, idx) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === idx ? null : idx);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${globalThis.__LEGACY_BACKEND_ORIGIN__}/api/v1/admin/wallet/drivers/${id}/withdrawals?limit=${itemsPerPage}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setDriver(data.data?.driver);
          const mapped = (data.data?.results || []).map(r => ({
            id: r._id,
            date: new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'j', month: 'short', hour: '2-digit', minute: '2-digit' }),
            name: data.data?.driver?.name || 'Unknown',
            phone: data.data?.driver?.mobile || 'N/A',
            amount: `${r.requested_currency || 'INR'} ${r.amount}`,
            status: r.status
          }));
          setHistory(mapped);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, itemsPerPage]);

  useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  return (
    <div className="space-y-8 p-1 animate-in fade-in duration-700 font-sans text-gray-950 max-w-7xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/drivers/wallet/withdrawals')}
            className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 hover:text-gray-950 transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none mb-1.5">View Details</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
               <span>Wallet</span>
               <ChevronRight size={10} />
               <span>Withdrawal</span>
               <ChevronRight size={10} />
               <span className="text-indigo-600">Audit Request</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
         {/* LEFT COLUMN: Balance Info */}
         <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-indigo-950 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-10 opacity-10 scale-[2] -rotate-12 translate-x-4"><IndianRupee size={100} strokeWidth={1} /></div>
               <div className="relative z-10">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 italic">Total Balance Amount</p>
                  <p className="text-6xl font-black tracking-tighter leading-none mb-6">6600.00</p>
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-2xl border border-white/5 backdrop-blur-sm">
                     <ShieldCheck size={18} className="text-indigo-400" />
                     <span className="text-[12px] font-bold uppercase tracking-widest">Verified Wallet</span>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[40px] border border-gray-100 p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Building size={20} /></div>
                  <h4 className="text-[14px] font-black text-gray-900 uppercase tracking-widest leading-none">account_transfer</h4>
               </div>
               
               <div className="space-y-6">
                  <div className="border-b border-gray-50 pb-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block leading-none">Account Holder Name</label>
                    <p className="text-[14px] font-black text-gray-950 uppercase tracking-tight leading-none">SACHIN</p>
                  </div>
                  <div className="border-b border-gray-50 pb-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block leading-none">Account Number</label>
                    <p className="text-[18px] font-black text-gray-950 tracking-widest leading-none">716210510000871</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block leading-none">IFSC Code</label>
                    <p className="text-[15px] font-black text-indigo-600 uppercase tracking-widest leading-none">BKID0007162</p>
                  </div>
               </div>
            </div>
         </div>

         {/* RIGHT COLUMN: History Table */}
         <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
               <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-[14px] font-black text-gray-900 uppercase tracking-widest leading-none">Withdrawal Request History</h3>
                  <div className="flex items-center gap-3">
                     <span className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-black uppercase text-gray-400">Verified History</span>
                  </div>
               </div>
               
               <div className="p-6 bg-gray-50/10 flex items-center justify-between border-b border-gray-50">
                  <div className="flex items-center gap-3 text-[12px] font-black uppercase tracking-widest text-gray-400">
                    show 
                    <select 
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(e.target.value)}
                      className="bg-white border border-gray-100 rounded-lg px-2 py-1 outline-none text-gray-950 font-black cursor-pointer shadow-sm"
                    >
                      <option>10</option>
                      <option>25</option>
                    </select>
                    entries
                  </div>
                  <div className="relative group">
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                     <input type="text" placeholder="Filter history..." className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-[12px] font-bold outline-none ring-offset-2 focus:ring-4 focus:ring-gray-100 transition-all w-64 shadow-sm" />
                  </div>
               </div>

               <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                           <th className="px-8 py-5">Date</th>
                           <th className="px-5 py-5">Name</th>
                           <th className="px-5 py-5">Mobile Number</th>
                           <th className="px-5 py-5">Amount</th>
                           <th className="px-5 py-5 text-center">Status</th>
                           <th className="px-8 py-5 text-right w-10">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {history.map((req, idx) => (
                           <tr key={req.id} className="hover:bg-gray-50/20 transition-all group">
                              <td className="px-8 py-6">
                                 <span className="text-[12px] font-bold text-gray-400 uppercase tracking-tight italic">{req.date}</span>
                              </td>
                              <td className="px-5 py-6">
                                 <span className="text-[13px] font-black text-gray-950 uppercase tracking-tight">{req.name}</span>
                              </td>
                              <td className="px-5 py-6 text-[13px] font-bold text-gray-700">
                                 {req.phone}
                              </td>
                              <td className="px-5 py-6 font-black text-[13px] text-gray-900 tracking-tight">
                                 {req.amount}
                              </td>
                              <td className="px-5 py-6 text-center">
                                 <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-current shadow-sm ${
                                   req.status === 'requested' ? 'bg-amber-50 text-amber-600' :
                                   req.status === 'Declined' ? 'bg-rose-50 text-rose-600 opacity-80' : 'bg-emerald-50 text-emerald-600'
                                 }`}>
                                    {req.status}
                                 </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 <div className="relative">
                                    <button 
                                      onClick={(e) => toggleMenu(e, idx)}
                                      className="p-2.5 text-gray-300 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm group-hover:shadow-md border border-transparent hover:border-gray-50"
                                    >
                                       <MoreHorizontal size={18} />
                                    </button>
                                    
                                    {activeMenu === idx && req.status === 'requested' && (
                                       <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                          <button className="w-full text-left px-4 py-2.5 text-[12px] font-black text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors uppercase tracking-widest">
                                             <CheckCircle2 size={16} /> Approve
                                          </button>
                                          <button className="w-full text-left px-4 py-2.5 text-[12px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors uppercase tracking-widest">
                                             <XCircle size={16} /> Decline
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="p-8 border-t border-gray-50 bg-gray-50/20 text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Showing 1 to {history.length} of {history.length} entries</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default WithdrawalRequestDetail;

