import React, { useEffect, useState } from 'react';
import { 
    ArrowLeft, 
    Car, 
    ChevronRight, 
    MapPin, 
    Zap, 
    Package,
    ShieldCheck,
    Info
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getStoredDriverRegistrationSession,
    getDriverServiceLocations,
    saveDriverRegistrationSession,
    saveDriverVehicle,
    getDriverVehicleTypes,
} from '../../services/registrationService';

const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
const getCurrentVehicleYear = () => new Date().getFullYear();
const normalizeVehicleNumber = (value = '') => String(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
const normalizePostalCode = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);


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
        registerFor: session.registerFor || 'taxi',
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
                    setError('Vehicle number must be in this format: PP09KK1234');
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
        { id: 'taxi', label: 'Taxi Only', icon: <Car size={18} />, color: 'emerald' },
        { id: 'delivery', label: 'Delivery Only', icon: <Package size={18} />, color: 'amber' },
        { id: 'both', label: 'Both Services', icon: <Zap size={18} />, color: 'indigo' }
    ];

    return (
        <div 
            className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none overflow-x-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            <main className="mx-auto max-w-sm space-y-6">
                <header className="space-y-5">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-transform active:scale-95"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="rounded-full border border-[#dcc9ab] bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#8a6a3d] uppercase">
                            Step 3 of 4
                        </div>
                    </div>

                    <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                            <Car size={18} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                                {isOwner ? 'Fleet management' : 'Vehicle registration'}
                            </p>
                            <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                                {isOwner ? 'Company Profile' : 'Vehicle details'}
                            </h1>
                            <p className="max-w-[28ch] text-sm leading-6 text-slate-600">
                                {isOwner ? 'Setup your business profile to start managing your fleet.' : 'Tell us about the vehicle you\'ll be using for your services.'}
                            </p>
                        </div>
                    </section>
                </header>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
                        {error}
                    </div>
                )}

                <div className="space-y-5">
                    {!isOwner && (
                        <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <div className="space-y-1 px-1">
                                <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950">Service category</h2>
                                <p className="text-sm text-slate-500">What would you like to provide?</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                                {registerTypes.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setFormData(p => ({ ...p, registerFor: item.id }))}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                            formData.registerFor === item.id 
                                            ? 'bg-slate-950 border-slate-950 text-white shadow-lg' 
                                            : 'bg-[#fcfcfb] border-slate-100 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.registerFor === item.id ? 'bg-white/20' : 'bg-white shadow-sm text-slate-400'}`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className="block text-[14px] font-semibold leading-none">{item.label}</span>
                                        </div>
                                        {formData.registerFor === item.id && (
                                            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                                <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                            <div className="flex items-start gap-3.5">
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                                    <MapPin size={18} />
                                </div>
                                <div className="flex-1 space-y-1.5 overflow-hidden">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">Operating City</label>
                                    <select 
                                        value={formData.locationId}
                                        onChange={(e) => setFormData(p => ({ ...p, locationId: e.target.value, vehicleTypeId: '' }))}
                                        disabled={locationsLoading || locations.length === 0}
                                        className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="">{locationsLoading ? 'Loading service locations...' : 'Select your city'}</option>
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
                                <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Company Name</label>
                                    <input 
                                        value={formData.companyName}
                                        onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))}
                                        placeholder="Enter company legal name"
                                        className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Company Address</label>
                                    <input 
                                        value={formData.companyAddress}
                                        onChange={(e) => setFormData(p => ({ ...p, companyAddress: e.target.value }))}
                                        placeholder="Enter street address"
                                        className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3.5">
                                    <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                        <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">City</label>
                                        <input 
                                            value={formData.city}
                                            onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                                            placeholder="City"
                                            className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                        />
                                    </div>
                                    <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                        <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Postal Code</label>
                                        <input 
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData(p => ({ ...p, postalCode: normalizePostalCode(e.target.value) }))}
                                            placeholder="452001"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                    <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Tax Number (GST/VAT)</label>
                                    <input 
                                        value={formData.taxNumber}
                                        onChange={(e) => setFormData(p => ({ ...p, taxNumber: e.target.value.toUpperCase() }))}
                                        placeholder="GST/VAT/TAX ID"
                                        className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300 uppercase"
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

                                <div className="space-y-4 pt-1">
                                    <div className="space-y-1 px-1">
                                        <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950">Technical Specs</h2>
                                        <p className="text-sm text-slate-500">Fill in the details from your RC/Permit.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3.5">
                                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white col-span-2">
                                            <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Brand / Make</label>
                                            <input 
                                                value={formData.make}
                                                onChange={(e) => setFormData(p => ({ ...p, make: e.target.value }))}
                                                placeholder="e.g. Maruti Suzuki, Hyundai"
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                            />
                                        </div>

                                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                            <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Model</label>
                                            <input 
                                                value={formData.model}
                                                onChange={(e) => setFormData(p => ({ ...p, model: e.target.value }))}
                                                placeholder="e.g. Swift, Bolt"
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                            />
                                        </div>

                                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white">
                                            <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Year</label>
                                            <input 
                                                type="tel"
                                                maxLength={4}
                                                value={formData.year}
                                                onChange={(e) => setFormData(p => ({ ...p, year: e.target.value.replace(/\D/g, '') }))}
                                                placeholder={String(getCurrentVehicleYear())}
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
                                            />
                                        </div>

                                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white col-span-2">
                                            <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Plate Number</label>
                                            <input 
                                                value={formData.number}
                                                onChange={(e) => setFormData(p => ({ ...p, number: normalizeVehicleNumber(e.target.value) }))}
                                                placeholder="MH12AB1234"
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300 uppercase tracking-widest"
                                            />
                                        </div>

                                        <div className="rounded-[24px] border border-slate-200 bg-[#fcfcfb] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all focus-within:border-[#c59d66] focus-within:bg-white col-span-2">
                                            <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600 mb-1.5">Exterior Color</label>
                                            <input 
                                                value={formData.color}
                                                onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))}
                                                placeholder="e.g. White, Silver, Black"
                                                className="w-full bg-transparent border-none p-0 text-[16px] font-semibold text-slate-950 focus:outline-none focus:ring-0 placeholder:text-slate-300"
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

                <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
                    <div className="mx-auto max-w-sm">
                        <button 
                            onClick={handleContinue}
                            disabled={loading}
                            className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                                (isOwner ? 
                                    (formData.locationId && formData.companyName && formData.companyAddress && formData.city && formData.postalCode && formData.taxNumber) : 
                                    (formData.locationId && formData.vehicleTypeId && formData.make && formData.model && formData.year && formData.number && formData.color))
                                ? 'bg-slate-950 text-white hover:bg-slate-900' 
                                : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                            }`}
                        >
                            {loading ? 'Saving Details...' : 'Save & Continue'} 
                            {!loading && <ChevronRight size={17} strokeWidth={2.8} />}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StepVehicle;
