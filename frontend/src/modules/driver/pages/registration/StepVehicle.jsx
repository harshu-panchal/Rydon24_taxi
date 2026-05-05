import React, { useEffect, useState } from 'react';
import { 
    ArrowLeft, 
    Car, 
    ChevronRight, 
    MapPin, 
    Zap, 
    Package,
    ShieldCheck,
    Info,
    CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getStoredDriverRegistrationSession,
    getDriverServiceLocations,
    saveDriverRegistrationSession,
    saveDriverVehicle,
    getDriverVehicleTypes,
} from '../../services/registrationService';

const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;
const getCurrentVehicleYear = () => new Date().getFullYear();
const normalizeVehicleNumber = (value = '') => String(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11);
const normalizePostalCode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);
const normalizeServiceCategories = (value, registerFor = 'taxi') => {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : [];

    const normalized = [...new Set(
        rawValues
            .map((item) => String(item || '').trim().toLowerCase())
            .flatMap((item) => item === 'both' ? ['taxi', 'outstation'] : item ? [item] : [])
            .filter((item) => ['taxi', 'outstation', 'delivery', 'pooling'].includes(item)),
    )];

    if (normalized.length > 0) {
        return normalized;
    }

    const fallback = String(registerFor || 'taxi').trim().toLowerCase();
    if (fallback === 'both') {
        return ['taxi', 'outstation'];
    }

    return ['taxi', 'outstation', 'delivery', 'pooling'].includes(fallback) ? [fallback] : ['taxi'];
};

const getPrimaryRegisterFor = (serviceCategories = [], fallback = 'taxi') => {
    const normalized = normalizeServiceCategories(serviceCategories, fallback);

    if (normalized.includes('taxi') && normalized.includes('outstation')) return 'both';
    if (normalized.includes('taxi')) return 'taxi';
    if (normalized.includes('outstation')) return 'outstation';
    if (normalized.includes('delivery')) return 'delivery';
    if (normalized.includes('pooling')) return 'pooling';

    return String(fallback || 'taxi').trim().toLowerCase() || 'taxi';
};


const StepVehicle = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const session = {
        ...getStoredDriverRegistrationSession(),
        ...(location.state || {}),
    };
    const role = session.role || 'driver';
    const isOwner = role === 'owner';

    const [locations, setLocations] = useState([]);
    const [locationsLoading, setLocationsLoading] = useState(true);
    const [locationsError, setLocationsError] = useState('');

    const [vehicleTypes, setVehicleTypes] = useState([]);
    const [vehicleTypesLoading, setVehicleTypesLoading] = useState(false);

    const [formData, setFormData] = useState({
        registerFor: getPrimaryRegisterFor(session.serviceCategories || session.vehicleSession?.vehicle?.serviceCategories || [], session.registerFor || 'taxi'),
        serviceCategories: normalizeServiceCategories(session.serviceCategories || session.vehicleSession?.vehicle?.serviceCategories || [], session.registerFor || 'taxi'),
        locationId: session.locationId || '',
        vehicleTypeId: session.vehicleTypeId || '',
        make: session.make || '',
        model: session.model || '',
        year: session.year || '',
        number: session.number || '',
        color: session.color || '',
        // Company info for owners
        companyName: session.companyName || '',
        companyAddress: session.companyAddress || '',
        city: session.city || '',
        postalCode: session.postalCode || '',
        taxNumber: session.taxNumber || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const trimmedModel = String(formData.model || '').trim();

    useEffect(() => {
        saveDriverRegistrationSession({
            ...session,
            ...formData,
        });
    }, [formData]);

    useEffect(() => {
        let active = true;

        const loadLocations = async () => {
            try {
                setLocationsLoading(true);
                setLocationsError('');

                const response = await getDriverServiceLocations();
                const results = response?.data?.results || response?.data || [];

                if (active) {
                    setLocations(Array.isArray(results) ? results : []);
                }
            } catch (err) {
                if (active) {
                    setLocationsError(err?.message || 'Unable to load service locations');
                    setLocations([]);
                }
            } finally {
                if (active) {
                    setLocationsLoading(false);
                }
            }
        };

        const loadVehicleTypes = async () => {
            try {
                setVehicleTypesLoading(true);
                const response = await getDriverVehicleTypes();
                const results = response?.data?.results || response?.data || [];
                if (active) {
                    setVehicleTypes(Array.isArray(results) ? results : []);
                }
            } catch (err) {
                console.error('Failed to load vehicle types:', err);
            } finally {
                if (active) {
                    setVehicleTypesLoading(false);
                }
            }
        };

        loadLocations();
        loadVehicleTypes();

        return () => {
            active = false;
        };
    }, []);

    const handleContinue = async () => {
        let required = [];
        if (isOwner) {
            required = ['locationId', 'companyName', 'companyAddress', 'city', 'postalCode', 'taxNumber'];
        } else {
            required = ['locationId', 'vehicleTypeId', 'make', 'model', 'year', 'number', 'color'];
            if (formData.serviceCategories.length === 0) {
                setError('Please select at least one service category');
                return;
            }
        }

        if (required.every(key => formData[key])) {
            if (isOwner) {
                if (!/^\d{6}$/.test(formData.postalCode)) {
                    setError('Postal code must be a 6 digit number');
                    return;
                }
            } else {
                const vehicleYear = Number(formData.year);
                const currentYear = getCurrentVehicleYear();
                const normalizedNumber = normalizeVehicleNumber(formData.number);

                if (!/^\d{4}$/.test(formData.year) || vehicleYear < 1980 || vehicleYear > currentYear) {
                    setError(`Vehicle year must be between 1980 and ${currentYear}`);
                    return;
                }

                if (!VEHICLE_NUMBER_REGEX.test(normalizedNumber)) {
                    setError('Vehicle number must be in a valid Indian format, for example DL1RT1234 or MH12AB1234');
                    return;
                }

                if (/^\d+$/.test(trimmedModel)) {
                    setError('Vehicle model cannot contain only numbers');
                    return;
                }
            }

            setLoading(true);
            setError('');

            try {
                const normalizedNumber = normalizeVehicleNumber(formData.number);
                const selectedServiceLocation = locations.find(
                    (item) => String(item._id || item.id) === String(formData.locationId)
                );

                const response = await saveDriverVehicle({
                    registrationId: session.registrationId,
                    phone: session.phone,
                    registerFor: formData.registerFor,
                    serviceCategories: formData.serviceCategories,
                    locationId: formData.locationId,
                    locationName: selectedServiceLocation?.name || selectedServiceLocation?.service_location_name || '',
                    serviceLocation: selectedServiceLocation || null,
                    vehicleTypeId: formData.vehicleTypeId,
                    make: formData.make,
                    model: formData.model,
                    year: formData.year,
                    number: normalizedNumber,
                    color: formData.color,
                    companyName: formData.companyName,
                    companyAddress: formData.companyAddress,
                    city: isOwner ? formData.city : selectedServiceLocation?.name || selectedServiceLocation?.service_location_name || formData.city,
                    postalCode: formData.postalCode,
                    taxNumber: formData.taxNumber,
                });

                const nextState = saveDriverRegistrationSession({
                    ...session,
                    ...formData,
                    number: normalizedNumber,
                    vehicleSession: response?.data?.session || null,
                });

                navigate('/taxi/driver/step-documents', { state: nextState });
            } catch (err) {
                setError(err?.message || 'Unable to save vehicle details');
            } finally {
                setLoading(false);
            }
        } else {
            setError(isOwner ? 'Please fill all company information fields' : 'Please fill all vehicle information fields');
        }
    };

    const registerTypes = [
        { id: 'taxi', label: 'Taxi', icon: <Car size={18} />, color: 'emerald' },
        { id: 'outstation', label: 'Outstation', icon: <MapPin size={18} />, color: 'sky' },
        { id: 'delivery', label: 'Delivery', icon: <Package size={18} />, color: 'amber' },
        { id: 'pooling', label: 'Pooling', icon: <Zap size={18} />, color: 'indigo' }
    ];

    return (
        <div 
            className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none overflow-x-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            <main className="mx-auto max-w-sm space-y-6">
                <header className="space-y-6">
                    <div className="flex items-center justify-between">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => navigate('/taxi/driver/step-referral', { state: session })}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-900 shadow-sm transition-all"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </motion.button>
                        <div className="rounded-full bg-slate-900/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-900/5">
                            Step 3 of 4
                        </div>
                    </div>

                    <section className="space-y-3">
                        <div className="flex items-center gap-3">
                             <div className="flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                                <Car size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                                Vehicle Details
                            </span>
                        </div>
                        <h1 className="font-['Outfit'] text-[48px] font-black leading-[1] tracking-[-0.04em] text-slate-900">
                            {isOwner ? 'Fleet' : 'Vehicle'} <span className="text-slate-400">Setup</span>
                        </h1>
                        <p className="text-[15px] leading-relaxed text-slate-500 font-bold opacity-80 max-w-[28ch]">
                            {isOwner ? 'Setup your business profile to start managing your fleet.' : 'Tell us about the vehicle you\'ll be using for your services.'}
                        </p>
                    </section>
                </header>

                <div className="space-y-5">
                    {!isOwner && (
                        <section className="space-y-4 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                            <div className="space-y-1 px-1">
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Service Category</h2>
                                <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest opacity-60">Selection Required</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {registerTypes.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setFormData((previous) => {
                                            const exists = previous.serviceCategories.includes(item.id);
                                            const nextServiceCategories = exists
                                                ? previous.serviceCategories.filter((value) => value !== item.id)
                                                : [...previous.serviceCategories, item.id];

                                            return {
                                                ...previous,
                                                serviceCategories: nextServiceCategories,
                                                registerFor: getPrimaryRegisterFor(nextServiceCategories, previous.registerFor),
                                            };
                                        })}
                                        className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 transition-all group relative overflow-hidden ${
                                            formData.serviceCategories.includes(item.id)
                                            ? 'bg-slate-900 border-slate-900 text-white' 
                                            : 'bg-slate-50 border-slate-50 text-slate-600 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                            formData.serviceCategories.includes(item.id) ? 'bg-white text-slate-900' : 'bg-white shadow-sm text-slate-400'
                                        }`}>
                                            {item.icon}
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                                        {formData.serviceCategories.includes(item.id) && (
                                             <div className="absolute top-1.5 right-1.5">
                                                <CheckCircle2 size={12} className="text-white" strokeWidth={3} />
                                             </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {formData.serviceCategories.length === 0 && (
                                <div className="rounded-2xl border border-amber-50 bg-amber-50/30 px-4 py-3 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">
                                    Select at least one category
                                </div>
                            )}
                        </section>
                    )}

                    <section className="space-y-5 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm group-focus-within:bg-slate-900 group-focus-within:text-white transition-all">
                                    <MapPin size={20} strokeWidth={2.5} />
                                </div>
                                <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70">Operating City</label>
                                    <select 
                                        value={formData.locationId}
                                        onChange={(e) => {
                                            const nextLocationId = e.target.value;
                                            const selectedServiceLocation = locations.find(
                                                (item) => String(item._id || item.id) === String(nextLocationId),
                                            );

                                            setFormData((p) => ({
                                                ...p,
                                                locationId: nextLocationId,
                                                vehicleTypeId: '',
                                                ...(isOwner
                                                    ? {
                                                        companyAddress: p.companyAddress || String(selectedServiceLocation?.address || '').trim(),
                                                        city:
                                                            p.city ||
                                                            String(
                                                                selectedServiceLocation?.service_location_name ||
                                                                selectedServiceLocation?.name ||
                                                                '',
                                                            ).trim(),
                                                    }
                                                    : {}),
                                            }));
                                        }}
                                        disabled={locationsLoading || locations.length === 0}
                                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="">{locationsLoading ? 'Loading...' : 'Select City'}</option>
                                        {locations.map(loc => (
                                            <option key={loc._id || loc.id} value={loc._id || loc.id}>
                                                {loc.service_location_name || loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {isOwner ? (
                            <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Company Name</label>
                                    <input 
                                        value={formData.companyName}
                                        onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))}
                                        placeholder="Legal Company Name"
                                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                    />
                                </div>

                                <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Company Address</label>
                                    <input 
                                        value={formData.companyAddress}
                                        onChange={(e) => setFormData(p => ({ ...p, companyAddress: e.target.value }))}
                                        placeholder="Business Address"
                                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">City</label>
                                        <input 
                                            value={formData.city}
                                            onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                                            placeholder="City"
                                            className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                        />
                                    </div>
                                    <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Postal Code</label>
                                        <input 
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData(p => ({ ...p, postalCode: normalizePostalCode(e.target.value) }))}
                                            placeholder="Pincode"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                        />
                                    </div>
                                </div>

                                <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Tax Number (GST/VAT)</label>
                                    <input 
                                        value={formData.taxNumber}
                                        onChange={(e) => setFormData(p => ({ ...p, taxNumber: e.target.value.toUpperCase() }))}
                                        placeholder="Tax Identification"
                                        className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200 uppercase"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
                                {formData.locationId && (
                                    <div className="space-y-4 pt-1">
                                         <div className="space-y-1 px-1">
                                            <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950">Vehicle Type</h2>
                                            <p className="text-sm text-slate-500">Select the type of vehicle you drive.</p>
                                        </div>
                                         <div className="grid grid-cols-2 gap-3">
                                             {vehicleTypesLoading ? (
                                                 Array.from({ length: 4 }).map((_, i) => (
                                                     <div key={i} className="h-32 bg-slate-50/50 rounded-2xl animate-pulse" />
                                                 ))
                                             ) : (
                                                 vehicleTypes.map((type) => (
                                                     <div
                                                         key={type._id || type.id}
                                                         onClick={() => setFormData(p => ({ ...p, vehicleTypeId: type._id || type.id }))}
                                                         className={`relative h-32 rounded-3xl border transition-all flex flex-col group overflow-hidden cursor-pointer ${
                                                             formData.vehicleTypeId === (type._id || type.id)
                                                             ? 'border-slate-900 bg-slate-900/[0.02] ring-1 ring-slate-900/5' 
                                                             : 'border-slate-100 bg-[#FCFCFB] hover:border-slate-200'
                                                         }`}
                                                     >
                                                         <div className="flex-1 flex items-center justify-center p-3">
                                                            {type.image || type.icon || type.map_icon ? (
                                                                <img 
                                                                    src={type.image || type.icon || type.map_icon} 
                                                                    alt={type.name} 
                                                                    className="max-h-14 w-auto object-contain transition-transform duration-500"
                                                                />
                                                            ) : (
                                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                                                                    <Car size={24} />
                                                                </div>
                                                            )}
                                                         </div>
                                                         <div className={`p-2.5 text-center transition-colors ${
                                                             formData.vehicleTypeId === (type._id || type.id) ? 'bg-slate-900 text-white font-bold' : 'bg-white/50 text-slate-700 font-semibold'
                                                         }`}>
                                                             <span className="text-[11px] tracking-tight uppercase">{type.name || type.vehicle_type_name}</span>
                                                         </div>
                                                     </div>
                                                 ))
                                             )}
                                         </div>
                                    </div>
                                )}

                                <div className="space-y-5 pt-1">
                                    <div className="space-y-1 px-1">
                                        <h2 className="text-lg font-black tracking-tight text-slate-900">Technical Specs</h2>
                                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest opacity-60">Verified from RC/Permit</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5 col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Brand / Make</label>
                                            <input 
                                                value={formData.make}
                                                onChange={(e) => setFormData(p => ({ ...p, make: e.target.value }))}
                                                placeholder="e.g. Maruti Suzuki"
                                                className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                            />
                                        </div>

                                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Model</label>
                                            <input 
                                                value={formData.model}
                                                onChange={(e) => setFormData(p => ({ ...p, model: e.target.value }))}
                                                placeholder="Swift, Bolt"
                                                className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                            />
                                        </div>

                                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Year</label>
                                            <input 
                                                type="tel"
                                                maxLength={4}
                                                value={formData.year}
                                                onChange={(e) => setFormData(p => ({ ...p, year: e.target.value.replace(/\D/g, '') }))}
                                                placeholder={String(getCurrentVehicleYear())}
                                                className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                            />
                                        </div>

                                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5 col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Plate Number</label>
                                            <input 
                                                value={formData.number}
                                                onChange={(e) => setFormData(p => ({ ...p, number: normalizeVehicleNumber(e.target.value) }))}
                                                placeholder="DL1RT1234"
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300 uppercase tracking-widest"
                                            />
                                        </div>

                                        <div className="group rounded-[1.8rem] border-2 transition-all p-4 border-slate-50 bg-slate-50 focus-within:border-slate-900/10 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-900/5 col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-70 px-1 mb-1">Exterior Color</label>
                                            <input 
                                                value={formData.color}
                                                onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))}
                                                placeholder="e.g. White, Black"
                                                className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:outline-none focus:ring-0 placeholder:text-slate-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-3xl flex gap-3 mt-4 border border-blue-100">
                    <Info size={18} className="text-blue-500 shrink-0" />
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        Your vehicle information will be visible to passengers for safety and identification.
                    </p>
                </div>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
                        {error}
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
                    <div className="mx-auto max-w-sm">
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleContinue}
                            disabled={loading}
                            className={`group flex h-16 w-full items-center justify-center gap-3 rounded-[1.8rem] text-[15px] font-black tracking-tight transition-all relative overflow-hidden ${
                                (isOwner ? 
                                    (formData.locationId && formData.companyName && formData.companyAddress && formData.city && formData.postalCode && formData.taxNumber) : 
                                    (formData.locationId && formData.vehicleTypeId && formData.make && formData.model && formData.year && formData.number && formData.color))
                                ? 'bg-slate-900 text-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:bg-black' 
                                : 'pointer-events-none bg-slate-200 text-slate-400 shadow-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 uppercase tracking-widest">Save & Continue</span>
                                    <ChevronRight size={18} strokeWidth={3} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StepVehicle;
