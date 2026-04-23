import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Download, History, CreditCard, Gift, Send, QrCode } from 'lucide-react';
import { userAuthService } from '../services/authService';

const Wallet = () => {
  const navigate = useNavigate();

  const [showAddMoney, setShowAddMoney] = React.useState(false);
  const [showSend, setShowSend] = React.useState(false);
  const [showReceive, setShowReceive] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sendPhone, setSendPhone] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSendSuccess, setIsSendSuccess] = React.useState(false);
  const [walletLoading, setWalletLoading] = React.useState(true);
  const [walletError, setWalletError] = React.useState('');
  const [wallet, setWallet] = React.useState({ balance: 0, currency: 'INR', recentTransactions: [] });

  const basePath = useMemo(() => (window.location.pathname.startsWith('/taxi/user') ? '/taxi/user' : ''), []);

  const formatInr = (value) => {
    const amountValue = Number(value || 0);
    const fixed = Math.round(amountValue * 100) / 100;
    return fixed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const splitMoney = (formatted) => {
    const [whole, decimals = '00'] = String(formatted).split('.');
    return { whole, decimals: (decimals || '00').padEnd(2, '0').slice(0, 2) };
  };

  const balanceText = useMemo(() => splitMoney(formatInr(wallet.balance)), [wallet.balance]);

  const refreshWallet = async () => {
    setWalletError('');
    setWalletLoading(true);
    try {
      const response = await userAuthService.getWallet();
      const data = response?.data || {};
      setWallet({
        balance: Number(data.balance || 0),
        currency: data.currency || 'INR',
        recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
      });
    } catch (err) {
      setWalletError(err?.message || 'Failed to load wallet');
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    refreshWallet();
  }, []);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleAddMoney = async () => {
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) return;

    setIsAdding(true);
    setWalletError('');

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load');
      }

      const orderResponse = await userAuthService.createWalletTopupOrder(amountValue);
      const order = orderResponse?.data || {};

      if (!order.keyId || !order.orderId) {
        throw new Error('Unable to start payment');
      }

      let userInfo = {};
      try {
        userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      } catch {
        userInfo = {};
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Rydon24',
        description: 'Wallet Topup',
        order_id: order.orderId,
        prefill: {
          name: userInfo?.name || '',
          email: userInfo?.email || '',
          contact: userInfo?.phone ? `+91${userInfo.phone}` : '',
        },
        modal: {
          ondismiss: () => {
            setIsAdding(false);
          },
        },
        handler: async (response) => {
          try {
            const verifyResponse = await userAuthService.verifyWalletTopup(response);
            const data = verifyResponse?.data || {};
            setWallet({
              balance: Number(data.balance || 0),
              currency: data.currency || 'INR',
              recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
            });
            setIsSuccess(true);
            setTimeout(() => {
              setIsSuccess(false);
              setShowAddMoney(false);
              setAmount('');
            }, 1400);
          } catch (err) {
            setWalletError(err?.message || 'Payment verification failed');
          } finally {
            setIsAdding(false);
          }
        },
        theme: {
          color: '#E85D04',
        },
      });

      rzp.on('payment.failed', (event) => {
        const message = event?.error?.description || event?.error?.reason || 'Payment failed';
        setWalletError(message);
        setIsAdding(false);
      });

      rzp.open();
    } catch (err) {
      setWalletError(err?.message || 'Topup failed');
      setIsAdding(false);
    }
  };

  const handleSend = () => {
    if (!sendAmount || !sendPhone) return;
    setIsSending(true);
    setWalletError('');
    userAuthService
      .transferWallet(sendPhone, Number(sendAmount))
      .then((response) => {
        const data = response?.data || {};
        setWallet({
          balance: Number(data.balance || 0),
          currency: data.currency || 'INR',
          recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
        });
        setIsSendSuccess(true);
        setTimeout(() => {
          setIsSendSuccess(false);
          setShowSend(false);
          setSendAmount('');
          setSendPhone('');
        }, 1400);
      })
      .catch((err) => {
        setWalletError(err?.message || 'Transfer failed');
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F3F4F6_38%,#EEF2F7_100%)] max-w-lg mx-auto flex flex-col font-sans pb-24 relative overflow-x-hidden">
      <div className="absolute -top-20 right-[-40px] h-48 w-48 rounded-full bg-orange-100/55 blur-3xl pointer-events-none" />
      <div className="absolute top-64 left-[-60px] h-56 w-56 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 right-[-40px] h-44 w-44 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
      {/* ADD MONEY MODAL */}
      <AnimatePresence>
        {showAddMoney && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
            <Motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 pb-10 space-y-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddMoney(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90"
              >
                <Plus size={20} className="rotate-45" />
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Add Money</h3>
                <p className="text-[12px] font-bold text-gray-400 tracking-widest uppercase">Select amount to top-up</p>
              </div>

              {isSuccess ? (
                <Motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center py-8 gap-4">
                  <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner">
                    <History size={40} strokeWidth={3} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-gray-900 leading-none">Wallet Refilled!</p>
                    <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-widest">Balance updated successfully</p>
                  </div>
                </Motion.div>
              ) : (
                <div className="space-y-8">
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400 group-focus-within:text-orange-500 transition-colors">₹</span>
                    <input 
                       type="number"
                       value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       placeholder="0.00"
                       className="w-full h-20 bg-gray-50 border-2 border-gray-100 rounded-[24px] pl-12 pr-6 text-3xl font-black text-gray-900 focus:outline-none focus:border-orange-500/30 transition-all text-center placeholder:text-gray-200"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {['100', '500', '1000'].map(val => (
                      <button 
                        key={val}
                        onClick={() => setAmount(val)}
                        className={`py-3 rounded-2xl font-black text-[13px] border-2 transition-all ${
                          amount === val ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white border-gray-100 text-gray-500'
                        }`}
                      >
                        +₹{val}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleAddMoney}
                    disabled={isAdding || !amount}
                    className={`w-full h-16 rounded-[24px] font-black text-[15px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                      isAdding ? 'bg-gray-100 text-gray-300 shadow-none' : 'bg-orange-500 text-white shadow-orange-200'
                    }`}
                  >
                    {isAdding ? 'Processing...' : (
                      <>Refill Wallet <Plus size={20} strokeWidth={3} /></>
                    )}
                  </button>
                </div>
              )}
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEND MODAL */}
      <AnimatePresence>
        {showSend && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
            <Motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 pb-10 space-y-8 shadow-2xl relative"
            >
              <button onClick={() => setShowSend(false)} className="absolute top-6 right-6 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90">
                <Plus size={20} className="rotate-45" />
              </button>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Send Money</h3>
                <p className="text-[12px] font-bold text-gray-400 tracking-widest uppercase">Transfer to a phone number</p>
              </div>
              {isSendSuccess ? (
                <Motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center py-8 gap-4">
                  <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
                    <Send size={36} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-gray-900 leading-none">Money Sent!</p>
                    <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-widest">Transfer successful</p>
                  </div>
                </Motion.div>
              ) : (
                <div className="space-y-5">
                  <input
                    type="tel"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="Recipient phone number"
                    className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-[20px] px-6 text-[15px] font-bold text-gray-900 focus:outline-none focus:border-blue-300 transition-all placeholder:text-gray-300"
                  />
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-gray-400">₹</span>
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-[20px] pl-10 pr-6 text-2xl font-black text-gray-900 focus:outline-none focus:border-blue-300 transition-all text-center placeholder:text-gray-200"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !sendAmount || !sendPhone}
                    className={`w-full h-16 rounded-[24px] font-black text-[15px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                      isSending || !sendAmount || !sendPhone ? 'bg-gray-100 text-gray-300 shadow-none' : 'bg-blue-600 text-white shadow-blue-200'
                    }`}
                  >
                    {isSending ? 'Sending...' : <><Send size={18} strokeWidth={2.5} /> Send Money</>}
                  </button>
                </div>
              )}
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECEIVE MODAL */}
      <AnimatePresence>
        {showReceive && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
            <Motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 pb-10 space-y-8 shadow-2xl relative"
            >
              <button onClick={() => setShowReceive(false)} className="absolute top-6 right-6 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90">
                <Plus size={20} className="rotate-45" />
              </button>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Receive Money</h3>
                <p className="text-[12px] font-bold text-gray-400 tracking-widest uppercase">Share your QR or UPI ID</p>
              </div>
              <div className="flex flex-col items-center gap-6">
                <div className="w-48 h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[28px] flex items-center justify-center text-gray-300">
                  <QrCode size={80} strokeWidth={1.5} />
                </div>
                <div className="w-full bg-gray-50 rounded-[20px] px-6 py-4 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold text-gray-500 truncate">user@rydon24</span>
                  <button
                    onClick={() => navigator.clipboard?.writeText('user@rydon24')}
                    className="text-[11px] font-black text-green-600 uppercase tracking-widest shrink-0 active:scale-95"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="sticky top-0 z-30">
        <div className="bg-white/70 backdrop-blur-md border-b border-white/70 shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
          <div className="px-5 py-4 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/80 border border-white/80 shadow-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} className="text-gray-900" strokeWidth={2.5} />
        </button>
        <h1 className="text-[19px] font-black text-gray-900 tracking-tight">My Wallet</h1>
          </div>
        </div>
      </header>

      {/* BALANCE CARD */}
      <div className="px-5 mt-4">
        <Motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[36px] p-8 text-white shadow-2xl relative overflow-hidden group"
        >
          <Motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(260px_180px_at_20%_25%,rgba(249,115,22,0.18),transparent_60%)]"
            animate={{ opacity: [0.1, 0.22, 0.1], x: [0, 10, 0], y: [0, -6, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-orange-500/20 transition-colors"></div>
          
          <div className="relative z-10 flex flex-col gap-8">
            <div className="space-y-1">
              <p className="text-white/30 font-black uppercase tracking-[0.2em] text-[8px]">Current Liquidity</p>
              <Motion.h2
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
                className="text-4xl font-black tracking-tighter"
              >
                {walletLoading ? (
                  <>₹0<span className="text-white/20 text-2xl">.00</span></>
                ) : (
                  <>₹{balanceText.whole}<span className="text-white/20 text-2xl">.{balanceText.decimals}</span></>
                )}
              </Motion.h2>
              {walletError && <p className="text-[11px] font-bold text-red-300 mt-2">{walletError}</p>}
            </div>
            
            <div className="flex items-center gap-3">
              <Motion.button
                type="button"
                onClick={() => setShowAddMoney(true)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                className="group/cta relative flex-1 bg-white/10 text-white h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 border border-white/15 shadow-lg shadow-orange-500/10 overflow-hidden backdrop-blur-md"
              >
                <span aria-hidden="true" className="absolute inset-0 bg-orange-500/55" />
                <Motion.span
                  aria-hidden="true"
                  className="absolute -left-16 top-0 h-full w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-60"
                  animate={{ x: [0, 320] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
                />
                <Motion.span aria-hidden="true" className="relative z-10" whileHover={{ y: -1 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                  <Plus size={16} strokeWidth={3} />
                </Motion.span>
                <span className="relative z-10">Refill</span>
              </Motion.button>

              <Motion.button
                type="button"
                onClick={() => navigate(`${basePath}/activity`)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="w-14 h-14 bg-white/10 border border-white/15 rounded-2xl flex items-center justify-center text-white shadow-sm backdrop-blur-md"
              >
                <Motion.span aria-hidden="true" whileHover={{ rotate: -12 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                  <History size={20} strokeWidth={2.5} />
                </Motion.span>
              </Motion.button>
            </div>
          </div>
        </Motion.div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="px-5 mt-8 grid grid-cols-3 gap-3">
         <div onClick={() => setShowSend(true)} className="bg-white border border-gray-100 rounded-[28px] p-5 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-95 transition-all hover:border-blue-100 group">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
               <Send size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Send</span>
         </div>
         <div onClick={() => setShowReceive(true)} className="bg-white border border-gray-100 rounded-[28px] p-5 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-95 transition-all hover:border-green-100 group">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors shadow-sm">
               <Download size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Receive</span>
         </div>
         <div 
            onClick={() => navigate(`${basePath}/profile/payments`)}
            className="bg-white border border-gray-100 rounded-[28px] p-5 flex flex-col items-center justify-center gap-3 shadow-sm cursor-pointer active:scale-95 transition-all hover:border-purple-100 group"
         >
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
               <CreditCard size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Cards</span>
         </div>
      </div>

      {/* PROMO */}
      <div className="px-5 mt-8">
         <div 
            onClick={() => navigate(`${basePath}/referral`)}
            className="bg-gradient-to-r from-orange-50 to-white border border-orange-100 rounded-[32px] p-6 flex items-center gap-5 cursor-pointer active:scale-98 transition-all shadow-sm group"
         >
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-xl shadow-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0 border border-orange-50">
               <Gift size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
               <h4 className="text-[15px] font-black text-gray-900 tracking-tight">Refer & Earn ₹50</h4>
               <p className="text-[11px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">Invite friends to Rydon24</p>
            </div>
            <ArrowLeft size={20} className="text-orange-200 rotate-180 group-hover:text-orange-500 transition-colors" />
         </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="px-5 mt-10">
         <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">History Log</h3>
            <button onClick={() => navigate(`${basePath}/activity`)} className="text-[10px] font-black text-orange-500 uppercase tracking-wider">View All</button>
         </div>
         <div className="bg-white rounded-[36px] border border-gray-50 shadow-sm p-3 flex flex-col gap-2">
            {walletLoading ? (
              <div className="p-6 text-center text-[12px] font-bold text-gray-400">Loading...</div>
            ) : wallet.recentTransactions?.length ? (
              wallet.recentTransactions.map((tx) => {
                const isDebit = tx.kind === 'debit';
                const title = tx.title || (isDebit ? 'Debit' : 'Credit');
                const sign = isDebit ? '-' : '+';
                const amountText = formatInr(tx.amount);
                const whenText = tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-IN') : '';
                return (
                  <div key={tx.id} className="flex items-center gap-4 p-4 rounded-[28px] hover:bg-gray-50 transition-all active:scale-[0.99] group">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform ${
                        isDebit ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'
                      }`}
                    >
                      {isDebit ? <ArrowLeft size={20} strokeWidth={3} className="rotate-45" /> : <Plus size={20} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-black text-gray-900 truncate tracking-tight">{title}</h4>
                      <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{whenText}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <h4 className={`text-[16px] font-black tracking-tight ${isDebit ? 'text-gray-900' : 'text-emerald-600'}`}>
                        {sign}₹{amountText}
                      </h4>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${isDebit ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isDebit ? 'Debit' : 'Credit'}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${isDebit ? 'bg-red-400' : 'bg-emerald-400'}`}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-[12px] font-bold text-gray-400">No transactions yet</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Wallet;

