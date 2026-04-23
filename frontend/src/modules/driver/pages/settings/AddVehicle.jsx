import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronRight,
  Upload,
  X,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDriverVehicleTypes } from "../../services/registrationService";
import api from "../../../../shared/api/axiosInstance";

const AddVehicle = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Details, 2: Document, 3: Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    vehicleTypeId: "",
    make: "",
    model: "",
    number: "",
    color: "",
    rcFile: null,
  });
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const typesResponse = await getDriverVehicleTypes();

        const types =
          typesResponse?.data?.results || typesResponse?.data?.data || [];
        setVehicleTypes(Array.isArray(types) ? types : []);
      } catch (err) {
        setError("Failed to load vehicle types");
        console.error(err);
      }
    };

    loadData();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setFormData((p) => ({ ...p, rcFile: file }));
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setIsSubmitting(true);

      // Call the API to add the vehicle
      await api.post("/drivers/fleet/vehicles", {
        vehicleTypeId: formData.vehicleTypeId,
        make: formData.make,
        model: formData.model,
        number: formData.number,
        color: formData.color,
        rcFile: formData.rcFile?.name || null,
      });

      setStep(3);
      // Auto redirect after 5 seconds
      setTimeout(() => {
        navigate("/taxi/driver/vehicle-fleet");
      }, 5000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to submit vehicle",
      );
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans p-5 pt-8 select-none overflow-x-hidden pb-32">
      <header className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-900 active:scale-95 transition-transform">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-6 h-1 rounded-full transition-all ${step >= s ? "bg-indigo-600" : "bg-slate-100"}`}
            />
          ))}
        </div>
      </header>

      <main className="max-w-sm mx-auto">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  Vehicle Details
                </h1>
                <p className="text-[11px] font-bold text-slate-400 opacity-80 uppercase tracking-widest leading-relaxed">
                  Enter details of the new vehicle
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3">
                  <AlertCircle
                    size={18}
                    className="text-red-600 flex-shrink-0"
                  />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Vehicle Type Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-900">
                    Select Type *
                  </label>
                  <select
                    value={formData.vehicleTypeId}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        vehicleTypeId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="">Select Vehicle Type</option>
                    {vehicleTypes.map((type) => (
                      <option
                        key={type._id || type.id}
                        value={type._id || type.id}>
                        {type.name || type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Car Brand & Model Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-900">
                      Car Brand *
                    </label>
                    <input
                      value={formData.make}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, make: e.target.value }))
                      }
                      placeholder="Enter Car Make"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-900">
                      Car Model *
                    </label>
                    <input
                      value={formData.model}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, model: e.target.value }))
                      }
                      placeholder="Enter Car Model"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* License Plate & Color Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-900">
                      License Plate Number *
                    </label>
                    <input
                      value={formData.number}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          number: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Enter License Plate Number"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-900">
                      Car Color *
                    </label>
                    <input
                      value={formData.color}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, color: e.target.value }))
                      }
                      placeholder="Enter Car Color"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-50">
                <button
                  onClick={() => setStep(2)}
                  disabled={
                    !formData.vehicleTypeId ||
                    !formData.make ||
                    !formData.model ||
                    !formData.number ||
                    !formData.color
                  }
                  className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-black uppercase tracking-widest shadow-lg transition-all ${
                    formData.vehicleTypeId &&
                    formData.make &&
                    formData.model &&
                    formData.number &&
                    formData.color
                      ? "bg-indigo-600 text-white shadow-indigo-600/10 hover:bg-indigo-700"
                      : "bg-slate-100 text-slate-300 pointer-events-none"
                  }`}>
                  Next: Documents <ChevronRight size={16} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  Upload RC
                </h1>
                <p className="text-[11px] font-bold text-slate-400 opacity-80 uppercase tracking-widest leading-relaxed">
                  Proof of vehicle ownership
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative border-2 border-dashed border-slate-200 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 hover:border-slate-900 transition-colors cursor-pointer group">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                  />
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                    <Upload size={28} />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-[14px] font-black text-slate-900 uppercase">
                      Click to Upload RC
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Image or PDF (Max 5MB)
                    </p>
                  </div>
                </div>

                {formData.rcFile && (
                  <div className="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between border border-emerald-100">
                    <div className="flex items-center gap-3 text-emerald-600">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        <ShieldCheck size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-black uppercase tracking-tight">
                          {formData.rcFile.name}
                        </p>
                        <p className="text-[9px] font-bold opacity-60 uppercase">
                          File attached successfully
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setFormData((p) => ({ ...p, rcFile: null }))
                      }
                      className="text-emerald-900/30 hover:text-rose-500 transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-50">
                <button
                  onClick={handleSubmit}
                  disabled={!formData.rcFile || isSubmitting}
                  className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-black uppercase tracking-widest shadow-lg transition-all ${
                    formData.rcFile && !isSubmitting
                      ? "bg-indigo-600 text-white shadow-indigo-600/10 hover:bg-indigo-700"
                      : "bg-slate-100 text-slate-300 pointer-events-none"
                  }`}>
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit for Approval{" "}
                      <CheckCircle2 size={16} strokeWidth={3} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-8 pt-20">
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200 }}
                  className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl relative z-10">
                  <CheckCircle2 size={40} strokeWidth={2.5} />
                </motion.div>
                <motion.div
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.2, 0, 0.2],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] -z-0"
                />
              </div>

              <div className="text-center space-y-3">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
                  Success!
                </h1>
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed px-10">
                  Vehicle submitted for verification. It will be{" "}
                  <span className="text-indigo-600 font-black">
                    auto-approved
                  </span>{" "}
                  in 5 seconds.
                </p>
              </div>

              <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AddVehicle;
