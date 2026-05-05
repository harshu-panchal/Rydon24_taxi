import React, { useEffect, useMemo, useState } from 'react';
import { 
    ArrowLeft, 
    Camera, 
    CheckCircle2, 
    FileText, 
    ImagePlus,
    ShieldCheck, 
    AlertCircle,
    ChevronRight,
    UploadCloud
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  clearDriverRegistrationSession,
  completeDriverOnboarding,
  getDriverDocumentTemplates,
  getStoredDriverRegistrationSession,
  persistDriverAuthSession,
  saveDriverDocuments,
  saveDriverRegistrationSession,
} from '../../services/registrationService';
import {
  flattenDriverDocumentFields,
  getDocumentPreviewUrl,
  normalizeDriverDocumentTemplates,
} from '../../utils/documentTemplates';

const unwrap = (response) => response?.data?.data || response?.data || response;

const normalizeDocument = (doc) => {
  if (!doc) {
    return null;
  }

  if (typeof doc === 'string') {
    return {
      previewUrl: doc,
      secureUrl: doc,
      uploaded: true,
    };
  }

  return {
    ...doc,
    previewUrl: getDocumentPreviewUrl(doc),
    uploaded: doc.uploaded ?? Boolean(getDocumentPreviewUrl(doc)),
    identifyNumber: String(doc.identifyNumber || doc.identify_number || doc.documentNumber || doc.document_number || '').trim(),
    expiryDate: String(doc.expiryDate || doc.expiry_date || doc.expiry || doc.expiresAt || '').trim(),
  };
};

const getDocumentIdentifyValue = (doc) =>
  String(doc?.identifyNumber || doc?.identify_number || doc?.documentNumber || doc?.document_number || '').trim();

const getDocumentExpiryValue = (doc) =>
  String(doc?.expiryDate || doc?.expiry_date || doc?.expiry || doc?.expiresAt || '').trim();

const buildTemplateMetaState = (templates = [], documents = {}) =>
  Object.fromEntries(
    templates.map((template) => {
      const templateFields = Array.isArray(template.fields) ? template.fields : [];
      const firstDocument = templateFields
        .map((field) => normalizeDocument(documents?.[field.key]))
        .find(Boolean);

      return [
        template.id,
        {
          identifyNumber: getDocumentIdentifyValue(firstDocument),
          expiryDate: getDocumentExpiryValue(firstDocument),
        },
      ];
    }),
  );

const formatMetaLabel = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const normalizeSignupRole = (role) =>
  String(role || 'driver').toLowerCase() === 'owner' ? 'owner' : 'driver';

const matchesDocumentRole = (accountType, role) => {
  const rawAccountType = String(accountType || '').trim().toLowerCase();
  const normalizedAccountType = rawAccountType || 'individual';
  const normalizedRole = normalizeSignupRole(role);

  if (normalizedAccountType === 'both') {
    return true;
  }

  if (normalizedRole === 'owner') {
    if (!rawAccountType) {
      return true;
    }

    return ['fleet_drivers', 'owner', 'owners', 'fleet_owner', 'fleet_owners'].includes(normalizedAccountType);
  }

  return normalizedAccountType === 'individual';
};

const isImageLikeFile = (file) => {
  if (!file) {
    return false;
  }

  if (String(file.type || '').startsWith('image/')) {
    return true;
  }

  return /\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i.test(String(file.name || ''));
};

const inferImageMeta = (file, dataUrl) => {
  const mimeMatch = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  const mimeType = String(file?.type || mimeMatch?.[1] || 'image/jpeg').toLowerCase();
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const originalName = String(file?.name || '').trim();

  return {
    mimeType,
    fileName: originalName || `capture-${Date.now()}.${extension}`,
  };
};

const StepDocuments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = {
    ...getStoredDriverRegistrationSession(),
    ...(location.state || {}),
  };
  const normalizedRole = normalizeSignupRole(session.role);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [docs, setDocs] = useState(() =>
    Object.fromEntries(
      Object.entries(session.documents || {}).map(([key, value]) => [key, normalizeDocument(value)]),
    ),
  );
  const [documentMeta, setDocumentMeta] = useState({});
  const [uploading, setUploading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);

      try {
        const response = await getDriverDocumentTemplates(normalizedRole);
        const results = response?.data?.data?.results || response?.data?.results || [];
        setTemplates(normalizeDriverDocumentTemplates(results));
      } catch {
        setTemplates(normalizeDriverDocumentTemplates([]));
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadTemplates();
  }, [normalizedRole]);

  const documentTemplates = useMemo(
    () =>
      normalizeDriverDocumentTemplates(templates).filter((template) =>
        matchesDocumentRole(template.account_type, normalizedRole),
      ),
    [normalizedRole, templates],
  );
  const uploadFields = useMemo(
    () => flattenDriverDocumentFields(documentTemplates),
    [documentTemplates],
  );
  const requiredUploadFields = useMemo(
    () => uploadFields.filter((item) => Boolean(item.isRequired)),
    [uploadFields],
  );
  const templateFieldMap = useMemo(
    () =>
      Object.fromEntries(
        documentTemplates.map((template) => [template.id, Array.isArray(template.fields) ? template.fields : []]),
      ),
    [documentTemplates],
  );

  useEffect(() => {
    setDocumentMeta((current) => ({
      ...buildTemplateMetaState(documentTemplates, docs),
      ...current,
    }));
  }, [documentTemplates, docs]);

  const applyTemplateMetaToDocuments = (templateId, templateDocuments, metaOverride = null) => {
    const meta = metaOverride || documentMeta[templateId] || { identifyNumber: '', expiryDate: '' };
    const identifyNumber = String(meta.identifyNumber || '').trim();
    const expiryDate = String(meta.expiryDate || '').trim();

    return Object.fromEntries(
      Object.entries(templateDocuments).map(([docKey, docValue]) => [
        docKey,
        docValue
          ? {
              ...docValue,
              identifyNumber,
              identify_number: identifyNumber,
              documentNumber: identifyNumber,
              document_number: identifyNumber,
              expiryDate,
              expiry_date: expiryDate,
            }
          : docValue,
      ]),
    );
  };

  const handleMetaChange = (templateId, fieldName, nextValue) => {
    const nextMeta = {
      ...(documentMeta[templateId] || {}),
      [fieldName]: nextValue,
    };

    setDocumentMeta((current) => ({
      ...current,
      [templateId]: nextMeta,
    }));

    const templateFields = templateFieldMap[templateId] || [];
    if (templateFields.length === 0) {
      return;
    }

    setDocs((current) => {
      const nextDocuments = { ...current };
      for (const field of templateFields) {
        if (!nextDocuments[field.key]) {
          continue;
        }

        nextDocuments[field.key] = applyTemplateMetaToDocuments(
          templateId,
          { [field.key]: nextDocuments[field.key] },
          nextMeta,
        )[field.key];
      }
      return nextDocuments;
    });
  };

  const handleFileChange = async (templateId, key, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploading(key);
    setError('');

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!String(dataUrl || '').startsWith('data:image/')) {
        throw new Error('Please upload an image file');
      }

      const { fileName, mimeType } = inferImageMeta(file, dataUrl);

      setDocs((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          previewUrl: dataUrl,
          fileName,
          mimeType,
          uploaded: false,
          uploading: true,
        },
      }));

      const response = await saveDriverDocuments({
        registrationId: session.registrationId,
        phone: session.phone,
        documents: {
          [key]: {
            dataUrl,
            fileName,
            mimeType,
            identifyNumber: documentMeta[templateId]?.identifyNumber || '',
            expiryDate: documentMeta[templateId]?.expiryDate || '',
          },
        },
      });
      const payload = unwrap(response);

      const uploadedDoc = payload?.documents?.[key] || payload?.session?.documents?.[key];
      const nextDoc = normalizeDocument(uploadedDoc) || {
        previewUrl: dataUrl,
        secureUrl: dataUrl,
        fileName,
        mimeType,
        uploaded: true,
      };
      const nextDocWithMeta = applyTemplateMetaToDocuments(templateId, { [key]: nextDoc })[key];

      setDocs((prev) => ({
        ...prev,
        [key]: nextDocWithMeta,
      }));

      const storedSession = getStoredDriverRegistrationSession();
      saveDriverRegistrationSession({
        ...storedSession,
        ...session,
        documents: {
          ...(storedSession.documents || {}),
          [key]: nextDocWithMeta,
        },
      });
    } catch (uploadError) {
      setError(uploadError?.message || 'Unable to upload document');
      setDocs((prev) => ({
        ...prev,
        [key]: normalizeDocument(session.documents?.[key]),
      }));
    } finally {
      setUploading(null);
    }
  };

  const isComplete =
    requiredUploadFields.every((item) => Boolean(docs[item.key]?.uploaded || docs[item.key]?.secureUrl)) &&
    documentTemplates.every((template) => {
      if (!template.is_required) {
        return true;
      }

      const meta = documentMeta[template.id] || {};
      const hasIdentifyNumber = !template.has_identify_number || Boolean(String(meta.identifyNumber || '').trim());
      const hasExpiryDate = !template.has_expiry_date || Boolean(String(meta.expiryDate || '').trim());
      return hasIdentifyNumber && hasExpiryDate;
    }) &&
    !uploading &&
    !templatesLoading;

  const handleSubmit = async () => {
    if (!isComplete) {
      setError(uploading ? 'Please wait for the current upload to finish' : 'Please upload every required document image');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submittedDocuments = Object.fromEntries(
        Object.entries(docs).filter(([, value]) => Boolean(value?.uploaded || value?.secureUrl)),
      );
      const submittedDocumentsWithMeta = { ...submittedDocuments };

      for (const template of documentTemplates) {
        const templateFields = Array.isArray(template.fields) ? template.fields : [];
        const templateDocuments = Object.fromEntries(
          templateFields
            .filter((field) => submittedDocumentsWithMeta[field.key])
            .map((field) => [field.key, submittedDocumentsWithMeta[field.key]]),
        );

        if (Object.keys(templateDocuments).length === 0) {
          continue;
        }

        Object.assign(
          submittedDocumentsWithMeta,
          applyTemplateMetaToDocuments(template.id, templateDocuments),
        );
      }

      const completeResponse = await completeDriverOnboarding({
        registrationId: session.registrationId,
        phone: session.phone,
        documents: submittedDocumentsWithMeta,
      });
      const payload = unwrap(completeResponse);

      const token = payload?.token;
      if (token) {
        const normalizedRole =
          String(session.role || 'driver').toLowerCase() === 'owner' ? 'owner' : 'driver';
        persistDriverAuthSession({ token, role: normalizedRole });
      }

      saveDriverRegistrationSession({
        ...session,
        documents: docs,
        completedRegistration: payload || null,
      });
      clearDriverRegistrationSession();

      navigate('/taxi/driver/registration-status', {
        state: {
          ...session,
          documents: docs,
          completedRegistration: payload || null,
        },
      });
    } catch (submitError) {
      setError(submitError?.message || 'Unable to complete registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
        className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none overflow-x-hidden"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <main className="mx-auto max-w-sm space-y-6">
        <header className="space-y-5">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/taxi/driver/step-vehicle', { state: session })}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-transform active:scale-95"
                >
                    <ArrowLeft size={18} strokeWidth={2.5} />
                </button>
                <div className="rounded-full border border-[#dcc9ab] bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#8a6a3d] uppercase">
                    Step 4 of 4
                </div>
            </div>

            <section className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_22px_60px_rgba(148,116,70,0.12)] backdrop-blur-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e4cd] text-[#8a5a22]">
                    <ShieldCheck size={18} />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                        Identity verification
                    </p>
                    <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                        KYC Vault
                    </h1>
                    <p className="max-w-[28ch] text-sm leading-6 text-slate-600">
                        Please upload clear photos of the required documents to verify your identity.
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
          {templatesLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                <FileText size={20} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Loading checklist...</p>
            </div>
          ) : (
            documentTemplates.map((template) => (
              <section key={template.id} className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{template.name}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                           {template.fields.length > 1 ? 'Multiple Sides' : 'Single Document'}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${template.is_required ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {template.is_required ? 'Mandatory' : 'Optional'}
                        </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 border border-slate-100">
                    {template.account_type || 'individual'}
                  </div>
                </div>

                <div className={`grid gap-3 ${template.fields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {template.fields.map((field) => {
                    const document = docs[field.key];
                    const isUploading = uploading === field.key;
                    const isRequired = Boolean(field.required ?? field.isRequired);

                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-[11px] font-semibold text-slate-500 ml-1">{field.label}</label>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isRequired ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {isRequired ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        <div
                            className={`relative min-h-[140px] rounded-2xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center gap-2 ${
                                document?.previewUrl
                                    ? 'border-emerald-500/20 bg-emerald-50/10'
                                    : 'border-dashed border-slate-200 bg-[#fcfcfb] hover:border-slate-300'
                            }`}
                        >
                            {isUploading ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uploading</span>
                                </div>
                            ) : document?.previewUrl ? (
                                <>
                                    <img src={document.previewUrl} alt={field.label} className="absolute inset-0 h-full w-full object-cover" />
                                    <div className="absolute inset-0 bg-black/10" />
                                    <div className="absolute bottom-2 right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white">
                                        <CheckCircle2 size={14} strokeWidth={3} />
                                    </div>
                                    <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/20">
                                        <Camera size={10} className="text-white" />
                                        <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Retake</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center shadow-sm border border-slate-100">
                                        <UploadCloud size={18} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Tap to upload</p>
                                    </div>
                                    <div className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-slate-100/50 flex items-center justify-center">
                                        <Camera size={10} className="text-slate-400" />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className={`relative flex h-11 items-center justify-center gap-2 text-center rounded-2xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                            isUploading
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'cursor-pointer border-slate-200 bg-white text-slate-700 active:scale-[0.99]'
                          }`}>
                            <ImagePlus size={14} />
                            Gallery
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploading}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              aria-label={`Upload ${field.label} from gallery`}
                              onChange={(event) => handleFileChange(template.id, field.key, event)}
                            />
                          </label>
                          <label className={`relative flex h-11 items-center justify-center gap-2 text-center rounded-2xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                            isUploading
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'cursor-pointer border-slate-900 bg-slate-950 text-white active:scale-[0.99]'
                          }`}>
                            <Camera size={14} />
                            Camera
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={isUploading}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              aria-label={`Capture ${field.label} from camera`}
                              onChange={(event) => handleFileChange(template.id, field.key, event)}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(template.has_identify_number || template.has_expiry_date) ? (
                  <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-2">
                    {template.has_identify_number ? (
                      <div className="space-y-1.5">
                        <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">
                          {formatMetaLabel(template.identify_number_key) || `${template.name} number`}
                        </label>
                        <input
                          type="text"
                          value={documentMeta[template.id]?.identifyNumber || ''}
                          onChange={(event) => handleMetaChange(template.id, 'identifyNumber', event.target.value.trim().toUpperCase())}
                          placeholder={`Enter ${formatMetaLabel(template.identify_number_key) || 'document number'}`}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-900 outline-none transition-all focus:border-[#c59d66] focus:ring-4 focus:ring-[#c59d66]/10"
                        />
                      </div>
                    ) : null}
                    {template.has_expiry_date ? (
                      <div className="space-y-1.5">
                        <label className="block text-[12px] font-medium tracking-[0.02em] text-slate-600">
                          {template.name} expiry date
                        </label>
                        <input
                          type="date"
                          value={documentMeta[template.id]?.expiryDate || ''}
                          onChange={(event) => handleMetaChange(template.id, 'expiryDate', event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-900 outline-none transition-all focus:border-[#c59d66] focus:ring-4 focus:ring-[#c59d66]/10"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ))
          )}
        </div>

        <div className="bg-amber-50/50 p-4 rounded-3xl flex gap-3 mt-4 border border-amber-100">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <p className="text-xs font-medium text-amber-900 leading-relaxed">
            Choose Gallery or Camera for each document. Ensure all photos are well-lit and all text is clearly readable to avoid rejection.
          </p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
            <div className="mx-auto max-w-sm">
                <button
                    onClick={handleSubmit}
                    disabled={loading || !isComplete}
                    className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                        isComplete
                            ? 'bg-slate-950 text-white hover:bg-slate-900'
                            : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                    }`}
                >
                    {loading ? 'Submitting Vault...' : 'Review & Submit'}
                    {!loading && <ChevronRight size={17} strokeWidth={2.8} />}
                </button>
            </div>
        </div>
      </main>
    </div>
  );
};

export default StepDocuments;
