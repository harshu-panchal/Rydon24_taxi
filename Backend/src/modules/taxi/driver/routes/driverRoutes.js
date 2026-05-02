import { Router } from "express";
import { asyncHandler } from "../../../../utils/asyncHandler.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import {
  addDriverEmergencyContact,
  completeOnboarding,
  createDriverPaymentQr,
  createServiceCenterStaffMember,
  createDriverWithdrawalRequest,
  createServiceCenterVehicle,
  createOwnerFleetDriver,
  deleteCurrentDriverAccount,
  deleteServiceCenterVehicle,
  updateServiceCenterVehicle,
  deleteDriverEmergencyContact,
  claimDriverIncentiveReward,
  goOffline,
  goOnline,
  createBusDriverReservation,
  updateBusDriverSchedules,
  getCurrentDriver,
  getBusDriverSeatLayout,
  listBusDriverBookings,
  getDriverPaymentQrStatus,
  getDriverApprovalStatus,
  getDriverDocumentTemplates,
  getDriverEmergencyContacts,
  getDriverIncentives,
  getDriverNotifications,
  cancelDriverScheduledRide,
  getDriverScheduledRides,
  getServiceCenterBookings,
  getServiceCenterStaffMembers,
  getServiceCenterVehicles,
  saveDriverFcmToken,
  getOwnerFleetDrivers,
  getMyWallet,
  getOnboardingSession,
  getServiceLocations,
  loginDriver,
  startDriverLoginOtpRequest,
  saveOnboardingDocuments,
  saveOnboardingPersonal,
  saveOnboardingReferral,
  saveOnboardingVehicle,
  registerDriver,
  requestDriverAccountDeletion,
  startOnboarding,
  topUpMyWallet,
  createDriverWalletTopupOrder,
  verifyDriverWalletTopup,

  updateCurrentDriver,
  updateDriverVehicle,
  updateServiceCenterBooking,
  verifyOnboardingOtp,
  verifyDriverLoginOtpRequest,
  addOwnerVehicle,
  getOwnerFleetVehicles,
  deleteOwnerFleetVehicle,
  updateCurrentDriverDocument,
} from "../controllers/driverController.js";

export const driverRouter = Router();

driverRouter.post("/register", asyncHandler(registerDriver));
driverRouter.post("/login", asyncHandler(loginDriver));
driverRouter.post("/auth/send-otp", asyncHandler(startDriverLoginOtpRequest));
driverRouter.post(
  "/auth/verify-otp",
  asyncHandler(verifyDriverLoginOtpRequest),
);
driverRouter.get(
  "/me",
  authenticate(["driver", "owner", "bus_driver", "service_center", "service_center_staff"]),
  asyncHandler(getCurrentDriver),
);
driverRouter.patch(
  "/me",
  authenticate(["driver", "owner"]),
  asyncHandler(updateCurrentDriver),
);
driverRouter.get(
  "/bus/seats",
  authenticate(["bus_driver"]),
  asyncHandler(getBusDriverSeatLayout),
);
driverRouter.get(
  "/bus/bookings",
  authenticate(["bus_driver"]),
  asyncHandler(listBusDriverBookings),
);
driverRouter.post(
  "/bus/reservations",
  authenticate(["bus_driver"]),
  asyncHandler(createBusDriverReservation),
);
driverRouter.patch(
  "/bus/schedules",
  authenticate(["bus_driver"]),
  asyncHandler(updateBusDriverSchedules),
);
driverRouter.delete(
  "/me",
  authenticate(["driver"]),
  asyncHandler(deleteCurrentDriverAccount),
);
driverRouter.post(
  "/me/delete-request",
  authenticate(["driver"]),
  asyncHandler(requestDriverAccountDeletion),
);
driverRouter.get(
  "/emergency-contacts",
  authenticate(["driver"]),
  asyncHandler(getDriverEmergencyContacts),
);
driverRouter.post(
  "/emergency-contacts",
  authenticate(["driver"]),
  asyncHandler(addDriverEmergencyContact),
);
driverRouter.delete(
  "/emergency-contacts/:contactId",
  authenticate(["driver"]),
  asyncHandler(deleteDriverEmergencyContact),
);
driverRouter.patch(
  "/documents/:documentKey",
  authenticate(["driver"]),
  asyncHandler(updateCurrentDriverDocument),
);
driverRouter.get(
  "/notifications",
  authenticate(["driver"]),
  asyncHandler(getDriverNotifications),
);
driverRouter.get(
  "/scheduled-rides",
  authenticate(["driver"]),
  asyncHandler(getDriverScheduledRides),
);
driverRouter.post(
  "/scheduled-rides/:rideId/cancel",
  authenticate(["driver"]),
  asyncHandler(cancelDriverScheduledRide),
);
driverRouter.post(
  "/fcm-token",
  authenticate([
    "driver",
    "owner",
    "bus_driver",
    "service_center",
    "service_center_staff",
  ]),
  asyncHandler(saveDriverFcmToken),
);
driverRouter.get(
  "/wallet",
  authenticate(["driver"]),
  asyncHandler(getMyWallet),
);
driverRouter.get(
  "/incentives",
  authenticate(["driver"]),
  asyncHandler(getDriverIncentives),
);
driverRouter.post(
  "/incentives/claim",
  authenticate(["driver"]),
  asyncHandler(claimDriverIncentiveReward),
);
driverRouter.post(
  "/wallet/top-up",
  authenticate(["driver"]),
  asyncHandler(topUpMyWallet),
);
driverRouter.post(
  "/wallet/top-up/razorpay/order",
  authenticate(["driver"]),
  asyncHandler(createDriverWalletTopupOrder),
);
driverRouter.post(
  "/wallet/top-up/razorpay/verify",
  authenticate(["driver"]),
  asyncHandler(verifyDriverWalletTopup),
);
driverRouter.post(
  "/wallet/withdrawals",
  authenticate(["driver"]),
  asyncHandler(createDriverWithdrawalRequest),
);

driverRouter.post(
  "/payments/qr",
  authenticate(["driver"]),
  asyncHandler(createDriverPaymentQr),
);
driverRouter.get(
  "/payments/qr/status",
  authenticate(["driver"]),
  asyncHandler(getDriverPaymentQrStatus),
);
driverRouter.patch(
  "/vehicle",
  authenticate(["driver"]),
  asyncHandler(updateDriverVehicle),
);
driverRouter.get("/approval-status", asyncHandler(getDriverApprovalStatus));
driverRouter.get(
  "/fleet/drivers",
  authenticate(["driver", "owner"]),
  asyncHandler(getOwnerFleetDrivers),
);
driverRouter.post(
  "/fleet/drivers",
  authenticate(["driver", "owner"]),
  asyncHandler(createOwnerFleetDriver),
);
driverRouter.get(
  "/fleet/vehicles",
  authenticate(["driver", "owner"]),
  asyncHandler(getOwnerFleetVehicles),
);
driverRouter.post(
  "/fleet/vehicles",
  authenticate(["driver", "owner"]),
  asyncHandler(addOwnerVehicle),
);
driverRouter.delete(
  "/fleet/vehicles/:vehicleId",
  authenticate(["driver", "owner"]),
  asyncHandler(deleteOwnerFleetVehicle),
);
driverRouter.get(
  "/service-center/staff",
  authenticate(["service_center"]),
  asyncHandler(getServiceCenterStaffMembers),
);
driverRouter.post(
  "/service-center/staff",
  authenticate(["service_center"]),
  asyncHandler(createServiceCenterStaffMember),
);
driverRouter.get(
  "/service-center/bookings",
  authenticate(["service_center", "service_center_staff"]),
  asyncHandler(getServiceCenterBookings),
);
driverRouter.patch(
  "/service-center/bookings/:bookingId",
  authenticate(["service_center", "service_center_staff"]),
  asyncHandler(updateServiceCenterBooking),
);
driverRouter.get(
  "/service-center/vehicles",
  authenticate(["service_center", "service_center_staff"]),
  asyncHandler(getServiceCenterVehicles),
);
driverRouter.post(
  "/service-center/vehicles",
  authenticate(["service_center"]),
  asyncHandler(createServiceCenterVehicle),
);
driverRouter.patch(
  "/service-center/vehicles/:vehicleId",
  authenticate(["service_center"]),
  asyncHandler(updateServiceCenterVehicle),
);
driverRouter.delete(
  "/service-center/vehicles/:vehicleId",
  authenticate(["service_center"]),
  asyncHandler(deleteServiceCenterVehicle),
);
driverRouter.get("/service-locations", asyncHandler(getServiceLocations));
driverRouter.get(
  "/document-templates",
  asyncHandler(getDriverDocumentTemplates),
);
driverRouter.post("/onboarding/send-otp", asyncHandler(startOnboarding));
driverRouter.post("/onboarding/verify-otp", asyncHandler(verifyOnboardingOtp));
driverRouter.patch(
  "/onboarding/personal",
  asyncHandler(saveOnboardingPersonal),
);
driverRouter.patch(
  "/onboarding/referral",
  asyncHandler(saveOnboardingReferral),
);
driverRouter.patch("/onboarding/vehicle", asyncHandler(saveOnboardingVehicle));
driverRouter.patch(
  "/onboarding/documents",
  asyncHandler(saveOnboardingDocuments),
);
driverRouter.post("/onboarding/complete", asyncHandler(completeOnboarding));
driverRouter.get(
  "/onboarding/session/:registrationId",
  asyncHandler(getOnboardingSession),
);
driverRouter.patch("/online", authenticate(["driver"]), asyncHandler(goOnline));
driverRouter.patch(
  "/offline",
  authenticate(["driver"]),
  asyncHandler(goOffline),
);
