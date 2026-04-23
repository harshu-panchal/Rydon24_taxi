import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bike,
  Car,
  Edit3,
  LoaderCircle,
  Plus,
  Trash2,
  Truck,
  AlertCircle,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentDriver,
  getDriverVehicleTypes,
  updateDriverVehicle,
  deleteDriverVehicle,
  getOwnerFleetVehicles,
  deleteOwnerFleetVehicle,
} from "../../services/registrationService";
import { useImageUpload } from "../../../../shared/hooks/useImageUpload";
import DriverBottomNav from "../../../shared/components/DriverBottomNav";

const unwrap = (response) => response?.data?.data || response?.data || response;

const getVehicleTypes = (response) => {
  const data = unwrap(response);
  return (
    data?.vehicle_types || data?.results || (Array.isArray(data) ? data : [])
  );
};

const getTypeLabel = (type) =>
  type?.name || type?.vehicle_type || type?.label || "Vehicle";

const iconFor = (iconType = "") => {
  const value = String(iconType).toLowerCase();
  if (value.includes("bike")) return Bike;
  if (
    value.includes("truck") ||
    value.includes("hcv") ||
    value.includes("lcv") ||
    value.includes("mcv")
  ) {
    return Truck;
  }
  return Car;
};

const OwnerVehicleFleet = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    vehicleTypeId: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleNumber: "",
    vehicleColor: "",
    vehicleImage: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const {
    uploading: imageUploading,
    preview: imagePreview,
    handleFileChange: onVehicleImageChange,
    setPreview: setVehicleImagePreview,
  } = useImageUpload({
    folder: "driver-vehicles",
    onSuccess: (url) => {
      setFormData((prev) => ({ ...prev, vehicleImage: url }));
    },
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setMessage("");

      try {
        const [driverResponse, typeResponse, fleetResponse] = await Promise.all(
          [
            getCurrentDriver(),
            getDriverVehicleTypes(),
            getOwnerFleetVehicles(),
          ],
        );

        if (!active) return;

        const driver = unwrap(driverResponse);
        const types = getVehicleTypes(typeResponse);
        const fleetData = unwrap(fleetResponse);
        const fleetVehicles = fleetData?.results || [];

        setVehicleTypes(types);

        // Combine primary vehicle with fleet vehicles
        const allVehicles = [];

        // Add primary vehicle
        if (driver?.vehicleNumber) {
          allVehicles.push({
            _id: driver._id,
            vehicleTypeId: driver.vehicleTypeId,
            vehicleMake: driver.vehicleMake,
            vehicleModel: driver.vehicleModel,
            vehicleNumber: driver.vehicleNumber,
            vehicleColor: driver.vehicleColor,
            vehicleImage: driver.vehicleImage,
            isPrimary: true,
            status: "active",
          });
        }

        // Add fleet vehicles
        if (Array.isArray(fleetVehicles)) {
          fleetVehicles.forEach((fleetVehicle) => {
            allVehicles.push({
              _id: fleetVehicle._id || fleetVehicle.id,
              vehicleTypeId: fleetVehicle.vehicle_type_id,
              vehicleMake: fleetVehicle.car_brand,
              vehicleModel: fleetVehicle.car_model,
              vehicleNumber: fleetVehicle.license_plate_number,
              vehicleColor: fleetVehicle.car_color,
              vehicleImage: "",
              isPrimary: false,
              status: fleetVehicle.status || "pending",
              isFleetVehicle: true,
            });
          });
        }

        setVehicles(allVehicles);
      } catch (error) {
        if (active) {
          setMessage(error.message || "Could not load vehicles.");
          setMessageType("error");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedType = useMemo(() => {
    return vehicleTypes.find(
      (type) => String(type._id || type.id) === String(formData.vehicleTypeId),
    );
  }, [formData.vehicleTypeId, vehicleTypes]);

  const ActiveIcon = iconFor(selectedType?.icon_types || selectedType?.name);

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicleTypeId: String(
        vehicle.vehicleTypeId?._id || vehicle.vehicleTypeId || "",
      ),
      vehicleMake: vehicle.vehicleMake || "",
      vehicleModel: vehicle.vehicleModel || "",
      vehicleNumber: vehicle.vehicleNumber || "",
      vehicleColor: vehicle.vehicleColor || "",
      vehicleImage: vehicle.vehicleImage || "",
    });
    setVehicleImagePreview(vehicle.vehicleImage || null);
    setIsEditing(true);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.vehicleTypeId) {
      setMessage("Select a vehicle type first.");
      setMessageType("error");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await updateDriverVehicle(formData);
      const updated = unwrap(response);

      // Update the vehicle in the list, preserving fleet vehicle status
      setVehicles((prev) =>
        prev.map((v) =>
          v._id === editingVehicle._id
            ? {
                ...v,
                vehicleTypeId: updated.vehicleTypeId || formData.vehicleTypeId,
                vehicleMake: updated.vehicleMake || formData.vehicleMake,
                vehicleModel: updated.vehicleModel || formData.vehicleModel,
                vehicleNumber: updated.vehicleNumber || formData.vehicleNumber,
                vehicleColor: updated.vehicleColor || formData.vehicleColor,
                vehicleImage: updated.vehicleImage || v.vehicleImage,
                // Preserve immutable properties
                isPrimary: v.isPrimary,
                status: v.status,
                isFleetVehicle: v.isFleetVehicle,
              }
            : v,
        ),
      );

      setIsEditing(false);
      setEditingVehicle(null);
      setFormData({
        vehicleTypeId: "",
        vehicleMake: "",
        vehicleModel: "",
        vehicleNumber: "",
        vehicleColor: "",
        vehicleImage: "",
      });
      setMessage("Vehicle updated successfully.");
      setMessageType("success");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(error.message || "Could not update vehicle.");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (vehicle) => {
    setDeleteConfirm(null);

    if (vehicles.length === 1) {
      setMessage("Cannot delete the last vehicle. Add another vehicle first.");
      setMessageType("error");
      return;
    }

    try {
      // Use appropriate delete function based on vehicle type
      if (vehicle.isFleetVehicle) {
        await deleteOwnerFleetVehicle(vehicle._id);
      } else {
        await deleteDriverVehicle(vehicle._id);
      }
      setVehicles((prev) => prev.filter((v) => v._id !== vehicle._id));
      setMessage("Vehicle deleted successfully.");
      setMessageType("success");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(error.message || "Could not delete vehicle.");
      setMessageType("error");
    }
  };

  const handleAddVehicle = () => {
    navigate("/taxi/driver/add-vehicle");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoaderCircle size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 shadow-sm">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/taxi/driver/profile")}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 flex items-center justify-center hover:shadow-md transition-all flex-shrink-0">
                <ArrowLeft size={16} className="text-indigo-600" />
              </motion.button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                    My Vehicles
                  </h1>
                  <div className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 flex-shrink-0">
                    <span className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      {vehicles.length}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight">
                  Manage your fleet
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddVehicle}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all flex-shrink-0">
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Add</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Message Alert */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              messageType === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}>
            <AlertCircle size={18} />
            <p className="text-sm font-medium">{message}</p>
          </motion.div>
        )}

        {/* Vehicles List */}
        {vehicles.length === 0 ? (
          <div className="text-center py-20">
            <Car size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No vehicles yet
            </h3>
            <p className="text-gray-600 mb-6">
              Add your first vehicle to get started
            </p>
            <button
              onClick={handleAddVehicle}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={18} />
              Add Vehicle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle, index) => {
              const VehicleIcon = iconFor(
                vehicleTypes.find(
                  (t) =>
                    String(t._id || t.id) ===
                    String(vehicle.vehicleTypeId?._id || vehicle.vehicleTypeId),
                )?.icon_types || "car",
              );

              const vehicleTypeLabel = getTypeLabel(
                vehicleTypes.find(
                  (t) =>
                    String(t._id || t.id) ===
                    String(vehicle.vehicleTypeId?._id || vehicle.vehicleTypeId),
                ),
              );

              return (
                <motion.div
                  key={vehicle._id || `vehicle-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center gap-4">
                  {/* Vehicle Icon */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg flex items-center justify-center border border-indigo-100 flex-shrink-0">
                    {vehicle.vehicleImage ? (
                      <img
                        src={vehicle.vehicleImage}
                        alt={vehicle.vehicleNumber}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <VehicleIcon size={28} className="text-indigo-400" />
                    )}
                  </div>

                  {/* Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {vehicle.vehicleMake} {vehicle.vehicleModel}
                      </h3>
                      {vehicle.isPrimary && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Primary
                        </div>
                      )}
                      {vehicle.isFleetVehicle &&
                        vehicle.status === "pending" && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse" />
                            Pending
                          </div>
                        )}
                      {vehicle.isFleetVehicle &&
                        vehicle.status === "approved" && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Approved
                          </div>
                        )}
                      {vehicle.isFleetVehicle &&
                        vehicle.status === "rejected" && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Rejected
                          </div>
                        )}
                    </div>

                    <div className="text-xs sm:text-sm text-gray-600 space-y-0.5">
                      <p>
                        Plate:{" "}
                        <span className="font-medium">
                          {vehicle.vehicleNumber}
                        </span>
                      </p>
                      <p>
                        Color:{" "}
                        <span className="font-medium capitalize">
                          {vehicle.vehicleColor}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEdit(vehicle)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
                      <Edit3 size={16} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteConfirm(vehicle)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Edit Modal */}
        <AnimatePresence>
          {isEditing && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditing(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 pb-28 shadow-2xl max-w-lg mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between sticky -top-6 bg-white pb-4">
                  <div>
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                      Edit Vehicle
                    </p>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                      Update Details
                    </h2>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsEditing(false)}
                    className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                    <X size={22} />
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {/* Vehicle Type Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest">
                      Vehicle Type
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {vehicleTypes.map((type) => {
                        const id = String(type._id || type.id);
                        const TypeIcon = iconFor(type.icon_types || type.name);
                        const selected = String(formData.vehicleTypeId) === id;

                        return (
                          <motion.button
                            key={id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => handleChange("vehicleTypeId", id)}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all min-h-[100px] border-2 font-bold ${
                              selected
                                ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-lg"
                                : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                            }`}>
                            <TypeIcon size={28} strokeWidth={1.5} />
                            <span className="text-xs uppercase tracking-wider text-center">
                              {getTypeLabel(type)}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Make & Model */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl focus-within:border-indigo-500 transition-colors">
                      <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">
                        Make
                      </label>
                      <input
                        value={formData.vehicleMake}
                        onChange={(e) =>
                          handleChange("vehicleMake", e.target.value)
                        }
                        placeholder="Suzuki"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl focus-within:border-indigo-500 transition-colors">
                      <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">
                        Model
                      </label>
                      <input
                        value={formData.vehicleModel}
                        onChange={(e) =>
                          handleChange("vehicleModel", e.target.value)
                        }
                        placeholder="WagonR"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Plate Number */}
                  <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl focus-within:border-indigo-500 transition-colors">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">
                      Plate Number
                    </label>
                    <input
                      value={formData.vehicleNumber}
                      onChange={(e) =>
                        handleChange(
                          "vehicleNumber",
                          e.target.value.toUpperCase(),
                        )
                      }
                      placeholder="MP 09 KK 2222"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-400 uppercase"
                    />
                  </div>

                  {/* Color */}
                  <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl focus-within:border-indigo-500 transition-colors">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">
                      Color
                    </label>
                    <input
                      value={formData.vehicleColor}
                      onChange={(e) =>
                        handleChange("vehicleColor", e.target.value)
                      }
                      placeholder="White, Black"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t-2 border-slate-100">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors uppercase text-sm">
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 uppercase text-sm">
                    {isSaving ? "Saving..." : "Save Changes"}
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirm(null)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                  <AlertCircle
                    size={32}
                    className="text-red-600"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="text-center text-xl font-black text-slate-900 mb-2 uppercase">
                  Delete Vehicle?
                </h3>
                <p className="text-center text-slate-600 mb-8 font-semibold">
                  Are you sure? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors uppercase">
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors uppercase">
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <DriverBottomNav />
    </div>
  );
};

export default OwnerVehicleFleet;
