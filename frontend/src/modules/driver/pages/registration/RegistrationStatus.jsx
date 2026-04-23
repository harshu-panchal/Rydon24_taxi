import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Mail,
  ShieldCheck,
  LayoutDashboard,
  Search,
  CheckCircle
} from "lucide-react";
import { useSettings } from "../../../../shared/context/SettingsContext";
import {
  clearDriverRegistrationSession,
  getDriverApprovalStatus,
  clearDriverAuthState,
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
  const [statusMessage, setStatusMessage] = useState(
    "Waiting for admin approval",
  );
  const timeoutRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const appName = settings.general?.app_name || "App";
  const appLogo = settings.general?.logo || settings.customization?.logo;

  const handleDashboard = () => {
    if (checking) {
      return;
    }

    const normalizedRole =
      String(
        localStorage.getItem("role") || location.state?.role || "driver",
      ).toLowerCase() === "owner"
        ? "owner"
        : "driver";
    navigate(
      normalizedRole === "owner" ? "/taxi/driver/profile" : "/taxi/driver/home",
    );
  };

  useEffect(() => {
    if (location.state?.role) {
      const normalizedRole =
        String(location.state.role).toLowerCase() === "owner"
          ? "owner"
          : "driver";
      localStorage.setItem("role", normalizedRole);
    }

    const onboardingToken =
      location.state?.completedRegistration?.token ||
      location.state?.token ||
      "";

    if (onboardingToken) {
      localStorage.setItem("token", onboardingToken);
      localStorage.setItem("driverToken", onboardingToken);
      const roleFromState = String(location.state?.role || "").toLowerCase();
      localStorage.setItem(
        "role",
        roleFromState === "owner" ? "owner" : "driver",
      );
    }

    mountedRef.current = true;

    const checkApproval = async () => {
      if (!mountedRef.current || requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      const token =
        localStorage.getItem("driverToken") || localStorage.getItem("token");

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
        const driver = unwrapDriver(response);
        const isApproved = isDriverApproved(driver);

        if (!mountedRef.current) {
          return;
        }

        if (isApproved) {
          clearDriverRegistrationSession();
          const normalizedRole =
            String(
              localStorage.getItem("role") || location.state?.role || "driver",
            ).toLowerCase() === "owner"
              ? "owner"
              : "driver";
          navigate(
            normalizedRole === "owner"
              ? "/taxi/driver/profile"
              : "/taxi/driver/home",
            {
              replace: true,
            },
          );
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

  return (
    <div 
        className="min-h-screen bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-12 select-none overflow-x-hidden flex flex-col items-center"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="mb-10 w-full flex justify-center">
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

      <main className="w-full max-w-sm space-y-8 text-center">
        <section className="flex flex-col items-center space-y-6">
            <div className="relative">
                <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-[#8a5a22] shadow-[0_20px_50px_rgba(148,116,70,0.15)] border border-white/80 animate-bounce-slow">
                    <Clock size={36} strokeWidth={2} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-lg">
                    <Search size={14} strokeWidth={3} />
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a7b50]">
                    Registration complete
                </p>
                <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950">
                    Review Pending
                </h1>
                <p className="mx-auto max-w-[28ch] text-sm leading-6 text-slate-600">
                    We've received your documents. Our team is currently performing a manual audit.
                </p>
            </div>
        </section>

        <section className="space-y-4 rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-4 text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="text-[15px] font-semibold text-slate-950">Security Verified</h4>
                    <p className="text-[12px] font-medium text-slate-500">Initial automated checks passed</p>
                </div>
                <CheckCircle size={18} className="text-emerald-500" />
            </div>

            <div className="h-px w-full bg-slate-100" />

            <div className="flex items-center gap-4 text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7efe2] text-[#8a5a22]">
                    <Mail size={18} />
                </div>
                <div className="flex-1">
                    <h4 className="text-[15px] font-semibold text-slate-950">Manual Audit</h4>
                    <p className="text-[12px] font-medium text-slate-500 leading-tight">
                        {checking ? "Checking approval status..." : statusMessage}
                    </p>
                </div>
                <div className="h-5 w-5 border-2 border-slate-100 border-t-[#8a5a22] rounded-full animate-spin" />
            </div>
        </section>

        <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-4">
            <p className="text-xs font-medium text-amber-900 leading-relaxed italic">
                You will receive a notification once your account is activated. Usually takes 24-48 hours.
            </p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/88 p-5 backdrop-blur-md">
            <div className="mx-auto max-w-sm">
                <button
                    onClick={handleDashboard}
                    disabled={checking}
                    className={`flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all ${
                        !checking
                            ? 'bg-slate-950 text-white hover:bg-slate-900'
                            : 'pointer-events-none bg-slate-200 text-slate-500 shadow-none'
                    }`}
                >
                    <LayoutDashboard size={18} />
                    {checking ? "Waiting for Audit..." : "Go to Dashboard"}
                    {!checking && <ChevronRight size={17} strokeWidth={2.8} />}
                </button>
            </div>
        </div>
      </main>
    </div>
  );
};

export default RegistrationStatus;

