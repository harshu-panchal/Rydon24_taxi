import React, { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Menu, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTaxiTransportTypes } from '../../../../shared/hooks/useTaxiTransportTypes';

import { adminService } from '../../services/adminService';

const inputClass =
  'h-[46px] w-full rounded border border-gray-300 bg-white px-4 text-sm text-gray-950 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

const labelClass = 'mb-2 block text-sm font-semibold text-gray-950';
const selectClass = `${inputClass} appearance-none`;

const getOptionLabel = (item) =>
  item?.service_location_name ||
  item?.name ||
  item?.vehicle_type ||
  item?.owner_name ||
  item?.company_name ||
  'Option';

const normalizeVehicleOptions = (payload) => {
  const results = Array.isArray(payload)
    ? payload
    : payload?.results || payload?.data?.results || payload?.data || [];

  return (Array.isArray(results) ? results : [])
    .map((item) => ({
      id: String(item?._id || item?.id || item?.vehicle_type || item?.name || ''),
      value: String(item?.vehicle_type || item?.name || item?.slug || item?._id || '').toLowerCase(),
      label: item?.vehicle_type || item?.name || 'Vehicle',
      transportType: String(item?.transport_type || '').toLowerCase(),
      raw: item,
    }))
    .filter((item) => item.id && item.value);
};

const initialFormData = {
  service_location_id: '',
  name: '',
  mobile: '',
  gender: '',
  email: '',
  password: '',
  password_confirmation: '',
  transport_type: 'taxi',
  vehicle_type: '',
  vehicle_type_id: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_color: '',
  vehicle_number: '',
  country: '',
  profile_picture: '',
};

const CreateDriver = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ ...initialFormData, transport_type: '' });
  const [areas, setAreas] = useState([]);
  const { transportTypes } = useTaxiTransportTypes();
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      setError('');

      try {
        const locationsResponse = await adminService.getServiceLocations();

        const nextAreas = Array.isArray(locationsResponse?.data)
          ? locationsResponse.data
          : locationsResponse?.data?.results || [];

        setAreas(nextAreas);
      } catch (apiError) {
        setError(apiError?.message || 'Unable to load create driver form');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchVehicleTypes = async () => {
      if (!formData.service_location_id || !formData.transport_type) {
        setVehicleTypes([]);
        setFormData((current) => ({
          ...current,
          vehicle_type: '',
          vehicle_type_id: '',
        }));
        return;
      }

      setIsLoadingVehicles(true);

      try {
        let options = [];

        try {
          const locationResponse = await adminService.getLocationVehicleTypes(
            formData.service_location_id,
            formData.transport_type,
          );
          options = normalizeVehicleOptions(locationResponse);
        } catch {
          options = [];
        }

        if (options.length === 0) {
          const catalogResponse = await adminService.getVehicleTypes(
            formData.transport_type === 'both' ? undefined : formData.transport_type,
          );
          options = normalizeVehicleOptions(catalogResponse).filter((item) => {
            if (!item.transportType) {
              return true;
            }

            if (formData.transport_type === 'both') {
              return ['taxi', 'delivery', 'both'].includes(item.transportType);
            }

            return item.transportType === formData.transport_type || item.transportType === 'both';
          });
        }

        setVehicleTypes(options);

        setFormData((current) => {
          const selectedStillExists = options.some(
            (item) =>
              item.id === current.vehicle_type_id ||
              item.value === current.vehicle_type,
          );

          if (selectedStillExists) {
            return current;
          }

          return {
            ...current,
            vehicle_type: '',
            vehicle_type_id: '',
          };
        });
      } catch (apiError) {
        setVehicleTypes([]);
        setError(apiError?.message || 'Unable to load vehicle types');
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    fetchVehicleTypes();
  }, [formData.service_location_id, formData.transport_type]);

  const setField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleAreaChange = (event) => {
    const areaId = event.target.value;
    const selectedArea = areas.find((area) => String(area._id) === String(areaId));

    setFormData((current) => ({
      ...current,
      service_location_id: areaId,
      country: selectedArea?.country?._id || selectedArea?.country || current.country,
    }));
  };

  const handleTransportChange = (event) => {
    const transportType = event.target.value;

    setFormData((current) => ({
      ...current,
      transport_type: transportType,
      vehicle_type: '',
      vehicle_type_id: '',
    }));
  };

  const handleVehicleTypeChange = (event) => {
    const selectedId = event.target.value;
    const selectedVehicle = vehicleTypes.find((item) => item.id === selectedId);

    setFormData((current) => ({
      ...current,
      vehicle_type_id: selectedId,
      vehicle_type: selectedVehicle?.value || '',
    }));
  };

  const handleProfileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      setField('profile_picture', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError('');

    if (formData.password !== formData.password_confirmation) {
      setError('Password and confirm password must match');
      return;
    }

    setSubmitting(true);

    try {
      const response = await adminService.createDriver({
        name: formData.name,
        mobile: formData.mobile,
        phone: formData.mobile,
        email: formData.email,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        gender: formData.gender.toLowerCase(),
        service_location_id: formData.service_location_id,
        country: formData.country,
        profile_picture: formData.profile_picture,
        transport_type: formData.transport_type,
        vehicle_type: formData.vehicle_type,
        vehicle_type_id: formData.vehicle_type_id || undefined,
        vehicle_make: formData.vehicle_make,
        vehicle_model: formData.vehicle_model,
        vehicle_color: formData.vehicle_color,
        vehicle_number: formData.vehicle_number,
        approve: true,
        status: 'approved',
      });

      if (response?.success) {
        navigate('/admin/drivers');
        return;
      }

      setError(response?.message || 'Failed to create driver');
    } catch (apiError) {
      setError(apiError?.message || 'Failed to create driver');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 size={34} className="animate-spin text-teal-500" />
        <p className="text-sm font-semibold">Preparing driver form...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-950">
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="text-xl font-bold uppercase tracking-wide text-slate-700">Create</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <button
            type="button"
            onClick={() => navigate('/admin/drivers')}
            className="text-gray-950 transition-colors hover:text-indigo-600"
          >
            Approved Drivers
          </button>
          <ChevronRight size={14} />
          <span>Create</span>
        </div>
      </div>

      <div className="relative px-5">
        <form onSubmit={handleSubmit} className="rounded border border-gray-200 bg-white px-4 py-7 shadow-sm md:px-5">
          {error ? (
            <div className="mb-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className={labelClass}>
                Select Area <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.service_location_id}
                onChange={handleAreaChange}
                className={selectClass}
              >
                <option value="">Select</option>
                {areas.map((area) => (
                  <option key={area._id} value={area._id}>
                    {getOptionLabel(area)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="Enter Name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Mobile <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-0">
                <div className="flex h-[46px] min-w-[90px] items-center justify-center rounded-l border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-950">
                  +91
                </div>
                <input
                  required
                  type="tel"
                  value={formData.mobile}
                  onChange={(event) => setField('mobile', event.target.value)}
                  placeholder="Enter Number"
                  className="h-[46px] w-full rounded-r border border-gray-300 bg-white px-4 text-sm text-gray-950 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Select Gender <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.gender}
                onChange={(event) => setField('gender', event.target.value)}
                className={selectClass}
              >
                <option value="">Choose Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="Enter Email"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Password <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="password"
                value={formData.password}
                onChange={(event) => setField('password', event.target.value)}
                placeholder="Enter Password"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="password"
                value={formData.password_confirmation}
                onChange={(event) => setField('password_confirmation', event.target.value)}
                placeholder="Confirm Password"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Transport Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.transport_type}
                onChange={handleTransportChange}
                className={selectClass}
              >
                <option value="">Select</option>
                {transportTypes.map((type) => (
                  <option key={type.id || type._id} value={type.name}>
                    {type.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.vehicle_type_id}
                onChange={handleVehicleTypeChange}
                className={selectClass}
                disabled={!formData.service_location_id || isLoadingVehicles}
              >
                <option value="">{isLoadingVehicles ? 'Loading...' : 'Select'}</option>
                {vehicleTypes.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Make <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.vehicle_make}
                onChange={(event) => setField('vehicle_make', event.target.value)}
                placeholder="Enter Vehicle Make"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Model <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.vehicle_model}
                onChange={(event) => setField('vehicle_model', event.target.value)}
                placeholder="Enter Vehicle Model"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Color <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.vehicle_color}
                onChange={(event) => setField('vehicle_color', event.target.value)}
                placeholder="Enter Vehicle Color"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Number <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.vehicle_number}
                onChange={(event) => setField('vehicle_number', event.target.value)}
                placeholder="Enter Vehicle Number"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4 max-w-md">
            <label className={labelClass}>Upload Image</label>
            <label className="flex h-80 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-gray-300 bg-white text-sm font-semibold text-slate-500 transition-colors hover:border-teal-400 hover:text-teal-500">
              <Upload size={26} className="mb-3" />
              <span>{profileName || 'Upload Image'}</span>
              <input type="file" accept="image/*" onChange={handleProfileChange} className="hidden" />
            </label>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded bg-indigo-600 px-8 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Save
                </span>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>

        <button
          type="button"
          className="absolute right-2 top-48 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-white shadow-xl transition-colors hover:bg-teal-600"
        >
          <Menu size={24} />
        </button>
      </div>
    </div>
  );
};

export default CreateDriver;
