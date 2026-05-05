import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock,
  Mail,
  Search,
  ChevronRight
} from "lucide-react";
import { useSettings } from "../../../../shared/context/SettingsContext";
import {
  clearDriverRegistrationSession,
  getDriverApprovalStatus,
  getDriverDocumentTemplates,
  clearDriverAuthState,
  getLocalDriverToken,
  getStoredDriverRole,
  persistDriverAuthSession,
} from "../../services/registrationService";

const APPROVAL_POLL_MS = 2500;

const unwrapDriver = (response) =>
  response?.data?.data || response?.data || response;

const isDriverApproved = (driver) => {
  if (!driver) {
    return false;
  }

  const approval = String(driver.approve ?? "").toLowerCase();
  const status = String(driver.status || "").toLowerCase();

  return (
    driver.approve === true ||
    driver.approve === 1 ||
    ["true", "1", "yes", "approved"].includes(approval) ||
    ["approved", "active", "verified"].includes(status)
  );
};

const redirectToDriverLogin = (navigate) => {
  clearDriverAuthState();
  navigate("/taxi/driver/login", { replace: true });
};

const RegistrationStatus = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const [checking, setChecking] = useState(true);
  const [driver, setDriver] = useState(null);
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    "Waiting for admin approval",
  );
  const timeoutRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const appName = settings.general?.app_name || "App";
  const appLogo = settings.general?.logo || settings.customization?.logo;
  const isVehicleReapproval = location.state?.statusReason === "vehicle-update" || driver?.approve === false;
  const routePrefix = location.pathname.startsWith('/taxi/owner') ? '/taxi/owner' : '/taxi/driver';

  useEffect(() => {
    if (location.state?.role) {
      const normalizedRole =
        String(location.state.role).toLowerCase() === "owner"
          ? "owner"
          : "driver";
      persistDriverAuthSession({ role: normalizedRole });
    }

    const onboardingToken =
      location.state?.completedRegistration?.token ||
      location.state?.token ||
      "";

    if (onboardingToken) {
      const roleFromState = String(location.state?.role || "").toLowerCase();
      persistDriverAuthSession({
        token: onboardingToken,
        role: roleFromState === "owner" ? "owner" : "driver",
      });
    }

    mountedRef.current = true;

    const fetchTemplates = async () => {
        try {
            const role = getStoredDriverRole() || location.state?.role || "driver";
            const response = await getDriverDocumentTemplates(role);
            const templates = response?.data?.data?.results || response?.data?.results || [];
            if (mountedRef.current) setDocumentTemplates(templates);
        } catch (err) {
            console.error("Failed to fetch templates", err);
        }
    };

    fetchTemplates();

    const checkApproval = async () => {
      if (!mountedRef.current || requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      const token = getLocalDriverToken();

      if (!token) {
        if (mountedRef.current) {
          setChecking(false);
          setStatusMessage(
            "Registration session not found. Please start again.",
          );
        }
        redirectToDriverLogin(navigate);
        requestInFlightRef.current = false;
        return;
      }

      try {
        const response = await getDriverApprovalStatus();
        const driverData = unwrapDriver(response);
        if (mountedRef.current) setDriver(driverData);
        
        const isApproved = isDriverApproved(driverData);

        if (!mountedRef.current) {
          return;
        }

        if (isApproved) {
          clearDriverRegistrationSession();
          const normalizedRole =
            String(getStoredDriverRole() || location.state?.role || "driver").toLowerCase();
          
          const isOwner = normalizedRole === "owner";
          const path = isOwner ? "/taxi/owner/home" : "/taxi/driver/home";
          
          navigate(path, { replace: true });
          requestInFlightRef.current = false;
          return;
        }

        setChecking(false);
        setStatusMessage("Your application is being audited by our verification team.");
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        if (error?.status === 401) {
          redirectToDriverLogin(navigate);
          requestInFlightRef.current = false;
          return;
        }

        if (error?.status === 404) {
          setStatusMessage("Driver account deleted. Redirecting to login...");
          redirectToDriverLogin(navigate);
          requestInFlightRef.current = false;
          return;
        }

        setChecking(false);
        setStatusMessage(
          error?.message || "Your request is still under review.",
        );
      } finally {
        requestInFlightRef.current = false;
      }
    };

    checkApproval();
    timeoutRef.current = setInterval(checkApproval, APPROVAL_POLL_MS);

    return () => {
      mountedRef.current = false;
      requestInFlightRef.current = false;
      clearInterval(timeoutRef.current);
    };
  }, [location.state, navigate]);

const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (['approved', 'active', 'verified', 'true', '1'].includes(s)) return 'text-emerald-500 bg-emerald-50';
    if (['rejected', 'declined', 'failed'].includes(s)) return 'text-rose-500 bg-rose-50';
    return 'text-amber-500 bg-amber-50';
  };

  const getDocumentStatus = (doc = {}) =>
    String(
      doc?.status ||
      doc?.verificationStatus ||
      doc?.approvalStatus ||
      doc?.reviewStatus ||
      'pending',
    ).toLowerCase();

  const getDocumentReason = (doc = {}) =>
    String(
      doc?.comment ||
      doc?.remarks ||
      doc?.reason ||
      doc?.admin_comment ||
      doc?.rejection_reason ||
      '',
    ).trim();

  const getDocumentImage = (doc = {}) =>
    String(
      doc?.previewUrl ||
      doc?.secureUrl ||
      doc?.url ||
      '',
    ).trim();

  const getDocumentReviewTimestamp = (doc = {}) => {
    const reviewTime = new Date(
      doc?.reverificationRequestedAt ||
      doc?.uploadedAt ||
      doc?.updatedAt ||
      0,
    ).getTime();
    const reviewedTime = new Date(doc?.reviewedAt || 0).getTime();

    if (!Number.isFinite(reviewTime) || reviewTime <= 0) {
      return false;
    }

    return Number.isFinite(reviewedTime) && reviewedTime > 0 && reviewTime >= reviewedTime;
  };

  const getDocumentDetails = () => {
    if (!driver || !documentTemplates.length) return [];
    
    const docs = driver.documents || {};
    const flatFields = documentTemplates.flatMap(t => t.fields || []);
    
    return flatFields.map(field => {
        const doc = docs[field.key];
        const status = getDocumentStatus(doc);
        const reason = getDocumentReason(doc);
        
        return {
            label: field.label || field.name || field.key,
            status,
            reason,
            key: field.key,
            previewUrl: getDocumentImage(doc),
            reverificationPending: status === 'pending' && getDocumentReviewTimestamp(doc),
        };
    });
  };

  const docDetails = getDocumentDetails();
  const rejectedDocs = docDetails.filter(d => d.status === 'rejected' || d.status === 'declined');
  const pendingReverificationDocs = docDetails.filter((doc) => doc.reverificationPending);

  return (
    <div 
        className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-10 pt-12 select-none overflow-x-hidden flex flex-col items-center"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="mb-8 w-full flex justify-center">
        {appLogo ? (
          <img
            src={appLogo}
            alt={appName}
            className="h-8 object-contain"
          />
        ) : (
          <span className="text-xl font-bold text-slate-900 tracking-tight">{appName}</span>
        )}
      </div>

      <main className="w-full max-w-sm space-y-6">
        <section className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
                <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-[#8a5a22] shadow-[0_20px_50px_rgba(148,116,70,0.15)] border border-white/80">
                    <Clock size={36} strokeWidth={2} className="animate-pulse" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-500 rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-lg">
                    <Search size={14} strokeWidth={3} />
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                    {pendingReverificationDocs.length > 0 ? "Reverification submitted" : isVehicleReapproval ? "Update under review" : "Application status"}
                </p>
                <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                    {rejectedDocs.length > 0 ? "Action Required" : pendingReverificationDocs.length > 0 ? "Reverification Pending" : "Review Pending"}
                </h1>
                <p className="mx-auto max-w-[28ch] text-sm leading-6 text-slate-600">
                    {rejectedDocs.length > 0 
                        ? "Some of your documents were rejected. Please re-upload them to continue."
                        : pendingReverificationDocs.length > 0
                        ? "Your updated documents were sent back to admin for another review."
                        : "Our team is currently performing a manual audit of your profile."}
                </p>
            </div>
        </section>

        {driver && (
            <section className="bg-white rounded-[30px] p-5 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h4 className="text-[16px] font-bold text-slate-900">{driver.name || 'Partner'}</h4>
                        <p className="text-[13px] font-medium text-slate-500">+91 {driver.phone}</p>
                    </div>
                    <div className="ml-auto px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {driver.status || 'Pending'}
                    </div>
                </div>
            </section>
        )}

        <section className="space-y-3">
            <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-widest px-2">Document Status</h3>
            <div className="space-y-3">
                {docDetails.length > 0 ? docDetails.map((doc, idx) => (
                    <div key={idx} className="bg-white rounded-[24px] border border-slate-100 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[14px] font-bold text-slate-800">{doc.label}</span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getStatusColor(doc.status)}`}>
                                {doc.status}
                            </span>
                        </div>
                        {doc.reason && (
                            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                                <p className="text-[12px] font-bold text-rose-600 leading-relaxed">
                                    Reason: <span className="font-medium text-rose-500">{doc.reason}</span>
                                </p>
                            </div>
                        )}
                        {doc.reverificationPending && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                <p className="text-[12px] font-bold text-blue-600 leading-relaxed">
                                    Re-uploaded and waiting for admin re-verification.
                                </p>
                            </div>
                        )}
                        {(doc.status === 'rejected' || doc.status === 'declined') && (
                            <button
                                onClick={() => navigate(`${routePrefix}/documents`, {
                                    state: {
                                        focusDocumentKey: doc.key,
                                        fromRegistrationStatus: true,
                                    },
                                })}
                                className="w-full h-11 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 text-[13px] font-bold active:scale-95 transition-all shadow-sm"
                            >
                                Re-upload {doc.label} <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                )) : (
                    <div className="bg-white rounded-[24px] border border-slate-100 p-8 text-center">
                        <div className="h-5 w-5 border-2 border-slate-100 border-t-[#8a5a22] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-[13px] font-bold text-slate-400">Loading document checklist...</p>
                    </div>
                )}
            </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-1 mt-2 rounded-[28px] border border-slate-100 bg-white/95 p-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl flex flex-col gap-3">
            {rejectedDocs.length > 0 ? (
                <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-[12px] font-semibold leading-relaxed text-rose-600">
                    Select a rejected document above to re-upload the correct file. You can do this one by one for multiple rejected documents.
                </div>
            ) : null}
            <button 
                onClick={() => navigate(`${routePrefix}/support/chat`, {
                    state: {
                        backPath: `${routePrefix}/registration-status`,
                        backState: location.state || null,
                    },
                })}
                className="w-full h-14 bg-white border border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold active:scale-95 transition-all"
            >
                Contact Support
            </button>
        </div>
      </main>
    </div>
  );
};
export default RegistrationStatus;

