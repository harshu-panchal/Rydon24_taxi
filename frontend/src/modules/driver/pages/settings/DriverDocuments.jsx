import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Camera, CheckCircle2, Eye, FileText, Loader2, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentDriver, getDriverDocumentTemplates, updateDriverDocument } from '../../services/registrationService';
import { useImageUpload } from '../../../../shared/hooks/useImageUpload';
import {
  flattenDriverDocumentFields,
  getDocumentPreviewUrl,
  normalizeDriverDocumentTemplates,
} from '../../utils/documentTemplates';

const formatDate = (value) => {
  if (!value) return 'Uploaded';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const DriverDocuments = () => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [driver, setDriver] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState('');
  const uploadingDocumentKeyRef = useRef('');

  const {
    uploading: imageUploading,
    handleFileChange: onDocumentImageChange,
  } = useImageUpload({
    folder: 'driver-documents',
    onSuccess: async (url) => {
      const activeDocumentKey = uploadingDocumentKeyRef.current;

      if (!activeDocumentKey) {
        return;
      }

      const updatedDocument = {
        key: activeDocumentKey,
        fileName: activeDocumentKey,
        previewUrl: url,
        secureUrl: url,
        uploaded: true,
        uploadedAt: new Date().toISOString(),
      };

      try {
        const response = await updateDriverDocument(activeDocumentKey, updatedDocument);
        const documents = response?.data?.documents || {
          ...(driver?.documents || {}),
          [activeDocumentKey]: updatedDocument,
        };
        setDriver((prev) => ({ ...(prev || {}), documents }));
      } catch (requestError) {
        setError(requestError?.message || 'Unable to update document image');
      } finally {
        uploadingDocumentKeyRef.current = '';
        setUploadingDocumentKey('');
      }
    },
    onError: () => {
      uploadingDocumentKeyRef.current = '';
      setUploadingDocumentKey('');
    },
  });

  const loadDriver = async () => {
    setIsSyncing(true);
    setError('');

    try {
      const [driverResponse, templateResponse] = await Promise.all([
        getCurrentDriver(),
        getDriverDocumentTemplates(),
      ]);

      setDriver(driverResponse?.data || null);
      setTemplates(normalizeDriverDocumentTemplates(templateResponse?.data?.data?.results || templateResponse?.data?.results || []));
    } catch (err) {
      setError(err?.message || 'Unable to load driver documents');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadDriver();
  }, []);

  const docs = useMemo(() => {
    const documents = driver?.documents || {};

    return flattenDriverDocumentFields(templates).map((field, index) => {
      const doc = documents[field.key] || null;
      const previewUrl = getDocumentPreviewUrl(doc);
      const uploadedAt = doc?.uploadedAt || doc?.createdAt || doc?.updatedAt || '';
      const hasDoc = Boolean(previewUrl || doc);

      return {
        id: field.key,
        name: field.label,
        templateName: field.templateName,
        status: hasDoc ? 'Uploaded' : 'Missing',
        date: hasDoc ? formatDate(uploadedAt) : 'Not uploaded',
        previewUrl,
        fileName: doc?.fileName || field.label,
        uploadedAt,
        order: index,
      };
    });
  }, [driver?.documents, templates]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans p-6 pt-10 pb-32 overflow-x-hidden">
      <header className="flex items-center gap-4 mb-10 text-slate-900 uppercase">
        <button onClick={() => navigate('/taxi/driver/profile')} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-black tracking-tight tracking-tighter uppercase underline decoration-emerald-500/20">KYC Portfolio</h1>
      </header>

      <AnimatePresence>
        {selectedDoc ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-7 rounded-[2.5rem] shadow-2xl space-y-5 max-w-xs w-full text-center">
              <div className="flex justify-between items-center mb-2">
                <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                  <FileText size={20} />
                </div>
                <button onClick={() => setSelectedDoc(null)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tight">{selectedDoc.name}</h4>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selectedDoc.templateName}</p>
              </div>
              <div className="aspect-[3/2] bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 shadow-inner group overflow-hidden">
                {selectedDoc.previewUrl ? (
                  <img src={selectedDoc.previewUrl} alt={selectedDoc.name} className="w-full h-full object-cover" />
                ) : (
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Document Preview Unavailable</p>
                )}
              </div>
              <button onClick={() => setSelectedDoc(null)} className="w-full h-12 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest mt-2 active:scale-97 transition-all">
                Close Viewer
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <main className="space-y-6">
        <div className="bg-white p-5 rounded-[2rem] border border-white shadow-xl flex items-center justify-between group active:scale-[0.99] transition-all">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/10 shadow-sm shadow-emerald-500/5">
              <CheckCircle2 size={24} strokeWidth={3} />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-[14px] font-black tracking-tight leading-none text-slate-900 uppercase">
                {isLoading ? 'Loading Documents' : `${docs.filter((doc) => doc.status === 'Uploaded').length} Uploaded`}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 opacity-60 leading-tight tracking-widest">
                {docs.filter((doc) => doc.status !== 'Uploaded').length} Action Required
              </p>
            </div>
          </div>
          <button
            onClick={loadDriver}
            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm ${isSyncing ? 'bg-slate-100 text-slate-300' : 'bg-blue-50 text-blue-500 active:bg-blue-100'}`}
            disabled={isSyncing}
          >
            {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : 'Refresh'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60 ml-2">Uploaded Documents</h3>
            <button className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-0.5">Audit Feed</button>
          </div>

          <div className="space-y-3">
            {error ? (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-[11px] font-bold">
                {error}
              </div>
            ) : null}

            {!error && docs.length === 0 ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center text-[11px] font-bold text-slate-400">
                No documents uploaded yet.
              </div>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className="bg-white p-4 py-5 rounded-2xl border border-white shadow-[0_5px_30px_rgba(0,0,0,0.015)] flex items-center justify-between group active:scale-98 transition-all overflow-hidden relative cursor-pointer"
                >
                  <div className={`absolute top-0 bottom-0 left-0 w-1 ${doc.status === 'Uploaded' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`} />

                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-slate-50 bg-slate-50 text-slate-400 shadow-sm ml-1 group-hover:bg-slate-900 group-hover:text-white transition-all">
                      <FileText size={20} />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-[14px] font-black text-slate-900 leading-tight uppercase tracking-tight">{doc.name}</h4>
                      <p className="text-[11px] font-bold text-slate-400 opacity-60 leading-tight uppercase tracking-widest">{doc.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shadow-sm ${doc.status === 'Uploaded' ? 'bg-emerald-50 text-emerald-500 border-emerald-500/10' : 'bg-rose-50 text-rose-500 border-rose-500/10 animate-pulse'}`}>
                      {doc.status}
                    </span>
                    <label
                      onClick={(event) => event.stopPropagation()}
                      className="h-8 w-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                      title="Change document image"
                    >
                      {imageUploading && uploadingDocumentKey === doc.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Camera size={15} strokeWidth={2.5} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={imageUploading}
                        onChange={(event) => {
                          uploadingDocumentKeyRef.current = doc.id;
                          setUploadingDocumentKey(doc.id);
                          onDocumentImageChange(event);
                        }}
                      />
                    </label>
                    <Eye size={18} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverDocuments;
