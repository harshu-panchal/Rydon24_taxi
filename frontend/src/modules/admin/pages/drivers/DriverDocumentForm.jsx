import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors';
const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5';
const selectPlaceholderClass = 'text-gray-400';

const normalizeBooleanLike = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return Boolean(value);
};

const initialForm = {
  name: '',
  account_type: '',
  has_expiry_date: '',
  image_type: '',
  has_identify_number: '',
  identify_number_key: '',
  is_editable: false,
  is_required: false,
  active: true,
};

const accountTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'fleet_drivers', label: 'Fleet Drivers' },
  { value: 'both', label: 'Both' },
];

const yesNoOptions = [
  { value: '0', label: 'No' },
  { value: '1', label: 'Yes' },
];

const imageTypeOptions = [
  { value: 'front_back', label: 'Front & Back' },
  { value: 'image', label: 'Single Image' },
  { value: 'front', label: 'Front Only' },
  { value: 'back', label: 'Back Only' },
];

const getOptionLabel = (options, value, fallback = 'Not selected') =>
  options.find((option) => option.value === value)?.label || fallback;

const toPayload = (formData) => ({
  name: String(formData.name || '').trim(),
  account_type: formData.account_type,
  has_expiry_date: formData.has_expiry_date === '1',
  image_type: formData.image_type,
  has_identify_number: formData.has_identify_number === '1',
  identify_number_key:
    formData.has_identify_number === '1' ? String(formData.identify_number_key || '').trim() : '',
  is_editable: Boolean(formData.is_editable),
  is_required: Boolean(formData.is_required),
  active: Boolean(formData.active),
});

const fromResponse = (payload = {}) => ({
  name: payload.name || '',
  account_type: payload.account_type || '',
  has_expiry_date:
    payload.has_expiry_date === true ? '1' : payload.has_expiry_date === false ? '0' : '',
  image_type: payload.image_type || '',
  has_identify_number:
    payload.has_identify_number === true ? '1' : payload.has_identify_number === false ? '0' : '',
  identify_number_key: payload.identify_number_key || '',
  is_editable: normalizeBooleanLike(payload.is_editable, false),
  is_required: normalizeBooleanLike(payload.is_required, false),
  active: normalizeBooleanLike(payload.active, true),
});

const DriverDocumentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const loadDocument = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await adminService.getDriverNeededDocument(id);
        const payload = response?.data?.data || response?.data || {};
        setFormData(fromResponse(payload));
      } catch (err) {
        setError(err?.message || 'Unable to load driver document');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id, isEditMode]);

  const handleChange = (key, value) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
      ...(key === 'has_identify_number' && value !== '1' ? { identify_number_key: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.account_type ||
      formData.has_expiry_date === '' ||
      !formData.image_type ||
      formData.has_identify_number === '' ||
      (formData.has_identify_number === '1' && !formData.identify_number_key.trim())
    ) {
      setError('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = toPayload(formData);

      if (isEditMode) {
        await adminService.updateDriverNeededDocument(id, payload);
      } else {
        await adminService.createDriverNeededDocument(payload);
      }

      navigate('/admin/drivers/documents');
    } catch (err) {
      setError(err?.message || 'Unable to save driver document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">Loading document configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Driver Needed Documents</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">{isEditMode ? 'Edit' : 'Create'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{isEditMode ? 'Edit' : 'Create'}</h1>
          <button
            type="button"
            onClick={() => navigate('/admin/drivers/documents')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Document Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="Enter Name"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Account Type *</label>
            <select
              value={formData.account_type}
              onChange={(event) => handleChange('account_type', event.target.value)}
              className={`${inputClass} ${!formData.account_type ? selectPlaceholderClass : ''}`}
              required
            >
              <option value="" disabled>Select account type</option>
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Has Expiry Date *</label>
            <select
              value={formData.has_expiry_date}
              onChange={(event) => handleChange('has_expiry_date', event.target.value)}
              className={`${inputClass} ${formData.has_expiry_date === '' ? selectPlaceholderClass : ''}`}
              required
            >
              <option value="" disabled>Select expiry requirement</option>
              {yesNoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Image Type *</label>
            <select
              value={formData.image_type}
              onChange={(event) => handleChange('image_type', event.target.value)}
              className={`${inputClass} ${!formData.image_type ? selectPlaceholderClass : ''}`}
              required
            >
              <option value="" disabled>Select image type</option>
              {imageTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Has Identify Number *</label>
            <select
              value={formData.has_identify_number}
              onChange={(event) => handleChange('has_identify_number', event.target.value)}
              className={`${inputClass} ${formData.has_identify_number === '' ? selectPlaceholderClass : ''}`}
              required
            >
              <option value="" disabled>Select identity number requirement</option>
              {yesNoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formData.has_identify_number === '1' ? (
            <div>
              <label className={labelClass}>Identify Number Key</label>
              <input
                type="text"
                value={formData.identify_number_key}
                onChange={(event) => handleChange('identify_number_key', event.target.value)}
                placeholder="Enter Identify Number Key"
                className={inputClass}
              />
            </div>
          ) : (
            <div />
          )}

          <div className="md:col-span-2 space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                Account: {getOptionLabel(accountTypeOptions, formData.account_type)}
              </span>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                Images: {getOptionLabel(imageTypeOptions, formData.image_type)}
              </span>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                Expiry: {getOptionLabel(yesNoOptions, formData.has_expiry_date)}
              </span>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                ID Number: {getOptionLabel(yesNoOptions, formData.has_identify_number)}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                formData.is_required
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {formData.is_required ? 'Required In Driver Signup' : 'Optional In Driver Signup'}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                formData.active
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {formData.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-8 pb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_editable}
                  onChange={(event) => handleChange('is_editable', event.target.checked)}
                />
                <span className="text-sm text-gray-700">Is Editable?</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(event) => handleChange('is_required', event.target.checked)}
                />
                <span className="text-sm font-semibold text-gray-800">Is Required?</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(event) => handleChange('active', event.target.checked)}
                />
                <span className="text-sm text-gray-700">Active?</span>
              </label>
            </div>

            <p className="text-xs text-gray-500">
              When <strong>Is Required?</strong> is checked, this document is marked mandatory in the driver signup flow and must be completed before registration can finish.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DriverDocumentForm;
