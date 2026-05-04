import crypto from "node:crypto";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { ApiError } from "../../../../utils/ApiError.js";
import { normalizePoint, toPoint } from "../../../../utils/geo.js";
import { Driver } from "../models/Driver.js";
import { BusDriver } from "../models/BusDriver.js";
import { DriverLoginSession } from "../models/DriverLoginSession.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { WithdrawalRequest } from "../../admin/models/WithdrawalRequest.js";
import { Ride } from "../../user/models/Ride.js";
import { BusBooking } from "../../user/models/BusBooking.js";
import { BusSeatHold } from "../../user/models/BusSeatHold.js";
import { Owner } from "../../admin/models/Owner.js";
import { BusService } from "../../admin/models/BusService.js";
import { ServiceLocation } from "../../admin/models/ServiceLocation.js";
import { ServiceStore } from "../../admin/models/ServiceStore.js";
import { ServiceCenterStaff } from "../../admin/models/ServiceCenterStaff.js";
import { Vehicle } from "../../admin/models/Vehicle.js";
import { RentalVehicleType } from "../../admin/models/RentalVehicleType.js";
import { RentalBookingRequest } from "../../admin/models/RentalBookingRequest.js";
import { AdminBusinessSetting } from "../../admin/models/AdminBusinessSetting.js";
import { Notification } from "../../admin/promotions/models/Notification.js";
import { FleetVehicle } from "../../admin/models/FleetVehicle.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
} from "../services/authService.js";
import { cancelScheduledRideByDriver, emitToDriver } from "../../services/dispatchService.js";
import { notifyLateAvailableDriver } from "../../services/dispatchService.js";
import { findZoneByPickup } from "../services/locationService.js";
import { listDriverServiceLocations } from "../services/serviceLocationService.js";
import {
  applyDriverWalletAdjustment,
  ensureDriverWalletCanAcceptRide,
  serializeDriverWallet,
  topUpDriverWallet,
} from "../services/walletService.js";
import {
  startDriverLoginOtp,
  verifyDriverLoginOtp,
} from "../services/loginOtpService.js";
import { verifyAccessToken } from "../../services/tokenService.js";
import { clearDriverActiveRideIfStale } from "../../services/rideService.js";
import { getWalletSettings } from "../../services/appSettingsService.js";
import { RIDE_LIVE_STATUS, RIDE_STATUS } from "../../constants/index.js";
import {
  createRentalVehicleType,
  deleteRentalVehicleType,
  ensureThirdPartySettings,
  listDriverNeededDocuments,
  listOwnerNeededDocuments,
  listRentalVehicleTypes,
  updateRentalVehicleType,
} from "../../admin/services/adminService.js";
import { assignPushTokenToEntity } from "../../services/pushTokenService.js";
import {
  completeDriverOnboarding,
  getDriverOnboardingSession,
  saveDriverDocuments,
  saveDriverPersonalDetails,
  saveDriverReferral,
  saveDriverVehicle,
  startDriverOnboarding,
  verifyDriverOtp,
} from "../services/onboardingService.js";

const generateDriverReferralCode = (driver) => {
  const idPart = String(driver?._id || "")
    .slice(-6)
    .toUpperCase();
  const phonePart = String(driver?.phone || "").slice(-4);
  return `DRV${phonePart}${idPart}`.replace(/\W/g, "");
};

const MAX_EMERGENCY_CONTACTS = 5;
const EMERGENCY_CONTACT_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const DRIVER_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RAZORPAY_QR_MAX_AMOUNT = 500000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BUS_DAY_OPTIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUS_DRIVER_SCHEDULE_DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const toIstDayKey = (value = new Date()) =>
  new Date(new Date(value).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const toCleanString = (value = "") => String(value || "").trim();
const normalizeBusPassengerPhone = (value = "") =>
  String(value || "")
    .replace(/\D/g, "")
    .trim()
    .slice(-10);
const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const BUS_DRIVER_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;

const serializeDriverRouteBooking = (routeBooking = {}) => {
  const coordinates = Array.isArray(routeBooking?.anchorLocation?.coordinates)
    ? routeBooking.anchorLocation.coordinates
    : [];

  return {
    enabled: Boolean(routeBooking?.enabled && coordinates.length === 2),
    coordinates: coordinates.length === 2 ? coordinates : null,
    label: String(routeBooking?.label || "").trim(),
    updatedAt: routeBooking?.updatedAt || null,
  };
};

const validateBusPassengerName = (value = "") => {
  if (!BUS_DRIVER_NAME_REGEX.test(String(value || "").trim())) {
    throw new ApiError(400, "Passenger name is required");
  }
};

const validateBusPassengerPhone = (value = "") => {
  if (!/^\d{10}$/.test(String(value || "").trim())) {
    throw new ApiError(400, "Passenger phone must be a valid 10-digit number");
  }
};

const validateBusPassengerEmail = (value = "") => {
  if (value && !EMAIL_REGEX.test(String(value || "").trim())) {
    throw new ApiError(400, "Passenger email is invalid");
  }
};

const normalizeBusDriverSchedule = (schedule = {}, index = 0) => ({
  id: toCleanString(schedule.id) || `schedule-${Date.now()}-${index}`,
  label: toCleanString(schedule.label),
  departureTime: toCleanString(schedule.departureTime),
  arrivalTime: toCleanString(schedule.arrivalTime),
  activeDays: Array.isArray(schedule.activeDays)
    ? [...new Set(schedule.activeDays.map((day) => toCleanString(day)).filter((day) => BUS_DRIVER_SCHEDULE_DAY_OPTIONS.includes(day)))]
    : [],
  status: ["active", "paused", "draft"].includes(toCleanString(schedule.status))
    ? toCleanString(schedule.status)
    : "active",
});

const validateBusDriverSchedules = (schedules = []) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    throw new ApiError(400, "At least one schedule is required");
  }

  const ids = new Set();

  schedules.forEach((schedule, index) => {
    if (!schedule.id) {
      throw new ApiError(400, `Schedule ${index + 1} is missing an id`);
    }

    if (ids.has(schedule.id)) {
      throw new ApiError(400, "Schedule ids must be unique");
    }
    ids.add(schedule.id);

    if (!schedule.label) {
      throw new ApiError(400, `Schedule ${index + 1} label is required`);
    }

    if (!/^\d{2}:\d{2}$/.test(schedule.departureTime)) {
      throw new ApiError(400, `Schedule ${index + 1} departure time is invalid`);
    }

    if (!/^\d{2}:\d{2}$/.test(schedule.arrivalTime)) {
      throw new ApiError(400, `Schedule ${index + 1} arrival time is invalid`);
    }
  });
};

const normalizeBusTravelDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new ApiError(400, "Travel date is required");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Travel date is invalid");
  }

  return parsed.toISOString().slice(0, 10);
};

const getBusTravelDayLabel = (travelDate) => BUS_DAY_OPTIONS[new Date(travelDate).getUTCDay()] || "Mon";

const findBusSchedule = (busService, scheduleId) => {
  const schedules = Array.isArray(busService?.schedules) ? busService.schedules : [];
  return schedules.find((item) => String(item?.id || "") === String(scheduleId || ""));
};

const isScheduleAvailableOnDate = (schedule, travelDate) => {
  if (!schedule || String(schedule.status || "draft") !== "active") {
    return false;
  }

  const activeDays = Array.isArray(schedule.activeDays) ? schedule.activeDays : [];
  if (activeDays.length === 0) {
    return true;
  }

  return activeDays.includes(getBusTravelDayLabel(travelDate));
};

const flattenBusBlueprintSeats = (blueprint = {}) =>
  ["lowerDeck", "upperDeck"].flatMap((deckKey) =>
    (Array.isArray(blueprint?.[deckKey]) ? blueprint[deckKey] : []).flatMap((row) =>
      (Array.isArray(row) ? row : []).filter((cell) => String(cell?.kind || "") === "seat"),
    ),
  );

const buildBusDriverSeatLayout = async ({ busService, scheduleId, travelDate }) => {
  const activeHolds = await BusSeatHold.find({
    busServiceId: busService._id,
    scheduleId,
    travelDate,
    status: { $in: ["held", "booked"] },
  })
    .select("seatId")
    .lean();

  const reservedSeatIds = new Set(activeHolds.map((item) => String(item.seatId || "")));

  const normalizeDeck = (deckRows = []) =>
    (Array.isArray(deckRows) ? deckRows : []).map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => {
        if (String(cell?.kind || "") !== "seat") {
          return {
            kind: "aisle",
            id: "",
            label: "",
            variant: "seat",
            status: "available",
          };
        }

        const seatId = String(cell.id || "");
        const isBlocked = String(cell.status || "available") === "blocked";
        const isReserved = reservedSeatIds.has(seatId);

        return {
          ...cell,
          status: isBlocked || isReserved ? "booked" : "available",
        };
      }),
    );

  const blueprint = {
    templateKey: busService.blueprint?.templateKey || "seater_2_2",
    lowerDeck: normalizeDeck(busService.blueprint?.lowerDeck || []),
    upperDeck: normalizeDeck(busService.blueprint?.upperDeck || []),
  };

  const availableSeats = flattenBusBlueprintSeats(blueprint).filter(
    (seat) => String(seat.status || "available") === "available",
  ).length;

  return {
    busServiceId: String(busService._id),
    scheduleId,
    travelDate,
    availableSeats,
    blueprint,
  };
};

const serializeBusDriverBooking = (booking = {}) => ({
  id: String(booking._id || ""),
  bookingCode: booking.bookingCode || "",
  status: booking.status || "pending",
  bookingSource: booking.bookingSource || "user",
  travelDate: booking.travelDate || "",
  scheduleId: booking.scheduleId || "",
  seatIds: Array.isArray(booking.seatIds) ? booking.seatIds : [],
  seatLabels: Array.isArray(booking.seatLabels) ? booking.seatLabels : [],
  amount: Number(booking.amount || 0),
  currency: booking.currency || "INR",
  passenger: booking.passenger || {},
  notes: booking.notes || "",
  payment: booking.payment || {},
  routeSnapshot: booking.routeSnapshot || {},
  createdAt: booking.createdAt || null,
});

const serializeBusDriverProfile = async (busDriver) => {
  const assignedBusServiceId = busDriver.assignedBusServiceId
    ? String(busDriver.assignedBusServiceId)
    : "";
  const busService = assignedBusServiceId
    ? await BusService.findById(assignedBusServiceId).lean()
    : null;

  const upcomingBookingsCount = assignedBusServiceId
    ? await BusBooking.countDocuments({
        busServiceId: assignedBusServiceId,
        status: { $in: ["pending", "confirmed"] },
      })
    : 0;

  const recentBookings = assignedBusServiceId
    ? await BusBooking.find({ busServiceId: assignedBusServiceId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    : [];

  return {
    id: busDriver._id,
    accountType: "bus_driver",
    name: busDriver.name || "",
    phone: busDriver.phone || "",
    email: busDriver.email || "",
    approve: busDriver.approve,
    active: busDriver.active,
    status: busDriver.status || "approved",
    assignedBusServiceId,
    busService: busService
      ? {
          id: String(busService._id),
          operatorName: busService.operatorName || "",
          busName: busService.busName || "",
          serviceNumber: busService.serviceNumber || "",
          registrationNumber: busService.registrationNumber || "",
          coachType: busService.coachType || "",
          busCategory: busService.busCategory || "",
          seatPrice: Number(busService.seatPrice || 0),
          fareCurrency: busService.fareCurrency || "INR",
          driverName: busService.driverName || "",
          driverPhone: busService.driverPhone || "",
          route: busService.route || {},
          schedules: Array.isArray(busService.schedules) ? busService.schedules : [],
          amenities: Array.isArray(busService.amenities) ? busService.amenities : [],
          capacity: Number(busService.capacity || 0),
          status: busService.status || "draft",
        }
      : null,
    metrics: {
      upcomingBookings: upcomingBookingsCount,
      totalSchedules: Array.isArray(busService?.schedules) ? busService.schedules.length : 0,
      totalCapacity: Number(busService?.capacity || 0),
    },
    recentBookings: recentBookings.map(serializeBusDriverBooking),
  };
};

const getIstDayStart = (value = new Date()) => {
  const timestamp = new Date(value).getTime();
  const shifted = timestamp + IST_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStartShifted - IST_OFFSET_MS);
};

const getIstWeekKey = (value = new Date()) => {
  const dayStart = getIstDayStart(value);
  const shifted = dayStart.getTime() + IST_OFFSET_MS;
  const shiftedDate = new Date(shifted);
  const day = shiftedDate.getUTCDay();
  const mondayDistance = day === 0 ? 6 : day - 1;
  const weekStart = new Date(dayStart.getTime() - mondayDistance * DAY_MS);
  return toIstDayKey(weekStart);
};

const getIstMonthKey = (value = new Date()) => {
  const shifted = new Date(new Date(value).getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getConfiguredAppName = async () => {
  try {
    const settings = await AdminBusinessSetting.findOne({ scope: "default" })
      .select("general.app_name")
      .lean();

    return String(settings?.general?.app_name || "").trim() || "App";
  } catch {
    return "App";
  }
};

const pruneDailyActivity = (items = []) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => item?.date)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    .slice(-120);

const pruneClaimedRewards = (items = []) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => item?.rewardType && item?.rewardKey)
    .sort((left, right) => new Date(left.claimedAt || 0) - new Date(right.claimedAt || 0))
    .slice(-200);

const appendDailyActivityMinutes = (dailyActivity = [], dateKey, minutes) => {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  if (!dateKey || safeMinutes <= 0) {
    return pruneDailyActivity(dailyActivity);
  }

  const next = [...(Array.isArray(dailyActivity) ? dailyActivity : [])];
  const index = next.findIndex((item) => item?.date === dateKey);

  if (index >= 0) {
    next[index] = {
      ...next[index],
      activeMinutes: Math.round((Number(next[index]?.activeMinutes || 0) + safeMinutes) * 100) / 100,
    };
  } else {
    next.push({
      date: dateKey,
      activeMinutes: Math.round(safeMinutes * 100) / 100,
    });
  }

  return pruneDailyActivity(next);
};

const mergeOnlineSessionIntoTracking = (tracking = {}, sessionStart, sessionEnd = new Date()) => {
  const start = sessionStart ? new Date(sessionStart) : null;
  const end = sessionEnd ? new Date(sessionEnd) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      ...tracking,
      dailyActivity: pruneDailyActivity(tracking?.dailyActivity),
    };
  }

  let cursor = new Date(start);
  let nextDailyActivity = Array.isArray(tracking?.dailyActivity) ? [...tracking.dailyActivity] : [];

  while (cursor < end) {
    const nextDayStart = new Date(getIstDayStart(cursor).getTime() + DAY_MS);
    const segmentEnd = nextDayStart < end ? nextDayStart : end;
    const minutes = (segmentEnd.getTime() - cursor.getTime()) / 60000;
    nextDailyActivity = appendDailyActivityMinutes(nextDailyActivity, toIstDayKey(cursor), minutes);
    cursor = segmentEnd;
  }

  return {
    ...tracking,
    dailyActivity: nextDailyActivity,
  };
};

const collectWeekWindows = (count = 1, fromDate = new Date()) => {
  const total = Math.max(1, Number(count || 1));
  const windows = [];
  const currentDayStart = getIstDayStart(fromDate);
  const shifted = currentDayStart.getTime() + IST_OFFSET_MS;
  const shiftedDate = new Date(shifted);
  const day = shiftedDate.getUTCDay();
  const mondayDistance = day === 0 ? 6 : day - 1;
  const currentWeekStart = new Date(currentDayStart.getTime() - mondayDistance * DAY_MS);

  for (let index = 0; index < total; index += 1) {
    const start = new Date(currentWeekStart.getTime() - index * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    windows.unshift({
      key: toIstDayKey(start),
      start,
      end,
    });
  }

  return windows;
};

const countCompletedRidesInRange = (rides = [], start, end) =>
  rides.filter((ride) => {
    const status = String(ride?.status || "").toLowerCase();
    const liveStatus = String(ride?.liveStatus || "").toLowerCase();
    if (!["completed", "delivered"].includes(status) && !["completed", "delivered"].includes(liveStatus)) {
      return false;
    }

    const rideDate = new Date(ride?.completedAt || ride?.updatedAt || ride?.createdAt || 0);
    return rideDate >= start && rideDate < end;
  }).length;

const countPeakHourTripsInRange = (rides = [], start, end) =>
  rides.filter((ride) => {
    const status = String(ride?.status || "").toLowerCase();
    const liveStatus = String(ride?.liveStatus || "").toLowerCase();
    if (!["completed", "delivered"].includes(status) && !["completed", "delivered"].includes(liveStatus)) {
      return false;
    }
    const rideDate = new Date(ride?.completedAt || ride?.updatedAt || ride?.createdAt || 0);
    if (!(rideDate >= start && rideDate < end)) {
      return false;
    }
    const hour = new Date(rideDate.getTime() + IST_OFFSET_MS).getUTCHours();
    return (hour >= 7 && hour < 11) || (hour >= 17 && hour < 21);
  }).length;

const getCurrentActiveStreak = (dailyActivity = [], minimumMinutes = 1) => {
  const activityMap = new Map((Array.isArray(dailyActivity) ? dailyActivity : []).map((item) => [item.date, Number(item.activeMinutes || 0)]));
  let streak = 0;
  let cursor = getIstDayStart(new Date());

  while (true) {
    const key = toIstDayKey(cursor);
    const minutes = Number(activityMap.get(key) || 0);
    if (minutes < minimumMinutes) {
      break;
    }
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return streak;
};

const hasClaimedReward = (claimedRewards = [], rewardType, rewardKey, periodKey) =>
  (Array.isArray(claimedRewards) ? claimedRewards : []).some((item) =>
    item?.rewardType === rewardType &&
    item?.rewardKey === rewardKey &&
    item?.periodKey === periodKey,
  );

const buildDriverIncentiveSnapshot = ({ driver, settings, rides }) => {
  const tracking = driver?.incentiveTracking || {};
  const dailyActivity = Array.isArray(tracking.dailyActivity) ? tracking.dailyActivity : [];
  const claimedRewards = Array.isArray(tracking.claimedRewards) ? tracking.claimedRewards : [];
  const milestonePrograms = Array.isArray(settings?.milestone_programs) ? settings.milestone_programs : [];
  const rewardFeatures = Array.isArray(settings?.reward_features) ? settings.reward_features : [];
  const dailyActivityMap = new Map(dailyActivity.map((item) => [item.date, Number(item.activeMinutes || 0)]));

  const milestones = milestonePrograms.map((item, index) => {
    const requiredWeeks = Math.max(1, Number(item.required_weeks || 1));
    const requiredHours = Math.max(0, Number(item.active_hours_per_day || 0));
    const minTripsPerWeek = Math.max(0, Number(item.min_trips_per_week || 0));
    const weekWindows = collectWeekWindows(requiredWeeks, new Date());
    const qualifyingWeeks = weekWindows.filter((week) => {
      const tripCount = countCompletedRidesInRange(rides, week.start, week.end);
      return tripCount >= minTripsPerWeek;
    }).length;

    const targetDays = requiredWeeks * 7;
    let qualifyingDays = 0;
    for (let offset = 0; offset < targetDays; offset += 1) {
      const day = new Date(getIstDayStart(new Date()).getTime() - offset * DAY_MS);
      const dayKey = toIstDayKey(day);
      if ((Number(dailyActivityMap.get(dayKey) || 0) / 60) >= requiredHours) {
        qualifyingDays += 1;
      }
    }

    const periodKey = `milestone:${item.id || index}`;
    const eligible = Boolean(item.enabled) && qualifyingWeeks >= requiredWeeks && qualifyingDays >= targetDays;

    return {
      ...item,
      periodKey,
      progress: {
        qualifyingWeeks,
        targetWeeks: requiredWeeks,
        qualifyingDays,
        targetDays,
      },
      isEligible: eligible,
      isClaimed: hasClaimedReward(claimedRewards, "milestone", item.id || String(index), periodKey),
    };
  });

  const currentWeekWindow = collectWeekWindows(1, new Date())[0];
  const currentWeekTrips = currentWeekWindow ? countCompletedRidesInRange(rides, currentWeekWindow.start, currentWeekWindow.end) : 0;
  const currentPeakTrips = currentWeekWindow ? countPeakHourTripsInRange(rides, currentWeekWindow.start, currentWeekWindow.end) : 0;
  const currentStreak = getCurrentActiveStreak(dailyActivity, 1);
  const weekendCount = collectWeekWindows(4, new Date()).reduce((total, week) => {
    const saturday = new Date(week.start.getTime() + 5 * DAY_MS);
    const sunday = new Date(week.start.getTime() + 6 * DAY_MS);
    const weekendTrips = countCompletedRidesInRange(rides, saturday, new Date(sunday.getTime() + DAY_MS));
    return total + (weekendTrips > 0 ? 1 : 0);
  }, 0);
  const currentMonthKey = getIstMonthKey(new Date());
  const monthStart = new Date(`${currentMonthKey}-01T00:00:00.000Z`);
  const monthCompleted = rides.filter((ride) => {
    const status = String(ride?.status || "").toLowerCase();
    const liveStatus = String(ride?.liveStatus || "").toLowerCase();
    if (!["completed", "delivered"].includes(status) && !["completed", "delivered"].includes(liveStatus)) {
      return false;
    }
    const rideDate = new Date(ride?.completedAt || ride?.updatedAt || ride?.createdAt || 0);
    return getIstMonthKey(rideDate) === currentMonthKey;
  }).length;
  const monthCancelled = rides.filter((ride) => {
    const status = String(ride?.status || "").toLowerCase();
    return status === "cancelled" && getIstMonthKey(new Date(ride?.updatedAt || ride?.createdAt || 0)) === currentMonthKey;
  }).length;
  const cancellationRate = monthCompleted + monthCancelled > 0
    ? Number(((monthCancelled / (monthCompleted + monthCancelled)) * 100).toFixed(2))
    : 0;

  const features = rewardFeatures.map((item, index) => {
    const key = item.key || item.id || `feature_${index + 1}`;
    let currentValue = 0;
    let periodKey = key;

    switch (key) {
      case "daily_active_streak":
        currentValue = currentStreak;
        periodKey = `${key}:${getIstWeekKey(new Date())}`;
        break;
      case "weekly_trip_quest":
        currentValue = currentWeekTrips;
        periodKey = `${key}:${getIstWeekKey(new Date())}`;
        break;
      case "peak_hour_booster":
        currentValue = currentPeakTrips;
        periodKey = `${key}:${getIstWeekKey(new Date())}`;
        break;
      case "weekend_warrior":
        currentValue = weekendCount;
        periodKey = `${key}:${currentMonthKey}`;
        break;
      case "rating_guard":
        currentValue = Number(driver?.rating || 0);
        periodKey = `${key}:${currentMonthKey}`;
        break;
      case "cancellation_guard":
        currentValue = cancellationRate;
        periodKey = `${key}:${currentMonthKey}`;
        break;
      default:
        currentValue = Number(item.target_value || 0);
        periodKey = `${key}:${currentMonthKey}`;
        break;
    }

    const target = Number(item.target_value || 0);
    const isEligible = key === "cancellation_guard"
      ? currentValue <= target
      : currentValue >= target;

    return {
      ...item,
      key,
      periodKey,
      currentValue,
      targetValue: target,
      isEligible: Boolean(item.enabled) && isEligible,
      isClaimed: hasClaimedReward(claimedRewards, "feature", key, periodKey),
    };
  });

  return {
    settings: {
      enabled: Boolean(settings?.enabled),
      milestone_program_enabled: Boolean(settings?.milestone_program_enabled),
      type: settings?.type || "instant_referrer",
    },
    summary: {
      streakDays: currentStreak,
      currentWeekTrips,
      currentPeakTrips,
      weekendCount,
      monthCancellationRate: cancellationRate,
      totalClaimedRewards: claimedRewards.length,
    },
    milestones,
    features,
    claimedRewards,
    walletBalance: Number(driver?.wallet?.balance || 0),
  };
};

const normalizePaymentAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }

  if (amount > RAZORPAY_QR_MAX_AMOUNT) {
    throw new ApiError(400, "amount is too large for QR collection");
  }

  return Math.round(amount * 100);
};

const getRazorpayEnvCredentials = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured in backend .env");
  }

  return { keyId, keySecret };
};

const razorpayRequest = async ({ method, path, body }) => {
  const { keyId, keySecret } = getRazorpayEnvCredentials();
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status || 502,
      payload?.error?.description ||
        payload?.error?.message ||
        "Razorpay QR request failed",
      {
        provider: "razorpay",
        path,
        code: payload?.error?.code || null,
      },
    );
  }

  return payload;
};

const shouldFallbackToPaymentLinkQr = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.statusCode === 404 ||
    message.includes("requested url was not found") ||
    message.includes("qr") && message.includes("not") && message.includes("enabled")
  );
};

const shouldFallbackToStandardPaymentLink = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("upi payment links are not supported in test mode") ||
    message.includes("upi payment link") && message.includes("test mode")
  );
};

const buildPaymentLinkBody = ({ amountInPaise, rideId, driverId, serviceType, expireBy, referenceId, upiLink }) => ({
  ...(upiLink ? { upi_link: true } : {}),
  amount: amountInPaise,
  currency: "INR",
  accept_partial: false,
  expire_by: expireBy,
  reference_id: referenceId,
  description: `Taxi fare for ride ${rideId}`,
  reminder_enable: false,
  notes: {
    rideId: String(rideId),
    driverId: String(driverId),
    serviceType: serviceType || "ride",
    source: "driver_collect_amount",
    fallback: upiLink ? "upi_payment_link_qr" : "standard_payment_link_qr",
  },
});

const createPaymentLinkQr = async ({ amountInPaise, rideId, driverId, serviceType }) => {
  const referenceId = `ride_${String(rideId).slice(-18)}_${Date.now().toString(36)}`.slice(0, 40);
  const expireBy = Math.floor(Date.now() / 1000) + 30 * 60;
  let providerMode = "upi_payment_link_qr";
  let paymentLink;

  try {
    paymentLink = await razorpayRequest({
      method: "POST",
      path: "/payment_links",
      body: buildPaymentLinkBody({
        amountInPaise,
        rideId,
        driverId,
        serviceType,
        expireBy,
        referenceId,
        upiLink: true,
      }),
    });
  } catch (error) {
    if (!shouldFallbackToStandardPaymentLink(error)) {
      throw error;
    }

    providerMode = "standard_payment_link_qr";
    paymentLink = await razorpayRequest({
      method: "POST",
      path: "/payment_links",
      body: buildPaymentLinkBody({
        amountInPaise,
        rideId,
        driverId,
        serviceType,
        expireBy,
        referenceId: `${referenceId}_std`.slice(0, 40),
        upiLink: false,
      }),
    });
  }

  const paymentUrl = paymentLink.short_url || paymentLink.shortUrl || paymentLink.url;

  if (!paymentUrl) {
    throw new ApiError(502, "Razorpay payment link was created without a payment URL");
  }

  const imageUrl = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
  });

  return {
    id: paymentLink.id,
    entity: paymentLink.entity || "payment_link",
    status: paymentLink.status || "created",
    imageUrl,
    linkUrl: paymentUrl,
    amount: amountInPaise / 100,
    currency: "INR",
    description: paymentLink.description,
    closeBy: paymentLink.expire_by || expireBy,
    rawStatus: paymentLink.status || "created",
    providerMode,
  };
};

const PAYMENT_PAID_STATUSES = new Set(["paid", "captured", "completed"]);
const PAYMENT_OPEN_STATUSES = new Set(["created", "active", "issued", "partially_paid"]);

const normalizeCollectionStatus = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (PAYMENT_PAID_STATUSES.has(normalized)) {
    return "paid";
  }

  if (PAYMENT_OPEN_STATUSES.has(normalized)) {
    return normalized === "partially_paid" ? "active" : normalized;
  }

  if (normalized === "closed") {
    return "closed";
  }

  if (["cancelled", "canceled", "expired", "failed"].includes(normalized)) {
    return normalized === "canceled" ? "cancelled" : normalized;
  }

  return normalized || "pending";
};

const getPaymentCollectionPath = ({ providerId, providerMode }) => {
  if (!providerId) {
    throw new ApiError(400, "payment collection id is required");
  }

  if (String(providerMode || "").includes("payment_link")) {
    return `/payment_links/${providerId}`;
  }

  return `/payments/qr_codes/${providerId}`;
};

const serializeDriverPaymentCollection = (collection = {}) => {
  const status = normalizeCollectionStatus(collection.status);

  return {
    provider: collection.provider || "razorpay",
    id: collection.providerId || collection.id || "",
    providerMode: collection.providerMode || "",
    status,
    paid: PAYMENT_PAID_STATUSES.has(status),
    amount: Number(collection.amount || 0),
    currency: collection.currency || "INR",
    linkUrl: collection.linkUrl || "",
    paidAt: collection.paidAt || null,
    updatedAt: collection.updatedAt || null,
  };
};

const refreshDriverPaymentCollection = async (ride) => {
  const collection = ride?.driverPaymentCollection || {};
  const providerId = String(collection.providerId || "").trim();

  if (!providerId) {
    return serializeDriverPaymentCollection(collection);
  }

  const providerMode = collection.providerMode || "";
  const providerPayload = await razorpayRequest({
    method: "GET",
    path: getPaymentCollectionPath({ providerId, providerMode }),
  });
  const receivedAmount = Number(
    providerPayload?.amount_paid ||
      providerPayload?.amount_paid_total ||
      providerPayload?.payments_amount_received ||
      providerPayload?.amount_received ||
      0,
  );
  const expectedAmount = Number(collection.amount || 0) * 100;
  const isProviderAmountPaid = expectedAmount > 0 && receivedAmount >= expectedAmount;
  const providerStatus = normalizeCollectionStatus(providerPayload?.status);
  const isPaid = PAYMENT_PAID_STATUSES.has(providerStatus) || isProviderAmountPaid;
  const nextStatus = isPaid ? "paid" : providerStatus;
  const nextCollection = {
    provider: "razorpay",
    providerId,
    providerMode,
    status: nextStatus,
    amount: Number(collection.amount || 0),
    currency: collection.currency || "INR",
    linkUrl: collection.linkUrl || providerPayload?.short_url || providerPayload?.url || "",
    paidAt: isPaid ? collection.paidAt || new Date() : collection.paidAt || null,
    updatedAt: new Date(),
  };

  ride.driverPaymentCollection = nextCollection;
  await ride.save();

  return serializeDriverPaymentCollection(nextCollection);
};

const sanitizeEmergencyPhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

const serializeEmergencyContact = (contact = {}) => ({
  id: String(contact._id || contact.id || ""),
  name: String(contact.name || "").trim(),
  phone: sanitizeEmergencyPhone(contact.phone),
  source:
    String(contact.source || "manual").toLowerCase() === "device"
      ? "device"
      : "manual",
});

const resolveVehicleMapIcon = async (vehicleTypeId) => {
  if (!vehicleTypeId) {
    return "";
  }

  const vehicle = await Vehicle.findById(vehicleTypeId).select("icon map_icon image").lean();
  return vehicle?.map_icon || vehicle?.icon || vehicle?.image || "";
};

const normalizePhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const isOwnerApproved = (owner) =>
  Boolean(owner) &&
  owner.active !== false &&
  (owner.approve === true ||
    String(owner.status || "").toLowerCase() === "approved");

const resolveOwnerForFleet = async (requester = {}) => {
  const onboardingRole = String(
    requester?.onboarding?.role || "",
  ).toLowerCase();
  const convertedOwnerId = requester?.onboarding?.convertedOwnerId || null;

  if (onboardingRole === "owner" && convertedOwnerId) {
    const owner = await Owner.findById(convertedOwnerId)
      .select("service_location_id active approve status")
      .lean();
    if (isOwnerApproved(owner)) return owner;
  }

  const mobile = String(requester?.phone || "").trim();
  const email = String(requester?.email || "")
    .trim()
    .toLowerCase();

  if (!mobile && !email) {
    return null;
  }

  const owner = await Owner.findOne({
    $or: [...(mobile ? [{ mobile }] : []), ...(email ? [{ email }] : [])],
  })
    .select("service_location_id active approve status")
    .lean();

  return isOwnerApproved(owner) ? owner : null;
};

const resolveAuthenticatedOwner = async (req) => {
  if (String(req.auth?.role || "").toLowerCase() === "owner") {
    const owner = await Owner.findById(req.auth?.sub)
      .select("name company_name owner_name mobile phone email city transport_type service_location_id active approve status wallet")
      .lean();
    return isOwnerApproved(owner) ? owner : null;
  }

  const requester = await Driver.findById(req.auth?.sub)
    .select("onboarding phone email service_location_id")
    .lean();

  if (!requester) {
    return null;
  }

  return resolveOwnerForFleet(requester);
};

const serializeOwnerProfile = (owner = {}) => ({
  id: owner._id,
  name: owner.owner_name || owner.name || owner.company_name || "Owner",
  phone: owner.mobile || owner.phone || "",
  email: owner.email || "",
  profileImage: "",
  gender: "",
  vehicleType: owner.transport_type || "taxi",
  vehicleTypeId: null,
  vehicleIconType: owner.transport_type || "taxi",
  vehicleIconUrl: "",
  vehicleMake: owner.company_name || "",
  vehicleModel: "",
  registerFor: owner.transport_type || "taxi",
  vehicleNumber: "",
  vehicleColor: "",
  vehicleImage: "",
  city: owner.city || "",
  approve: owner.approve,
  status: owner.status || "approved",
  rating: 0,
  wallet: {
    balance: Number(owner.wallet?.balance || 0),
    currency: "INR",
  },
  referralCode: "",
  deletionRequest: { status: "none" },
  isOnline: false,
  isOnRide: false,
  onlineSelfie: {},
  location: null,
  zoneId: null,
  documents: {},
  emergencyContacts: [],
  onboarding: {
    role: "owner",
    convertedOwnerId: String(owner._id || ""),
  },
});

const serializeServiceCenterProfile = (center = {}) => ({
  id: center._id,
  name: center.name || "Service Center",
  phone: center.owner_phone || "",
  email: "",
  profileImage: "",
  gender: "",
  vehicleType: "rental",
  vehicleTypeId: null,
  vehicleIconType: "car",
  vehicleIconUrl: "",
  vehicleMake: center.name || "",
  vehicleModel: "",
  registerFor: "service_center",
  vehicleNumber: "",
  vehicleColor: "",
  vehicleImage: "",
  city: center.service_location_id?.name || center.service_location_id?.service_location_name || "",
  approve: true,
  status: center.status || "active",
  rating: 0,
  wallet: {
    balance: 0,
    currency: "INR",
  },
  referralCode: "",
  deletionRequest: { status: "none" },
  isOnline: false,
  isOnRide: false,
  onlineSelfie: {},
  location:
    Number.isFinite(Number(center.longitude)) && Number.isFinite(Number(center.latitude))
      ? {
          type: "Point",
          coordinates: [Number(center.longitude), Number(center.latitude)],
        }
      : null,
  zoneId: center.zone_id?._id || center.zone_id || null,
  documents: {},
  emergencyContacts: [],
  ownerName: center.owner_name || "",
  ownerPhone: center.owner_phone || "",
  address: center.address || "",
  latitude: Number(center.latitude ?? 0),
  longitude: Number(center.longitude ?? 0),
  zone: center.zone_id
    ? {
        id: center.zone_id._id || center.zone_id,
        name: center.zone_id.name || "",
      }
    : null,
  serviceLocation: center.service_location_id
    ? {
        id: center.service_location_id._id || center.service_location_id,
        name: center.service_location_id.service_location_name || center.service_location_id.name || "",
        country: center.service_location_id.country || "",
      }
    : null,
  onboarding: {
    role: "service_center",
  },
});

const serializeServiceCenterStaffProfile = (staff = {}, center = null) => ({
  id: staff._id,
  name: staff.name || "Service Center Staff",
  phone: staff.phone || "",
  email: "",
  profileImage: "",
  gender: "",
  vehicleType: "rental",
  vehicleTypeId: null,
  vehicleIconType: "car",
  vehicleIconUrl: "",
  vehicleMake: center?.name || "",
  vehicleModel: "",
  registerFor: "service_center_staff",
  vehicleNumber: "",
  vehicleColor: "",
  vehicleImage: "",
  city: center?.service_location_id?.name || center?.service_location_id?.service_location_name || "",
  approve: true,
  status: staff.status || "active",
  rating: 0,
  wallet: {
    balance: 0,
    currency: "INR",
  },
  referralCode: "",
  deletionRequest: { status: "none" },
  isOnline: false,
  isOnRide: false,
  onlineSelfie: {},
  location: null,
  zoneId: center?.zone_id?._id || center?.zone_id || null,
  documents: {},
  emergencyContacts: [],
  ownerName: center?.owner_name || "",
  ownerPhone: center?.owner_phone || "",
  address: center?.address || "",
  latitude: Number(center?.latitude ?? 0),
  longitude: Number(center?.longitude ?? 0),
  zone: center?.zone_id
    ? {
        id: center.zone_id._id || center.zone_id,
        name: center.zone_id.name || "",
      }
    : null,
  serviceLocation: center?.service_location_id
    ? {
        id: center.service_location_id._id || center.service_location_id,
        name: center.service_location_id.service_location_name || center.service_location_id.name || "",
        country: center.service_location_id.country || "",
      }
    : null,
  serviceCenterId: center?._id ? String(center._id) : "",
  onboarding: {
    role: "service_center_staff",
  },
});

const serializeServiceCenterStaff = (staff = {}, bookingCount = 0) => ({
  id: String(staff._id || ""),
  _id: staff._id,
  name: staff.name || "",
  phone: staff.phone || "",
  active: staff.active !== false,
  status: staff.status || "active",
  bookingCount: Number(bookingCount || 0),
  createdAt: staff.createdAt || null,
  updatedAt: staff.updatedAt || null,
});

const serializeServiceCenterBooking = (item = {}) => ({
  id: String(item._id || item.id || ""),
  _id: item._id,
  bookingReference: item.bookingReference || "",
  customer: {
    id: item.userId?._id ? String(item.userId._id) : "",
    name: item.userId?.name || item.contactName || "",
    phone: item.userId?.phone || item.contactPhone || "",
    email: item.userId?.email || item.contactEmail || "",
  },
  customerDocuments: {
    drivingLicense: {
      imageUrl: item.kycDocuments?.drivingLicense?.imageUrl || "",
      fileName: item.kycDocuments?.drivingLicense?.fileName || "",
      uploadedAt: item.kycDocuments?.drivingLicense?.uploadedAt || null,
    },
    aadhaarCard: {
      imageUrl: item.kycDocuments?.aadhaarCard?.imageUrl || "",
      fileName: item.kycDocuments?.aadhaarCard?.fileName || "",
      uploadedAt: item.kycDocuments?.aadhaarCard?.uploadedAt || null,
    },
  },
  vehicleName: item.vehicleName || item.vehicleTypeId?.name || "",
  vehicleCategory: item.vehicleCategory || item.vehicleTypeId?.vehicleCategory || "",
  vehicleImage: item.vehicleImage || item.vehicleTypeId?.image || "",
  vehicleCoverImage: item.vehicleTypeId?.coverImage || "",
  vehicleGalleryImages: Array.isArray(item.vehicleTypeId?.galleryImages)
    ? item.vehicleTypeId.galleryImages.filter(Boolean)
    : [],
  vehicleAmenities: Array.isArray(item.vehicleTypeId?.amenities)
    ? item.vehicleTypeId.amenities.filter(Boolean)
    : [],
  selectedPackage: {
    packageId: item.selectedPackage?.packageId || "",
    label: item.selectedPackage?.label || "",
    durationHours: Number(item.selectedPackage?.durationHours || 0),
    price: Number(item.selectedPackage?.price || 0),
  },
  serviceLocation: {
    locationId: item.serviceLocation?.locationId || "",
    name: item.serviceLocation?.name || "",
    address: item.serviceLocation?.address || "",
    city: item.serviceLocation?.city || "",
  },
  pickupDateTime: item.pickupDateTime || null,
  returnDateTime: item.returnDateTime || null,
  requestedHours: Number(item.requestedHours || 0),
  totalCost: Number(item.totalCost || 0),
  payableNow: Number(item.payableNow || 0),
  paymentStatus: item.paymentStatus || "pending",
  assignedVehicle: {
    vehicleId: item.assignedVehicle?.vehicleId ? String(item.assignedVehicle.vehicleId) : "",
    name: item.assignedVehicle?.name || "",
    vehicleCategory: item.assignedVehicle?.vehicleCategory || "",
    image: item.assignedVehicle?.image || "",
  },
  serviceCenterIds: Array.isArray(item.serviceCenterIds)
    ? item.serviceCenterIds.map((centerId) => String(centerId))
    : [],
  assignedStaff: {
    id: item.assignedStaffId ? String(item.assignedStaffId) : "",
    name: item.assignedStaffName || "",
    phone: item.assignedStaffPhone || "",
  },
  rentalInspection: {
    beforeHandover: {
      exteriorOk: item.rentalInspection?.beforeHandover?.exteriorOk === true,
      interiorOk: item.rentalInspection?.beforeHandover?.interiorOk === true,
      dashboardOk: item.rentalInspection?.beforeHandover?.dashboardOk === true,
      tyresOk: item.rentalInspection?.beforeHandover?.tyresOk === true,
      fuelOk: item.rentalInspection?.beforeHandover?.fuelOk === true,
      documentsOk: item.rentalInspection?.beforeHandover?.documentsOk === true,
    },
    afterReturn: {
      exteriorChecked: item.rentalInspection?.afterReturn?.exteriorChecked === true,
      interiorChecked: item.rentalInspection?.afterReturn?.interiorChecked === true,
      dashboardChecked: item.rentalInspection?.afterReturn?.dashboardChecked === true,
      fuelChecked: item.rentalInspection?.afterReturn?.fuelChecked === true,
      tyresChecked: item.rentalInspection?.afterReturn?.tyresChecked === true,
      damageReviewed: item.rentalInspection?.afterReturn?.damageReviewed === true,
    },
    pickupNotes: item.rentalInspection?.pickupNotes || "",
    returnNotes: item.rentalInspection?.returnNotes || "",
    pickupMeterReading:
      item.rentalInspection?.pickupMeterReading === null ||
      item.rentalInspection?.pickupMeterReading === undefined
        ? null
        : Number(item.rentalInspection.pickupMeterReading),
    returnMeterReading:
      item.rentalInspection?.returnMeterReading === null ||
      item.rentalInspection?.returnMeterReading === undefined
        ? null
        : Number(item.rentalInspection.returnMeterReading),
    pickupFuelLevel: item.rentalInspection?.pickupFuelLevel || "",
    returnFuelLevel: item.rentalInspection?.returnFuelLevel || "",
    beforeConditionImages: Array.isArray(item.rentalInspection?.beforeConditionImages)
      ? item.rentalInspection.beforeConditionImages.filter(Boolean)
      : [],
    afterConditionImages: Array.isArray(item.rentalInspection?.afterConditionImages)
      ? item.rentalInspection.afterConditionImages.filter(Boolean)
      : [],
  },
  serviceCenterNote: item.serviceCenterNote || "",
  status: item.status || "pending",
  assignedAt: item.assignedAt || null,
  completedAt: item.completedAt || null,
  createdAt: item.createdAt || null,
  updatedAt: item.updatedAt || null,
});

const resolveAuthenticatedServiceCenter = async (req) => {
  if (String(req.auth?.role || "").toLowerCase() !== "service_center") {
    return null;
  }

  const center = await ServiceStore.findById(req.auth?.sub)
    .populate("zone_id", "name")
    .populate("service_location_id", "name service_location_name country")
    .lean();

  if (!center || center.active === false || String(center.status || "").toLowerCase() === "inactive") {
    return null;
  }

  return center;
};

const resolveAuthenticatedServiceCenterAccess = async (req) => {
  const role = String(req.auth?.role || "").toLowerCase();

  if (role === "service_center") {
    const center = await resolveAuthenticatedServiceCenter(req);
    if (!center) return null;
    return {
      role,
      center,
      staff: null,
      canManageStaff: true,
      canManageVehicles: true,
      canAssignBookings: true,
    };
  }

  if (role !== "service_center_staff") {
    return null;
  }

  const staff = await ServiceCenterStaff.findById(req.auth?.sub).lean();
  if (!staff || staff.active === false || String(staff.status || "").toLowerCase() === "inactive") {
    return null;
  }

  const center = await ServiceStore.findById(staff.serviceCenterId)
    .populate("zone_id", "name")
    .populate("service_location_id", "name service_location_name country")
    .lean();

  if (!center || center.active === false || String(center.status || "").toLowerCase() === "inactive") {
    return null;
  }

  return {
    role,
    center,
    staff,
    canManageStaff: false,
    canManageVehicles: false,
    canAssignBookings: false,
  };
};

const serializeDriverNotification = (item = {}) => ({
  id: String(item._id || ""),
  title: String(item.push_title || "").trim(),
  body: String(item.message || "").trim(),
  image: String(item.image || "").trim(),
  sendTo: String(item.send_to || "all").trim(),
  serviceLocationName: String(item.service_location_name || "").trim(),
  sentAt: item.sent_at || item.createdAt || null,
  createdAt: item.createdAt || null,
});

const serializeDriverScheduledRide = (ride = {}, currentDriverId = "") => ({
  rideId: String(ride._id || ""),
  type: ride.serviceType || "ride",
  serviceType: ride.serviceType || "ride",
  status: ride.status || RIDE_STATUS.SEARCHING,
  liveStatus: ride.liveStatus || RIDE_LIVE_STATUS.SEARCHING,
  fare: Number(ride.fare || 0),
  baseFare: Number(ride.baseFare || ride.fare || 0),
  bookingMode: ride.bookingMode || "normal",
  estimatedDistanceMeters: Number(ride.estimatedDistanceMeters || 0),
  estimatedDurationMinutes: Number(ride.estimatedDurationMinutes || 0),
  paymentMethod: ride.paymentMethod || "cash",
  pickupLocation: ride.pickupLocation || null,
  pickupAddress: ride.pickupAddress || "",
  dropLocation: ride.dropLocation || null,
  dropAddress: ride.dropAddress || "",
  scheduledAt: ride.scheduledAt || null,
  parcel: ride.parcel || null,
  intercity: ride.intercity || null,
  driverId: ride.driverId ? String(ride.driverId) : null,
  isAssignedToCurrentDriver:
    Boolean(ride.driverId) && String(ride.driverId) === String(currentDriverId || ""),
  vehicleTypeId: ride.vehicleTypeId ? String(ride.vehicleTypeId) : null,
  vehicleTypeIds: Array.isArray(ride.dispatchVehicleTypeIds)
    ? ride.dispatchVehicleTypeIds.map((item) => String(item))
    : [],
  serviceLocationId: ride.service_location_id ? String(ride.service_location_id) : null,
  transportType: ride.transport_type || "taxi",
  user: ride.userId
    ? {
        id: String(ride.userId._id || ""),
        name: ride.userId.name || "Customer",
        phone: ride.userId.phone || "",
        countryCode: ride.userId.countryCode || "",
      }
    : null,
  createdAt: ride.createdAt || null,
  updatedAt: ride.updatedAt || null,
});

export const registerDriver = async (req, res) => {
  const { name, phone, password, vehicleType, location } = req.body;

  if (!name || !phone || !password || !vehicleType || !location) {
    throw new ApiError(
      400,
      "name, phone, password, vehicleType and location are required",
    );
  }

  const existingDriver = await Driver.findOne({ phone });

  if (existingDriver) {
    throw new ApiError(409, "Phone number is already registered");
  }

  const coordinates = normalizePoint(location, "location");
  const zone = await findZoneByPickup(coordinates);

  const driver = await Driver.create({
    name,
    phone,
    password: await hashPassword(password),
    vehicleType,
    approve: true,
    status: "approved",
    zoneId: zone?._id || null,
    location: toPoint(coordinates, "location"),
  });

  const token = signAccessToken({ sub: String(driver._id), role: "driver" });

  res.status(201).json({
    success: true,
    data: {
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        rating: driver.rating,
        status: driver.status,
      },
    },
  });
};

export const loginDriver = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(400, "phone and password are required");
  }

  const driver = await Driver.findOne({ phone }).select("+password");

  if (!driver || !(await comparePassword(password, driver.password))) {
    throw new ApiError(401, "Invalid phone or password");
  }

  if (
    driver.approve === false ||
    String(driver.status || "").toLowerCase() === "pending"
  ) {
    throw new ApiError(403, "Driver account is pending approval");
  }

  await clearDriverActiveRideIfStale(driver);

  const token = signAccessToken({ sub: String(driver._id), role: "driver" });

  res.json({
    success: true,
    data: {
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        isOnline: driver.isOnline,
        isOnRide: driver.isOnRide,
        status: driver.status,
      },
    },
  });
};

export const goOnline = async (req, res) => {
  const { location, selfieImageUrl } = req.body;

  const coordinates = normalizePoint(location, "location");
  const zone = await findZoneByPickup(coordinates);
  const existingDriver = await Driver.findById(req.auth.sub);

  if (!existingDriver) {
    throw new ApiError(404, "Driver not found");
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const hasTodaySelfie =
    String(existingDriver.onlineSelfie?.forDate || "") === todayKey &&
    String(existingDriver.onlineSelfie?.imageUrl || "").trim();

  if (!hasTodaySelfie && !String(selfieImageUrl || "").trim()) {
    throw new ApiError(400, "A selfie is required before going online today");
  }

  await ensureDriverWalletCanAcceptRide(existingDriver);
  await clearDriverActiveRideIfStale(existingDriver);
  const trackingBeforeOnline = mergeOnlineSessionIntoTracking(
    existingDriver.incentiveTracking || {},
    existingDriver.incentiveTracking?.currentOnlineStartedAt,
    new Date(),
  );

  const nextOnlineSelfie =
    hasTodaySelfie && !String(selfieImageUrl || "").trim()
      ? existingDriver.onlineSelfie
      : {
          imageUrl: String(selfieImageUrl || "").trim(),
          capturedAt: new Date(),
          uploadedAt: new Date(),
          forDate: todayKey,
        };

  const driver = await Driver.findByIdAndUpdate(
    req.auth.sub,
    {
      isOnline: true,
      zoneId: zone?._id || null,
      location: toPoint(coordinates, "location"),
      onlineSelfie: nextOnlineSelfie,
      incentiveTracking: {
        ...trackingBeforeOnline,
        currentOnlineStartedAt: new Date(),
        claimedRewards: pruneClaimedRewards(trackingBeforeOnline?.claimedRewards),
      },
    },
    { returnDocument: 'after' },
  );

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const vehicleIconUrl = await resolveVehicleMapIcon(driver.vehicleTypeId);

  res.json({
    success: true,
    data: {
      ...driver.toObject(),
      vehicleIconUrl,
      onlineSelfie: driver.onlineSelfie || {},
    },
  });

  notifyLateAvailableDriver(driver._id).catch((error) => {
    console.error("Failed to notify late-available driver on goOnline", error);
  });
};

export const getCurrentDriver = async (req, res) => {
  if (String(req.auth?.role || "").toLowerCase() === "service_center_staff") {
    const access = await resolveAuthenticatedServiceCenterAccess(req);

    if (!access?.staff || !access?.center) {
      throw new ApiError(404, "Service center staff not found");
    }

    res.json({
      success: true,
      data: serializeServiceCenterStaffProfile(access.staff, access.center),
    });
    return;
  }

  if (String(req.auth?.role || "").toLowerCase() === "service_center") {
    const center = await resolveAuthenticatedServiceCenter(req);

    if (!center) {
      throw new ApiError(404, "Service center not found");
    }

    res.json({
      success: true,
      data: serializeServiceCenterProfile(center),
    });
    return;
  }

  if (String(req.auth?.role || "").toLowerCase() === "owner") {
    const owner = await Owner.findById(req.auth.sub);

    if (!owner) {
      throw new ApiError(404, "Owner not found");
    }

    res.json({
      success: true,
      data: serializeOwnerProfile(owner.toObject()),
    });
    return;
  }

  if (String(req.auth?.role || "").toLowerCase() === "bus_driver") {
    const busDriver = await BusDriver.findById(req.auth.sub);

    if (!busDriver) {
      throw new ApiError(404, "Bus driver not found");
    }

    res.json({
      success: true,
      data: await serializeBusDriverProfile(busDriver),
    });
    return;
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (!String(driver.referralCode || "").trim()) {
    driver.referralCode = generateDriverReferralCode(driver);
    await driver.save();
  }

  await clearDriverActiveRideIfStale(driver);
  const vehicleIconUrl = await resolveVehicleMapIcon(driver.vehicleTypeId);

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      owner_id: driver.owner_id || null,
      salary: Number(driver.salary || 0),
      profileImage: driver.profileImage || "",
      gender: driver.gender,
      vehicleType: driver.vehicleType,
      vehicleTypeId: driver.vehicleTypeId,
      vehicleIconType: driver.vehicleIconType,
      vehicleIconUrl,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      registerFor: driver.registerFor,
      vehicleNumber: driver.vehicleNumber,
      vehicleColor: driver.vehicleColor,
      vehicleImage: driver.vehicleImage || "",
      city: driver.city,
      approve: driver.approve,
      status: driver.status,
      rating: driver.rating,
      wallet: await serializeDriverWallet(driver),
      referralCode: driver.referralCode || "",
      deletionRequest: driver.deletionRequest || { status: "none" },
      isOnline: driver.isOnline,
      isOnRide: driver.isOnRide,
      onlineSelfie: driver.onlineSelfie || {},
      location: driver.location,
      zoneId: driver.zoneId,
      routeBooking: serializeDriverRouteBooking(driver.routeBooking),
      documents: driver.documents || {},
      emergencyContacts: Array.isArray(driver.emergencyContacts)
        ? driver.emergencyContacts.map(serializeEmergencyContact)
        : [],
      onboarding: driver.onboarding || {},
    },
  });
};

export const getDriverEmergencyContacts = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub).lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.json({
    success: true,
    data: {
      results: Array.isArray(driver.emergencyContacts)
        ? driver.emergencyContacts.map(serializeEmergencyContact)
        : [],
      limit: MAX_EMERGENCY_CONTACTS,
    },
  });
};

export const getDriverNotifications = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub).lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const serviceLocationId = driver.service_location_id || null;
  const query = {
    status: "sent",
    send_to: { $in: ["all", "drivers"] },
  };

  if (serviceLocationId) {
    query.$or = [
      { service_location_id: serviceLocationId },
      { send_to: "all" },
      { send_to: "drivers" },
    ];
  }

  const notifications = await Notification.find(query)
    .sort({ sent_at: -1, createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    success: true,
    data: {
      results: notifications.map(serializeDriverNotification),
    },
  });
};

export const getDriverScheduledRides = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub)
    .select("service_location_id vehicleTypeId")
    .lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const safePage = Math.max(1, Number(req.query?.page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(req.query?.limit) || 20));
  const openScheduledRideQuery = {
    driverId: null,
    status: RIDE_STATUS.SEARCHING,
    liveStatus: RIDE_LIVE_STATUS.SEARCHING,
    ...(driver.service_location_id ? { service_location_id: driver.service_location_id } : {}),
  };

  if (driver.vehicleTypeId) {
    openScheduledRideQuery.$or = [
      { vehicleTypeId: driver.vehicleTypeId },
      { dispatchVehicleTypeIds: driver.vehicleTypeId },
    ];
  }

  const query = {
    scheduledAt: { $ne: null, $gte: new Date() },
    $or: [
      openScheduledRideQuery,
      {
        driverId: req.auth.sub,
        status: { $in: [RIDE_STATUS.SEARCHING, RIDE_STATUS.ACCEPTED] },
        liveStatus: {
          $in: [
            RIDE_LIVE_STATUS.SEARCHING,
            RIDE_LIVE_STATUS.ACCEPTED,
            RIDE_LIVE_STATUS.ARRIVING,
          ],
        },
      },
    ],
  };

  const [rides, totalCount] = await Promise.all([
    Ride.find(query)
      .sort({ scheduledAt: 1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select([
        "serviceType",
        "status",
        "liveStatus",
        "fare",
        "baseFare",
        "bookingMode",
        "estimatedDistanceMeters",
        "estimatedDurationMinutes",
        "paymentMethod",
        "pickupLocation",
        "pickupAddress",
        "dropLocation",
        "dropAddress",
        "scheduledAt",
        "driverId",
        "parcel",
        "intercity",
        "vehicleTypeId",
        "dispatchVehicleTypeIds",
        "service_location_id",
        "transport_type",
        "userId",
        "createdAt",
        "updatedAt",
      ].join(" "))
      .populate("userId", "name phone countryCode")
      .lean(),
    Ride.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      results: rides.map((ride) => serializeDriverScheduledRide(ride, req.auth.sub)),
      totalCount,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / safeLimit)),
        hasNextPage: safePage * safeLimit < totalCount,
        hasPrevPage: safePage > 1,
      },
    },
  });
};

export const cancelDriverScheduledRide = async (req, res) => {
  const rideId = toCleanString(req.params?.rideId);

  if (!rideId) {
    throw new ApiError(400, "Ride id is required");
  }

  const ride = await cancelScheduledRideByDriver({
    rideId,
    driverId: req.auth.sub,
  });

  if (!ride) {
    throw new ApiError(404, "Scheduled ride not found for this driver");
  }

  res.json({
    success: true,
    message: "Scheduled ride cancelled successfully",
    data: {
      rideId: String(ride._id || ""),
      status: ride.status || RIDE_STATUS.CANCELLED,
      liveStatus: ride.liveStatus || RIDE_LIVE_STATUS.CANCELLED,
    },
  });
};

const DRIVER_PUSH_ROLE_MODEL_MAP = {
  driver: Driver,
  owner: Owner,
  bus_driver: BusDriver,
  service_center: ServiceStore,
  service_center_staff: ServiceCenterStaff,
};

const resolvePushTokenEntityForRole = async (req) => {
  const role = String(req.auth?.role || "").toLowerCase();
  const Model = DRIVER_PUSH_ROLE_MODEL_MAP[role];

  if (!Model) {
    throw new ApiError(403, "Unsupported role for driver push notifications");
  }

  const entity = await Model.findById(req.auth?.sub);

  if (!entity) {
    throw new ApiError(404, "Authenticated account not found");
  }

  if (
    role === "driver" &&
    (entity.approve === false ||
      String(entity.status || "").toLowerCase() === "pending")
  ) {
    throw new ApiError(403, "Driver account is pending approval");
  }

  if (
    role === "owner" &&
    (entity.active === false ||
      entity.approve === false ||
      String(entity.status || "").toLowerCase() === "pending")
  ) {
    throw new ApiError(403, "Owner account is pending approval");
  }

  if (
    role === "bus_driver" &&
    (entity.active === false ||
      entity.approve === false ||
      ["pending", "blocked"].includes(String(entity.status || "").toLowerCase()))
  ) {
    throw new ApiError(403, "Bus driver account is pending approval");
  }

  if (
    role === "service_center" &&
    (entity.active === false ||
      String(entity.status || "").toLowerCase() === "inactive")
  ) {
    throw new ApiError(403, "Service center account is inactive");
  }

  if (
    role === "service_center_staff" &&
    (entity.active === false ||
      String(entity.status || "").toLowerCase() === "inactive")
  ) {
    throw new ApiError(403, "Service center staff account is inactive");
  }

  return entity;
};

export const saveDriverFcmToken = async (req, res) => {
  const entity = await resolvePushTokenEntityForRole(req);

  const saved = assignPushTokenToEntity(entity, {
    token: req.body?.token,
    platform: req.body?.platform,
  });

  await entity.save();

  res.json({
    success: true,
    data: {
      message: "FCM token saved successfully",
      platform: saved.platform,
      field: saved.fieldName,
      role: String(req.auth?.role || "").toLowerCase(),
    },
  });
};

export const addDriverEmergencyContact = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = sanitizeEmergencyPhone(req.body?.phone);
  const source =
    String(req.body?.source || "manual").toLowerCase() === "device"
      ? "device"
      : "manual";

  if (!name) {
    throw new ApiError(400, "Contact name is required");
  }

  if (!EMERGENCY_CONTACT_NAME_REGEX.test(name)) {
    throw new ApiError(400, "Contact name can contain alphabets only");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "A valid 10-digit contact number is required");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const existingContacts = Array.isArray(driver.emergencyContacts)
    ? driver.emergencyContacts
    : [];

  if (existingContacts.length >= MAX_EMERGENCY_CONTACTS) {
    throw new ApiError(
      400,
      `You can add up to ${MAX_EMERGENCY_CONTACTS} emergency contacts`,
    );
  }

  if (
    existingContacts.some(
      (contact) => sanitizeEmergencyPhone(contact.phone) === phone,
    )
  ) {
    throw new ApiError(409, "This contact number is already added");
  }

  driver.emergencyContacts = [
    ...existingContacts,
    {
      name: name.slice(0, 80),
      phone,
      source,
    },
  ];

  await driver.save();

  const addedContact =
    driver.emergencyContacts[driver.emergencyContacts.length - 1];

  res.status(201).json({
    success: true,
    data: serializeEmergencyContact(addedContact),
  });
};

export const deleteDriverEmergencyContact = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const existingContacts = Array.isArray(driver.emergencyContacts)
    ? driver.emergencyContacts
    : [];
  const nextContacts = existingContacts.filter(
    (contact) => String(contact._id) !== String(req.params.contactId),
  );

  if (nextContacts.length === existingContacts.length) {
    throw new ApiError(404, "Emergency contact not found");
  }

  driver.emergencyContacts = nextContacts;
  await driver.save();

  res.json({
    success: true,
    data: {
      deleted: true,
      results: driver.emergencyContacts.map(serializeEmergencyContact),
    },
  });
};

export const updateCurrentDriver = async (req, res) => {
  if (String(req.auth?.role || "").toLowerCase() === "owner") {
    throw new ApiError(403, "Owner profile editing is not available from this screen");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
    const name = String(req.body.name || "").trim();
    if (!DRIVER_NAME_REGEX.test(name)) {
      throw new ApiError(400, "Full name can contain alphabets only");
    }
    driver.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "email")) {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
      throw new ApiError(400, "Enter a valid email address");
    }
    driver.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "profileImage")) {
    driver.profileImage = String(req.body.profileImage || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "routeBooking")) {
    const routeBookingPayload = req.body?.routeBooking || {};
    const enabled = Boolean(routeBookingPayload?.enabled);

    if (!enabled) {
      driver.routeBooking = {
        enabled: false,
        anchorLocation: null,
        label: "",
        updatedAt: new Date(),
      };
    } else {
      const coordinates = normalizePoint(
        routeBookingPayload?.coordinates || routeBookingPayload?.anchorLocation,
        "routeBooking.coordinates",
      );

      driver.routeBooking = {
        enabled: true,
        anchorLocation: toPoint(coordinates, "routeBooking.coordinates"),
        label: String(routeBookingPayload?.label || "").trim(),
        updatedAt: new Date(),
      };
    }
  }

  await driver.save();

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      profileImage: driver.profileImage || "",
      routeBooking: serializeDriverRouteBooking(driver.routeBooking),
    },
  });
};

export const requestDriverAccountDeletion = async (req, res) => {
  const driverId = req.auth?.sub;
  const reason = String(req.body?.reason || "").trim();

  if (!reason) {
    throw new ApiError(400, "Deletion reason is required");
  }

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (
    driver.deletedAt ||
    driver.approve === false ||
    String(driver.status || "").toLowerCase() === "inactive"
  ) {
    throw new ApiError(400, "Account is already inactive");
  }

  if (driver.deletionRequest?.status === "pending") {
    res.json({
      success: true,
      data: {
        deletionRequestStatus: "pending",
        requestedAt: driver.deletionRequest.requestedAt || null,
      },
      message: "Deletion request is already pending admin review",
    });
    return;
  }

  driver.deletionRequest = {
    status: "pending",
    reason: reason.slice(0, 300),
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
  };

  await driver.save();

  res.status(201).json({
    success: true,
    data: {
      deletionRequestStatus: driver.deletionRequest.status,
      requestedAt: driver.deletionRequest.requestedAt,
    },
  });
};

export const updateCurrentDriverDocument = async (req, res) => {
  const documentKey = String(req.params.documentKey || "").trim();
  const document = req.body?.document || {};

  if (!documentKey) {
    throw new ApiError(400, "Document key is required");
  }

  const previewUrl = String(
    document.previewUrl || document.secureUrl || document.url || "",
  ).trim();

  if (!previewUrl) {
    throw new ApiError(400, "Uploaded document image URL is required");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const existingDocument = driver.documents?.[documentKey] || {};
  const existingStatus = String(
    existingDocument.status ||
    existingDocument.verificationStatus ||
    existingDocument.approvalStatus ||
    existingDocument.reviewStatus ||
    "",
  ).trim().toLowerCase();

  if (["verified", "approved"].includes(existingStatus)) {
    throw new ApiError(409, "Verified documents cannot be re-uploaded");
  }

  const updatedDocument = {
    ...(typeof document === "object" ? document : {}),
    key: documentKey,
    fileName: String(document.fileName || documentKey).trim(),
    uploaded: true,
    uploadedAt: new Date().toISOString(),
    previewUrl,
    secureUrl: String(document.secureUrl || previewUrl).trim(),
  };

  driver.documents = {
    ...(driver.documents || {}),
    [documentKey]: updatedDocument,
  };

  driver.markModified("documents");
  await driver.save();

  res.json({
    success: true,
    data: {
      document: updatedDocument,
      documents: driver.documents || {},
    },
  });
};

export const deleteCurrentDriverAccount = async (req, res) => {
  const driverId = req.auth?.sub;

  const activeRide = await Ride.findOne({
    driverId,
    status: { $in: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING] },
  }).select("_id status");

  if (activeRide) {
    throw new ApiError(409, "Complete or cancel your active ride before deleting your account");
  }

  const deletedDriver = await Driver.findByIdAndDelete(driverId);

  if (!deletedDriver) {
    throw new ApiError(404, "Driver not found");
  }

  await DriverLoginSession.deleteMany({
    $or: [
      { driverId: deletedDriver._id },
      { phone: deletedDriver.phone },
    ],
  });

  res.json({
    success: true,
    data: {
      deleted: true,
      driverId: String(deletedDriver._id),
    },
    message: "Driver account deleted successfully",
  });
};

export const getMyWallet = async (req, res) => {
  if (String(req.auth?.role || "").toLowerCase() === "owner") {
    const owner = await Owner.findById(req.auth.sub).lean();

    if (!owner) {
      throw new ApiError(404, "Owner not found");
    }

    res.json({
      success: true,
      data: {
        wallet: {
          balance: Number(owner.wallet?.balance || 0),
          currency: "INR",
        },
        transactions: [],
        withdrawalRequests: [],
        settings: await getWalletSettings(),
      },
    });
    return;
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const transactions = await WalletTransaction.find({ driverId: req.auth.sub })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const withdrawalRequests = await WithdrawalRequest.find({ driver_id: req.auth.sub })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const walletSettings = await getWalletSettings();

  res.json({
    success: true,
    data: {
      wallet: await serializeDriverWallet(driver),
      transactions,
      withdrawalRequests,
      settings: walletSettings,
    },
  });
};

export const getServiceCenterVehicles = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id) {
    throw new ApiError(403, "Service center access is required");
  }

  const items = await listRentalVehicleTypes();
  const centerId = String(center._id);
  const results = items.filter((item) =>
    Array.isArray(item.serviceStoreIds) && item.serviceStoreIds.includes(centerId),
  );

  res.json({
    success: true,
    data: {
      serviceCenter: {
        id: centerId,
        name: center.name || "",
      },
      results,
    },
  });
};

export const createServiceCenterVehicle = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageVehicles) {
    throw new ApiError(403, "Service center access is required");
  }

  const payload = {
    ...req.body,
    transport_type: "rental",
    serviceStoreIds: [String(center._id)],
    status: req.body?.status === "inactive" ? "inactive" : "active",
  };

  const created = await createRentalVehicleType(payload);

  res.json({
    success: true,
    data: created,
  });
};

export const deleteServiceCenterVehicle = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageVehicles) {
    throw new ApiError(403, "Service center access is required");
  }

  const vehicle = await RentalVehicleType.findById(req.params.vehicleId).lean();

  if (!vehicle) {
    throw new ApiError(404, "Rental vehicle type not found");
  }

  const storeIds = Array.isArray(vehicle.serviceStoreIds)
    ? vehicle.serviceStoreIds.map((item) => String(item))
    : [];

  if (!storeIds.includes(String(center._id))) {
    throw new ApiError(403, "You can only manage vehicles assigned to your service center");
  }

  await deleteRentalVehicleType(req.params.vehicleId);

  res.json({
    success: true,
    data: true,
  });
};

export const updateServiceCenterVehicle = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageVehicles) {
    throw new ApiError(403, "Service center access is required");
  }

  const vehicle = await RentalVehicleType.findById(req.params.vehicleId).lean();

  if (!vehicle) {
    throw new ApiError(404, "Rental vehicle type not found");
  }

  const storeIds = Array.isArray(vehicle.serviceStoreIds)
    ? vehicle.serviceStoreIds.map((item) => String(item))
    : [];

  if (!storeIds.includes(String(center._id))) {
    throw new ApiError(403, "You can only manage vehicles assigned to your service center");
  }

  const updated = await updateRentalVehicleType(req.params.vehicleId, {
    ...req.body,
    transport_type: "rental",
    serviceStoreIds: [String(center._id)],
  });

  res.json({
    success: true,
    data: updated,
  });
};

export const getServiceCenterStaffMembers = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageStaff) {
    throw new ApiError(403, "Only service center owners can manage staff");
  }

  const [staffItems, bookingCounts] = await Promise.all([
    ServiceCenterStaff.find({ serviceCenterId: center._id }).sort({ createdAt: -1 }).lean(),
    RentalBookingRequest.aggregate([
      {
        $match: {
          assignedStaffId: { $ne: null },
          serviceCenterIds: center._id,
          status: { $in: ["pending", "confirmed", "assigned", "end_requested"] },
        },
      },
      {
        $group: {
          _id: "$assignedStaffId",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const countMap = new Map(bookingCounts.map((item) => [String(item._id), Number(item.count || 0)]));

  res.json({
    success: true,
    data: {
      serviceCenter: {
        id: String(center._id),
        name: center.name || "",
      },
      results: staffItems.map((item) => serializeServiceCenterStaff(item, countMap.get(String(item._id)) || 0)),
    },
  });
};

export const createServiceCenterStaffMember = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageStaff) {
    throw new ApiError(403, "Only service center owners can manage staff");
  }

  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").replace(/\D/g, "").slice(-10);

  if (!name) {
    throw new ApiError(400, "Staff name is required");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "Staff login number must be a valid 10-digit number");
  }

  const existing = await ServiceCenterStaff.findOne({ phone }).lean();
  if (existing) {
    throw new ApiError(409, "A staff account already exists with this number");
  }

  const created = await ServiceCenterStaff.create({
    serviceCenterId: center._id,
    name,
    phone,
    active: true,
    status: "active",
  });

  res.json({
    success: true,
    data: serializeServiceCenterStaff(created.toObject(), 0),
  });
};

export const updateServiceCenterStaffMember = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageStaff) {
    throw new ApiError(403, "Only service center owners can manage staff");
  }

  const staffId = String(req.params?.staffId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    throw new ApiError(400, "Valid staff id is required");
  }

  const staff = await ServiceCenterStaff.findOne({
    _id: staffId,
    serviceCenterId: center._id,
  });

  if (!staff) {
    throw new ApiError(404, "Service center staff member not found");
  }

  if (req.body?.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) {
      throw new ApiError(400, "Staff name is required");
    }
    staff.name = name;
  }

  if (req.body?.phone !== undefined) {
    const phone = String(req.body.phone || "").replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(phone)) {
      throw new ApiError(400, "Staff login number must be a valid 10-digit number");
    }

    const existing = await ServiceCenterStaff.findOne({
      phone,
      _id: { $ne: staff._id },
    }).lean();

    if (existing) {
      throw new ApiError(409, "A staff account already exists with this number");
    }

    staff.phone = phone;
  }

  if (req.body?.active !== undefined || req.body?.status !== undefined) {
    const nextActive = req.body?.active !== undefined ? Boolean(req.body.active) : staff.active !== false;
    const nextStatus = String(req.body?.status || (nextActive ? "active" : "inactive")).trim().toLowerCase();

    staff.active = nextActive;
    staff.status = nextStatus === "inactive" ? "inactive" : "active";
  }

  await staff.save();

  const bookingCount = await RentalBookingRequest.countDocuments({
    assignedStaffId: staff._id,
    serviceCenterIds: center._id,
    status: { $in: ["pending", "confirmed", "assigned", "end_requested"] },
  });

  res.json({
    success: true,
    data: serializeServiceCenterStaff(staff.toObject(), bookingCount),
  });
};

export const deleteServiceCenterStaffMember = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id || !access?.canManageStaff) {
    throw new ApiError(403, "Only service center owners can manage staff");
  }

  const staffId = String(req.params?.staffId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    throw new ApiError(400, "Valid staff id is required");
  }

  const staff = await ServiceCenterStaff.findOne({
    _id: staffId,
    serviceCenterId: center._id,
  }).lean();

  if (!staff) {
    throw new ApiError(404, "Service center staff member not found");
  }

  await RentalBookingRequest.updateMany(
    {
      assignedStaffId: staff._id,
      serviceCenterIds: center._id,
    },
    {
      $set: {
        assignedStaffId: null,
        assignedStaffName: "",
        assignedStaffPhone: "",
      },
    },
  );

  await ServiceCenterStaff.deleteOne({ _id: staff._id });

  res.json({
    success: true,
    data: true,
  });
};

export const getServiceCenterBookings = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id) {
    throw new ApiError(403, "Service center access is required");
  }

  const query = {
    serviceCenterIds: center._id,
  };

  if (access.staff?._id) {
    query.assignedStaffId = access.staff._id;
  }

  const bookings = await RentalBookingRequest.find(query)
    .populate("userId", "name phone email")
    .populate("vehicleTypeId", "name vehicleCategory image coverImage galleryImages amenities")
    .sort({ createdAt: -1 })
    .lean();

  const staffItems = access.canManageStaff
    ? await ServiceCenterStaff.find({ serviceCenterId: center._id, active: true, status: "active" })
        .sort({ name: 1 })
        .lean()
    : [];

  res.json({
    success: true,
    data: {
      permissions: {
        canManageStaff: access.canManageStaff,
        canManageVehicles: access.canManageVehicles,
        canAssignBookings: access.canAssignBookings,
      },
      results: bookings.map(serializeServiceCenterBooking),
      staff: staffItems.map((item) => serializeServiceCenterStaff(item, 0)),
    },
  });
};

export const updateServiceCenterBooking = async (req, res) => {
  const access = await resolveAuthenticatedServiceCenterAccess(req);
  const center = access?.center;

  if (!center?._id) {
    throw new ApiError(403, "Service center access is required");
  }

  const bookingId = String(req.params?.bookingId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, "Valid booking id is required");
  }

  const booking = await RentalBookingRequest.findById(bookingId)
    .populate("userId", "name phone email")
    .populate("vehicleTypeId", "name vehicleCategory image coverImage galleryImages amenities");

  if (!booking) {
    throw new ApiError(404, "Rental booking request not found");
  }

  const centerIds = Array.isArray(booking.serviceCenterIds)
    ? booking.serviceCenterIds.map((item) => String(item))
    : [];

  if (!centerIds.includes(String(center._id))) {
    throw new ApiError(403, "This booking is not assigned to your service center");
  }

  if (req.body?.assignedStaffId !== undefined) {
    const assignedStaffId = String(req.body.assignedStaffId || "").trim();
    const currentAssignedStaffId = String(booking.assignedStaffId || "").trim();

    if (!access.canAssignBookings && assignedStaffId !== currentAssignedStaffId) {
      throw new ApiError(403, "Only service center owners can assign staff");
    }

    if (!access.canAssignBookings) {
      // Staff form submissions may carry the current assignment value; keep that as a no-op.
    } else if (!assignedStaffId) {
      booking.assignedStaffId = null;
      booking.assignedStaffName = "";
      booking.assignedStaffPhone = "";
    } else {
      const staff = await ServiceCenterStaff.findOne({
        _id: assignedStaffId,
        serviceCenterId: center._id,
        active: true,
        status: "active",
      }).lean();

      if (!staff) {
        throw new ApiError(404, "Assigned staff member not found");
      }

      booking.assignedStaffId = staff._id;
      booking.assignedStaffName = staff.name || "";
      booking.assignedStaffPhone = staff.phone || "";

      if (String(booking.status || "") === "pending") {
        booking.status = "assigned";
      }
    }
  }

  if (req.body?.serviceCenterNote !== undefined) {
    booking.serviceCenterNote = String(req.body.serviceCenterNote || "").trim();
  }

  if (req.body?.rentalInspection && typeof req.body.rentalInspection === "object") {
    const inspection = req.body.rentalInspection;

    if (inspection.beforeHandover && typeof inspection.beforeHandover === "object") {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.beforeHandover = booking.rentalInspection.beforeHandover || {};

      const beforeKeys = [
        "exteriorOk",
        "interiorOk",
        "dashboardOk",
        "tyresOk",
        "fuelOk",
        "documentsOk",
      ];

      beforeKeys.forEach((key) => {
        if (inspection.beforeHandover[key] !== undefined) {
          booking.rentalInspection.beforeHandover[key] = inspection.beforeHandover[key] === true;
        }
      });
    }

    if (inspection.afterReturn && typeof inspection.afterReturn === "object") {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.afterReturn = booking.rentalInspection.afterReturn || {};

      const afterKeys = [
        "exteriorChecked",
        "interiorChecked",
        "dashboardChecked",
        "fuelChecked",
        "tyresChecked",
        "damageReviewed",
      ];

      afterKeys.forEach((key) => {
        if (inspection.afterReturn[key] !== undefined) {
          booking.rentalInspection.afterReturn[key] = inspection.afterReturn[key] === true;
        }
      });
    }

    if (inspection.pickupNotes !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.pickupNotes = String(inspection.pickupNotes || "").trim();
    }

    if (inspection.returnNotes !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.returnNotes = String(inspection.returnNotes || "").trim();
    }

    if (inspection.pickupMeterReading !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      const value = String(inspection.pickupMeterReading ?? "").trim();
      booking.rentalInspection.pickupMeterReading = value ? Number(value) : null;
    }

    if (inspection.returnMeterReading !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      const value = String(inspection.returnMeterReading ?? "").trim();
      booking.rentalInspection.returnMeterReading = value ? Number(value) : null;
    }

    if (inspection.pickupFuelLevel !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.pickupFuelLevel = String(inspection.pickupFuelLevel || "").trim();
    }

    if (inspection.returnFuelLevel !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.returnFuelLevel = String(inspection.returnFuelLevel || "").trim();
    }

    if (inspection.beforeConditionImages !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.beforeConditionImages = Array.isArray(inspection.beforeConditionImages)
        ? inspection.beforeConditionImages.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
    }

    if (inspection.afterConditionImages !== undefined) {
      booking.rentalInspection = booking.rentalInspection || {};
      booking.rentalInspection.afterConditionImages = Array.isArray(inspection.afterConditionImages)
        ? inspection.afterConditionImages.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
    }
  }

  if (req.body?.status !== undefined) {
    const nextStatus = String(req.body.status || "").trim();
    const allowedStatuses = ["pending", "confirmed", "assigned", "completed", "cancelled", "end_requested"];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ApiError(400, "Invalid booking status");
    }

    if (access.staff?._id) {
      if (String(booking.assignedStaffId || "") !== String(access.staff._id)) {
        throw new ApiError(403, "Staff can only update bookings assigned to them");
      }
      if (!["assigned", "confirmed", "completed", "end_requested"].includes(nextStatus)) {
        throw new ApiError(403, "Staff have limited status update access");
      }
    }

    if (nextStatus === "completed") {
      const returnMeterReading = Number(booking.rentalInspection?.returnMeterReading);
      const returnFuelLevel = String(booking.rentalInspection?.returnFuelLevel || "").trim();
      const returnNotes = String(booking.rentalInspection?.returnNotes || "").trim();
      const afterConditionImages = Array.isArray(booking.rentalInspection?.afterConditionImages)
        ? booking.rentalInspection.afterConditionImages.filter(Boolean)
        : [];

      if (!Number.isFinite(returnMeterReading) || returnMeterReading < 0) {
        throw new ApiError(400, "Return meter reading is required before completing the booking");
      }

      if (!returnFuelLevel) {
        throw new ApiError(400, "Return fuel level is required before completing the booking");
      }

      if (!afterConditionImages.length) {
        throw new ApiError(400, "At least one after-condition photo is required before completing the booking");
      }

      if (!returnNotes) {
        throw new ApiError(400, "Return condition notes are required before completing the booking");
      }
    }

    booking.status = nextStatus;
    if (nextStatus === "assigned" && !booking.assignedAt) {
      booking.assignedAt = new Date();
    }
    if (nextStatus === "completed" && !booking.completedAt) {
      booking.completedAt = new Date();
    }
    if (nextStatus === "cancelled" && !booking.cancelledAt) {
      booking.cancelledAt = new Date();
    }
  }

  await booking.save();

  const populated = await RentalBookingRequest.findById(booking._id)
    .populate("userId", "name phone email")
    .populate("vehicleTypeId", "name vehicleCategory image")
    .lean();

  res.json({
    success: true,
    data: serializeServiceCenterBooking(populated),
  });
};

export const getBusDriverSeatLayout = async (req, res) => {
  const busDriver = await BusDriver.findById(req.auth.sub).lean();

  if (!busDriver) {
    throw new ApiError(404, "Bus driver not found");
  }

  if (!busDriver.assignedBusServiceId) {
    throw new ApiError(404, "No bus is assigned to this driver");
  }

  const busService = await BusService.findById(busDriver.assignedBusServiceId).lean();
  if (!busService) {
    throw new ApiError(404, "Assigned bus service not found");
  }

  const scheduleId = toCleanString(req.query?.scheduleId);
  const travelDate = normalizeBusTravelDate(req.query?.date || req.query?.travelDate || new Date());
  const schedule = findBusSchedule(busService, scheduleId);

  if (!isScheduleAvailableOnDate(schedule, travelDate)) {
    throw new ApiError(404, "Bus schedule not found for the selected date");
  }

  res.json({
    success: true,
    data: {
      ...(await buildBusDriverSeatLayout({ busService, scheduleId, travelDate })),
      bus: {
        operatorName: busService.operatorName || "",
        busName: busService.busName || "",
        routeName: busService.route?.routeName || "",
        fromCity: busService.route?.originCity || "",
        toCity: busService.route?.destinationCity || "",
        departureTime: schedule?.departureTime || "",
        arrivalTime: schedule?.arrivalTime || "",
      },
    },
  });
};

export const listBusDriverBookings = async (req, res) => {
  const busDriver = await BusDriver.findById(req.auth.sub).lean();

  if (!busDriver) {
    throw new ApiError(404, "Bus driver not found");
  }

  if (!busDriver.assignedBusServiceId) {
    throw new ApiError(404, "No bus is assigned to this driver");
  }

  const query = {
    busServiceId: busDriver.assignedBusServiceId,
  };

  const travelDate = toCleanString(req.query?.date || req.query?.travelDate);
  const scheduleId = toCleanString(req.query?.scheduleId);
  const status = toCleanString(req.query?.status);

  if (travelDate) {
    query.travelDate = normalizeBusTravelDate(travelDate);
  }

  if (scheduleId) {
    query.scheduleId = scheduleId;
  }

  if (status) {
    query.status = status;
  }

  const items = await BusBooking.find(query).sort({ travelDate: 1, createdAt: -1 }).lean();

  res.json({
    success: true,
    results: items.map(serializeBusDriverBooking),
  });
};

export const createBusDriverReservation = async (req, res) => {
  const busDriver = await BusDriver.findById(req.auth.sub).lean();

  if (!busDriver) {
    throw new ApiError(404, "Bus driver not found");
  }

  if (!busDriver.assignedBusServiceId) {
    throw new ApiError(404, "No bus is assigned to this driver");
  }

  const busService = await BusService.findById(busDriver.assignedBusServiceId).lean();
  if (!busService || String(busService.status || "") !== "active") {
    throw new ApiError(404, "Assigned bus service not found");
  }

  const scheduleId = toCleanString(req.body?.scheduleId);
  const travelDate = normalizeBusTravelDate(req.body?.travelDate || req.body?.date);
  const seatIds = Array.isArray(req.body?.seatIds)
    ? [...new Set(req.body.seatIds.map((item) => toCleanString(item)).filter(Boolean))]
    : [];
  const passenger = {
    name: toCleanString(req.body?.passenger?.name),
    age: Number(req.body?.passenger?.age || 0),
    gender: toCleanString(req.body?.passenger?.gender),
    phone: normalizeBusPassengerPhone(req.body?.passenger?.phone),
    email: normalizeEmail(req.body?.passenger?.email),
  };
  const notes = toCleanString(req.body?.notes);

  if (!scheduleId || seatIds.length === 0) {
    throw new ApiError(400, "scheduleId and seatIds are required");
  }

  validateBusPassengerName(passenger.name);
  validateBusPassengerPhone(passenger.phone);
  validateBusPassengerEmail(passenger.email);

  if (!Number.isFinite(passenger.age) || passenger.age < 1 || passenger.age > 120) {
    throw new ApiError(400, "Passenger age must be valid");
  }

  const schedule = findBusSchedule(busService, scheduleId);
  if (!isScheduleAvailableOnDate(schedule, travelDate)) {
    throw new ApiError(404, "Bus schedule not found for the selected date");
  }

  const seatLayout = await buildBusDriverSeatLayout({ busService, scheduleId, travelDate });
  const availableSeatMap = new Map(
    flattenBusBlueprintSeats(seatLayout.blueprint)
      .filter((seat) => String(seat.status || "available") === "available")
      .map((seat) => [String(seat.id || ""), seat]),
  );

  const invalidSeat = seatIds.find((seatId) => !availableSeatMap.has(seatId));
  if (invalidSeat) {
    throw new ApiError(409, `Seat ${invalidSeat} is not available`);
  }

  const amount = Math.round(Number(busService.seatPrice || 0) * seatIds.length * 100) / 100;
  const booking = await BusBooking.create({
    userId: busDriver._id,
    busServiceId: busService._id,
    bookingCode: `BDR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    scheduleId,
    travelDate,
    seatIds,
    seatLabels: seatIds.map((seatId) => availableSeatMap.get(seatId)?.label || seatId),
    passenger,
    amount,
    bookingSource: "bus_driver",
    reservedByDriverId: busDriver._id,
    currency: busService.fareCurrency || "INR",
    status: "confirmed",
    expiresAt: null,
    routeSnapshot: {
      originCity: busService.route?.originCity || "",
      destinationCity: busService.route?.destinationCity || "",
      departureTime: schedule?.departureTime || "",
      arrivalTime: schedule?.arrivalTime || "",
      durationHours: busService.route?.durationHours || "",
      busName: busService.busName || "",
      operatorName: busService.operatorName || "",
      coachType: busService.coachType || "",
      busCategory: busService.busCategory || "",
    },
    payment: {
      provider: "manual",
      orderId: "",
      paymentId: "",
      signature: "",
      status: "manual_reserved",
      paidAt: new Date(),
    },
    notes,
  });

  try {
    await BusSeatHold.insertMany(
      seatIds.map((seatId) => ({
        busServiceId: busService._id,
        bookingId: booking._id,
        userId: busDriver._id,
        scheduleId,
        travelDate,
        seatId,
        holdToken: booking.bookingCode,
        status: "booked",
        expiresAt: null,
      })),
      { ordered: true },
    );
  } catch (error) {
    await BusBooking.deleteOne({ _id: booking._id });
    if (error?.code === 11000) {
      throw new ApiError(409, "One or more selected seats were just booked");
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    data: serializeBusDriverBooking(booking),
  });
};

export const updateBusDriverSchedules = async (req, res) => {
  const busDriver = await BusDriver.findById(req.auth.sub);

  if (!busDriver) {
    throw new ApiError(404, "Bus driver not found");
  }

  if (!busDriver.assignedBusServiceId) {
    throw new ApiError(404, "No bus is assigned to this driver");
  }

  const busService = await BusService.findById(busDriver.assignedBusServiceId);
  if (!busService) {
    throw new ApiError(404, "Assigned bus service not found");
  }

  const schedules = Array.isArray(req.body?.schedules)
    ? req.body.schedules.map((schedule, index) => normalizeBusDriverSchedule(schedule, index))
    : [];

  validateBusDriverSchedules(schedules);

  busService.schedules = schedules;
  await busService.save();

  res.json({
    success: true,
    data: {
      busServiceId: String(busService._id),
      schedules: Array.isArray(busService.schedules) ? busService.schedules : [],
      updatedAt: busService.updatedAt,
    },
  });
};

export const createDriverWithdrawalRequest = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const wallet = await serializeDriverWallet(driver);
  const walletSettings = await getWalletSettings();
  const isTransferEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(walletSettings.enable_wallet_transfer_driver ?? '1').trim().toLowerCase(),
  );
  const minimumTransferAmount = Number(wallet.minimumTransferAmount ?? walletSettings.minimum_wallet_amount_for_transfer ?? 0);
  const amount = Number(req.body?.amount);
  const paymentMethod = String(req.body?.payment_method || req.body?.paymentMethod || 'bank_transfer').trim().toLowerCase() || 'bank_transfer';

  if (!isTransferEnabled) {
    throw new ApiError(403, "Withdrawals are disabled by admin");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be greater than zero");
  }

  if (minimumTransferAmount > 0 && amount < minimumTransferAmount) {
    throw new ApiError(400, `amount must be at least ${minimumTransferAmount}`);
  }

  if (amount > Number(wallet.balance || 0)) {
    throw new ApiError(400, "Withdrawal amount cannot exceed current balance");
  }

  const pendingRequest = await WithdrawalRequest.findOne({
    driver_id: req.auth.sub,
    amount,
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .lean();

  if (pendingRequest && (Date.now() - new Date(pendingRequest.createdAt).getTime()) < 60 * 1000) {
    throw new ApiError(409, "A similar withdrawal request was just submitted");
  }

  const created = await WithdrawalRequest.create({
    transactionId: `wdr_${Date.now().toString(36)}`,
    driver_id: req.auth.sub,
    amount: Math.round(amount * 100) / 100,
    payment_method: paymentMethod,
    status: 'pending',
  });

  res.status(201).json({
    success: true,
    data: {
      request: created,
      wallet,
    },
    message: "Withdrawal request sent to admin",
  });
};

export const topUpMyWallet = async (req, res) => {
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be greater than zero");
  }

  const result = await topUpDriverWallet({
    driverId: req.auth.sub,
    amount,
    metadata: {
      source: req.body.source || "manual",
      referenceId: req.body.referenceId || null,
    },
  });

  const payload = {
    wallet: result.wallet,
    transaction: result.transaction,
  };

  emitToDriver(req.auth.sub, "driver:wallet:updated", payload);

  res.json({
    success: true,
    data: payload,
  });
};

export const createDriverPaymentQr = async (req, res) => {
  const amountInPaise = normalizePaymentAmount(req.body.amount);
  const rideId = String(req.body.rideId || "").trim();

  if (!rideId) {
    throw new ApiError(400, "rideId is required");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    driverId: req.auth.sub,
  })
    .select("_id fare paymentMethod serviceType driverPaymentCollection");

  if (!ride) {
    throw new ApiError(404, "Ride not found for this driver");
  }

  let payload;

  try {
    const appName = await getConfiguredAppName();
    const qr = await razorpayRequest({
      method: "POST",
      path: "/payments/qr_codes",
      body: {
        type: "upi_qr",
        name: `${appName} Taxi Fare`,
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amountInPaise,
        description: `Taxi fare for ride ${rideId}`,
        close_by: Math.floor(Date.now() / 1000) + 30 * 60,
        notes: {
          rideId,
          driverId: String(req.auth.sub),
          serviceType: ride.serviceType || "ride",
          source: "driver_collect_amount",
        },
      },
    });

    payload = {
      id: qr.id,
      entity: qr.entity,
      status: qr.status,
      imageUrl: qr.image_url,
      linkUrl: qr.image_url,
      amount: amountInPaise / 100,
      currency: "INR",
      description: qr.description,
      closeBy: qr.close_by || null,
      rawStatus: qr.status,
      providerMode: "razorpay_qr",
    };
  } catch (error) {
    if (!shouldFallbackToPaymentLinkQr(error)) {
      throw error;
    }

    payload = await createPaymentLinkQr({
      amountInPaise,
      rideId,
      driverId: req.auth.sub,
      serviceType: ride.serviceType,
    });
  }

  ride.driverPaymentCollection = {
    provider: "razorpay",
    providerId: payload.id,
    providerMode: payload.providerMode,
    status: normalizeCollectionStatus(payload.rawStatus || payload.status),
    amount: payload.amount,
    currency: payload.currency || "INR",
    linkUrl: payload.linkUrl || "",
    paidAt: null,
    updatedAt: new Date(),
  };
  await ride.save();

  res.json({
    success: true,
    data: payload,
  });
};

const resolveRazorpayCredentials = async () => {
  const envKeyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const envKeySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const envEnabled = String(process.env.RAZORPAY_ENABLED || "").trim();

  // Prefer backend .env credentials when present unless they are explicitly disabled.
  if (envEnabled !== "0" && envKeyId && envKeySecret) {
    return { keyId: envKeyId, keySecret: envKeySecret };
  }

  const settings = await ensureThirdPartySettings();
  const razorpay = settings?.payment?.razor_pay || {};

  const enabled = String(razorpay.enabled ?? "0") === "1";
  if (!enabled) {
    settings.payment = settings.payment || {};
    settings.payment.razor_pay = {
      ...razorpay,
      enabled: "1",
      environment: razorpay.environment || "test",
    };
    settings.markModified("payment");
    await settings.save();
  }

  const environment = String(razorpay.environment || "test").toLowerCase();
  const isLive = environment === "live";

  const keyId = String(
    isLive ? razorpay.live_api_key : razorpay.test_api_key || "",
  );
  const keySecret = String(
    isLive ? razorpay.live_secret_key : razorpay.test_secret_key || "",
  );

  if (!keyId || !keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured");
  }

  if (
    keyId.toLowerCase().includes("demo") ||
    keySecret.toLowerCase().includes("demo")
  ) {
    throw new ApiError(
      500,
      "Razorpay keys are demo placeholders. Configure real keys in Admin > Payment Gateways",
    );
  }

  return { keyId, keySecret };
};

const fetchRazorpay = async ({ method, path, body, keyId, keySecret }) => {
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status || 502,
      payload?.error?.description ||
        payload?.error?.message ||
        "Razorpay request failed",
    );
  }

  return payload;
};

export const createDriverWalletTopupOrder = async (req, res) => {
  const settings = await getWalletSettings();
  const minTopUp = Number(settings.minimum_amount_added_to_wallet || 0);
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Invalid top-up amount");
  }

  if (amount < minTopUp) {
    throw new ApiError(400, `Minimum top-up amount is Rs ${minTopUp}`);
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const amountPaise = Math.round(amount * 100);
  const driverId = String(req.auth?.sub || "");
  const compactDriverId = driverId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "drv";
  const receipt = `dwal_${compactDriverId}_${Date.now().toString(36)}`;

  const order = await fetchRazorpay({
    method: "POST",
    path: "/orders",
    body: {
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { driverId },
    },
    keyId,
    keySecret,
  });

  res.status(201).json({
    success: true,
    data: {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
    },
  });
};

export const verifyDriverWalletTopup = async (req, res) => {
  const orderId = String(req.body?.razorpay_order_id || "");
  const paymentId = String(req.body?.razorpay_payment_id || "");
  const signature = String(req.body?.razorpay_signature || "");

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, "Payment verification fields are required");
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  const order = await fetchRazorpay({
    method: "GET",
    path: `/orders/${encodeURIComponent(orderId)}`,
    keyId,
    keySecret,
  });

  const amountPaise = Number(order?.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, "Invalid order amount");
  }

  const amount = Math.round(amountPaise) / 100;
  const driverId = req.auth?.sub;

  const alreadyCredited = await WalletTransaction.findOne({
    driverId,
    "metadata.providerPaymentId": paymentId,
  })
    .select("_id")
    .lean();

  if (alreadyCredited) {
    const driver = await Driver.findById(driverId);
    res.json({
      success: true,
      data: {
        wallet: await serializeDriverWallet(driver),
      },
    });
    return;
  }

  const result = await topUpDriverWallet({
    driverId,
    amount,
    metadata: {
      source: "razorpay",
      provider: "razorpay",
      providerOrderId: orderId,
      providerPaymentId: paymentId,
    },
  });

  const payload = {
    wallet: result.wallet,
    transaction: result.transaction,
  };

  emitToDriver(driverId, "driver:wallet:updated", payload);

  res.json({
    success: true,
    data: payload,
  });
};


export const getDriverPaymentQrStatus = async (req, res) => {
  const rideId = String(req.query.rideId || req.params.rideId || "").trim();

  if (!rideId) {
    throw new ApiError(400, "rideId is required");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    driverId: req.auth.sub,
  }).select("_id driverPaymentCollection");

  if (!ride) {
    throw new ApiError(404, "Ride not found for this driver");
  }

  if (!ride.driverPaymentCollection?.providerId) {
    res.json({
      success: true,
      data: serializeDriverPaymentCollection(ride.driverPaymentCollection),
    });
    return;
  }

  const collection = await refreshDriverPaymentCollection(ride);

  res.json({
    success: true,
    data: collection,
  });
};

const getGenericVehicleType = (vehicle = {}) => {
  const value = String(vehicle.icon_types || vehicle.name || "").toLowerCase();

  if (value.includes("bike")) {
    return "bike";
  }

  if (value.includes("auto")) {
    return "auto";
  }

  return "car";
};

export const updateDriverVehicle = async (req, res) => {
  const {
    vehicleTypeId,
    vehicleNumber,
    vehicleColor,
    vehicleMake,
    vehicleModel,
    vehicleImage,
  } = req.body;

  let selectedVehicle = null;

  if (vehicleTypeId) {
    selectedVehicle = await Vehicle.findById(vehicleTypeId);

    if (
      !selectedVehicle ||
      selectedVehicle.active === false ||
      Number(selectedVehicle.status) === 0
    ) {
      throw new ApiError(404, "Active vehicle type not found");
    }
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const update = {};
  let vehicleChanged = false;

  if (selectedVehicle) {
    const nextVehicleType = getGenericVehicleType(selectedVehicle);
    const nextVehicleIconType = selectedVehicle.icon_types || nextVehicleType;

    update.vehicleTypeId = selectedVehicle._id;
    update.vehicleType = nextVehicleType;
    update.vehicleIconType = nextVehicleIconType;

    if (
      String(driver.vehicleTypeId || "") !== String(selectedVehicle._id || "") ||
      String(driver.vehicleType || "") !== String(nextVehicleType) ||
      String(driver.vehicleIconType || "") !== String(nextVehicleIconType)
    ) {
      vehicleChanged = true;
    }
  }

  if (vehicleNumber !== undefined) {
    const normalizedVehicleNumber = String(vehicleNumber || "")
      .trim()
      .toUpperCase();
    update.vehicleNumber = normalizedVehicleNumber;
    if (String(driver.vehicleNumber || "") !== normalizedVehicleNumber) {
      vehicleChanged = true;
    }
  }
  if (vehicleColor !== undefined) {
    const normalizedVehicleColor = String(vehicleColor || "").trim();
    update.vehicleColor = normalizedVehicleColor;
    if (String(driver.vehicleColor || "") !== normalizedVehicleColor) {
      vehicleChanged = true;
    }
  }
  if (vehicleMake !== undefined) {
    const normalizedVehicleMake = String(vehicleMake || "").trim();
    update.vehicleMake = normalizedVehicleMake;
    if (String(driver.vehicleMake || "") !== normalizedVehicleMake) {
      vehicleChanged = true;
    }
  }
  if (vehicleModel !== undefined) {
    const normalizedVehicleModel = String(vehicleModel || "").trim();
    update.vehicleModel = normalizedVehicleModel;
    if (String(driver.vehicleModel || "") !== normalizedVehicleModel) {
      vehicleChanged = true;
    }
  }
  if (vehicleImage !== undefined) {
    const normalizedVehicleImage = String(vehicleImage || "").trim();
    update.vehicleImage = normalizedVehicleImage;
    if (String(driver.vehicleImage || "") !== normalizedVehicleImage) {
      vehicleChanged = true;
    }
  }

  if (vehicleChanged) {
    update.approve = false;
    update.status = "pending";
    update.isOnline = false;
  }

  const updatedDriver = await Driver.findByIdAndUpdate(req.auth.sub, update, {
    returnDocument: 'after',
  });

  const vehicleIconUrl = await resolveVehicleMapIcon(updatedDriver.vehicleTypeId);

  res.json({
    success: true,
    message: vehicleChanged
      ? "Vehicle updated and sent to admin for approval"
      : "Vehicle updated successfully",
    data: {
      id: updatedDriver._id,
      name: updatedDriver.name,
      phone: updatedDriver.phone,
      vehicleType: updatedDriver.vehicleType,
      vehicleTypeId: updatedDriver.vehicleTypeId,
      vehicleIconType: updatedDriver.vehicleIconType,
      vehicleIconUrl,
      vehicleMake: updatedDriver.vehicleMake,
      vehicleModel: updatedDriver.vehicleModel,
      vehicleNumber: updatedDriver.vehicleNumber,
      vehicleColor: updatedDriver.vehicleColor,
      vehicleImage: updatedDriver.vehicleImage || "",
      registerFor: updatedDriver.registerFor,
      approve: updatedDriver.approve,
      status: updatedDriver.status,
      isOnline: updatedDriver.isOnline,
      isOnRide: updatedDriver.isOnRide,
      vehicleApprovalRequested: vehicleChanged,
    },
  });
};

export const getDriverApprovalStatus = async (req, res) => {
  const authorization = req.headers.authorization || "";
  const [, token] = authorization.split(" ");

  if (!token) {
    throw new ApiError(401, "Authorization token is required");
  }

  const payload = verifyAccessToken(token);

  if (!["driver", "owner"].includes(String(payload.role || "").toLowerCase())) {
    throw new ApiError(403, "Insufficient permissions for this resource");
  }

  if (String(payload.role || "").toLowerCase() === "owner") {
    const owner = await Owner.findById(payload.sub);

    if (!owner) {
      throw new ApiError(404, "Owner not found");
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json({
      success: true,
      data: {
        id: owner._id,
        name: owner.owner_name || owner.name || owner.company_name || "",
        phone: owner.mobile || owner.phone || "",
        approve: owner.approve,
        status: owner.status,
        isOnline: false,
        isOnRide: false,
      },
    });
    return;
  }

  const driver = await Driver.findById(payload.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      approve: driver.approve,
      status: driver.status,
      isOnline: driver.isOnline,
      isOnRide: driver.isOnRide,
    },
  });
};

export const getServiceLocations = async (_req, res) => {
  const results = await listDriverServiceLocations();

  res.json({
    success: true,
    data: { results },
  });
};

export const getDriverDocumentTemplates = async (_req, res) => {
  const requestedRole = String(_req.query?.role || "driver").trim().toLowerCase();
  const isOwnerRequest = requestedRole === "owner";
  const results = isOwnerRequest
    ? await listOwnerNeededDocuments()
    : await listDriverNeededDocuments({
        activeOnly: true,
        includeFields: true,
      });

  res.json({
    success: true,
    data: {
      results: isOwnerRequest ? results.filter((item) => item.active !== false).map((item) => ({
        ...item,
        fields:
          item.image_type === "front_back"
            ? [
                {
                  key: `${String(item.name || "owner_document").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "owner_document"}_${String(item._id || "").replace(/[^a-zA-Z0-9]/g, "")}_front`,
                  label: `${item.name} Front`,
                  side: "front",
                  required: item.is_required !== false,
                },
                {
                  key: `${String(item.name || "owner_document").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "owner_document"}_${String(item._id || "").replace(/[^a-zA-Z0-9]/g, "")}_back`,
                  label: `${item.name} Back`,
                  side: "back",
                  required: item.is_required !== false,
                },
              ]
            : [
                {
                  key: `${String(item.name || "owner_document").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "owner_document"}_${String(item._id || "").replace(/[^a-zA-Z0-9]/g, "")}`,
                  label:
                    item.image_type === "front"
                      ? `${item.name} Front`
                      : item.image_type === "back"
                        ? `${item.name} Back`
                        : item.name,
                  side: item.image_type === "front" ? "front" : item.image_type === "back" ? "back" : "single",
                  required: item.is_required !== false,
                },
              ],
      }))
      : results,
    },
  });
};

export const addOwnerVehicle = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Vehicle addition is only available for owner accounts",
    );
  }

  const { vehicleTypeId, make, model, number, color, rcFile } = req.body;

  if (!make?.trim()) {
    throw new ApiError(400, "Car brand/make is required");
  }

  if (!model?.trim()) {
    throw new ApiError(400, "Car model is required");
  }

  if (!number?.trim()) {
    throw new ApiError(400, "License plate number is required");
  }

  if (!color?.trim()) {
    throw new ApiError(400, "Car color is required");
  }

  const normalizedPlate = String(number).trim().toUpperCase();

  // Check for duplicate license plate for this owner
  const existing = await FleetVehicle.findOne({
    owner_id: owner._id,
    license_plate_number: normalizedPlate,
  }).lean();

  if (existing) {
    throw new ApiError(
      409,
      "Fleet vehicle with this license plate already exists for this owner",
    );
  }

  // Get service location from owner or use first available
  let serviceLocationId = owner.service_location_id;
  if (!serviceLocationId) {
    const defaultLocation = await ServiceLocation.findOne({ active: true })
      .select("_id")
      .lean();
    if (!defaultLocation) {
      throw new ApiError(400, "No service location available");
    }
    serviceLocationId = defaultLocation._id;
  }

  const vehicle = await FleetVehicle.create({
    owner_id: owner._id,
    service_location_id: serviceLocationId,
    transport_type: "taxi",
    vehicle_type_id:
      vehicleTypeId && String(vehicleTypeId).trim() ? vehicleTypeId : null,
    car_brand: String(make).trim(),
    car_model: String(model).trim(),
    license_plate_number: normalizedPlate,
    car_color: String(color).trim(),
    status: "pending",
    active: true,
    documents: rcFile ? { rc: rcFile } : {},
  });

  const populated = await FleetVehicle.findById(vehicle._id)
    .populate("owner_id", "company_name owner_name name email mobile")
    .populate("service_location_id", "service_location_name name country")
    .populate("vehicle_type_id", "name type_name transport_type icon_types")
    .lean();

  res.status(201).json({
    success: true,
    message: "Vehicle added successfully and is pending approval",
    data: {
      id: String(populated._id),
      owner_id: String(populated.owner_id?._id || ""),
      owner_name:
        populated.owner_id?.company_name ||
        populated.owner_id?.owner_name ||
        populated.owner_id?.name ||
        "",
      service_location_id: String(populated.service_location_id?._id || ""),
      service_location_name:
        populated.service_location_id?.service_location_name ||
        populated.service_location_id?.name ||
        "",
      transport_type: populated.transport_type,
      vehicle_type_id: String(populated.vehicle_type_id?._id || ""),
      vehicle_type_name:
        populated.vehicle_type_id?.name ||
        populated.vehicle_type_id?.type_name ||
        "",
      car_brand: populated.car_brand,
      car_model: populated.car_model,
      license_plate_number: populated.license_plate_number,
      car_color: populated.car_color,
      status: populated.status,
      active: populated.active,
      createdAt: populated.createdAt,
    },
  });
};

export const getOwnerFleetVehicles = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet vehicle access is only available for owner accounts",
    );
  }

  const vehicles = await FleetVehicle.find({
    owner_id: owner._id,
    active: true,
  })
    .populate("vehicle_type_id", "name type_name transport_type icon_types")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: {
      results: vehicles.map((vehicle) => ({
        _id: String(vehicle._id),
        id: String(vehicle._id),
        vehicle_type_id: vehicle.vehicle_type_id?._id || null,
        vehicle_type_name:
          vehicle.vehicle_type_id?.name ||
          vehicle.vehicle_type_id?.type_name ||
          "",
        car_brand: vehicle.car_brand || "",
        car_model: vehicle.car_model || "",
        license_plate_number: vehicle.license_plate_number || "",
        car_color: vehicle.car_color || "",
        status: vehicle.status || "pending",
        reason: vehicle.reason || "",
        transport_type: vehicle.transport_type || "taxi",
        active: vehicle.active,
        createdAt: vehicle.createdAt,
      })),
    },
  });
};

export const updateOwnerFleetVehicle = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet vehicle access is only available for owner accounts",
    );
  }

  const vehicleId = String(req.params?.vehicleId || "").trim();
  if (!vehicleId || !mongoose.isValidObjectId(vehicleId)) {
    throw new ApiError(400, "A valid vehicle id is required");
  }

  const vehicle = await FleetVehicle.findOne({
    _id: vehicleId,
    owner_id: owner._id,
    active: true,
  });

  if (!vehicle) {
    throw new ApiError(404, "Fleet vehicle not found");
  }

  const vehicleTypeId =
    req.body?.vehicleTypeId || req.body?.vehicle_type_id || null;
  const make = String(
    req.body?.vehicleMake || req.body?.make || req.body?.car_brand || "",
  ).trim();
  const model = String(
    req.body?.vehicleModel || req.body?.model || req.body?.car_model || "",
  ).trim();
  const number = String(
    req.body?.vehicleNumber ||
      req.body?.number ||
      req.body?.license_plate_number ||
      "",
  )
    .trim()
    .toUpperCase();
  const color = String(
    req.body?.vehicleColor || req.body?.color || req.body?.car_color || "",
  ).trim();

  if (!vehicleTypeId || !mongoose.isValidObjectId(vehicleTypeId)) {
    throw new ApiError(400, "A valid vehicle type is required");
  }

  if (!make) {
    throw new ApiError(400, "Car brand/make is required");
  }

  if (!model) {
    throw new ApiError(400, "Car model is required");
  }

  if (!number) {
    throw new ApiError(400, "License plate number is required");
  }

  if (!color) {
    throw new ApiError(400, "Car color is required");
  }

  const duplicate = await FleetVehicle.findOne({
    owner_id: owner._id,
    license_plate_number: number,
    _id: { $ne: vehicle._id },
  }).lean();

  if (duplicate) {
    throw new ApiError(
      409,
      "Fleet vehicle with this license plate already exists for this owner",
    );
  }

  vehicle.vehicle_type_id = vehicleTypeId;
  vehicle.car_brand = make;
  vehicle.car_model = model;
  vehicle.license_plate_number = number;
  vehicle.car_color = color;

  await vehicle.save();

  const populated = await FleetVehicle.findById(vehicle._id)
    .populate("vehicle_type_id", "name type_name transport_type icon_types")
    .lean();

  res.json({
    success: true,
    message: "Vehicle updated successfully",
    data: {
      _id: String(populated._id),
      id: String(populated._id),
      vehicle_type_id: populated.vehicle_type_id?._id || null,
      vehicle_type_name:
        populated.vehicle_type_id?.name ||
        populated.vehicle_type_id?.type_name ||
        "",
      car_brand: populated.car_brand || "",
      car_model: populated.car_model || "",
      license_plate_number: populated.license_plate_number || "",
      car_color: populated.car_color || "",
      status: populated.status || "pending",
      reason: populated.reason || "",
      transport_type: populated.transport_type || "taxi",
      active: populated.active,
      createdAt: populated.createdAt,
    },
  });
};

export const deleteOwnerFleetVehicle = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet vehicle access is only available for owner accounts",
    );
  }

  const vehicle = await FleetVehicle.findOne({
    _id: req.params.vehicleId,
    owner_id: owner._id,
  });

  if (!vehicle) {
    throw new ApiError(404, "Fleet vehicle not found");
  }

  await FleetVehicle.deleteOne({ _id: vehicle._id });

  res.json({
    success: true,
    message: "Vehicle deleted successfully",
    data: { deleted: true },
  });
};

export const getOwnerFleetDrivers = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet driver access is only available for owner accounts",
    );
  }

  const drivers = await Driver.find({ owner_id: owner._id, deletedAt: null })
    .sort({ createdAt: -1 })
    .select("name phone email city salary approve status isOnline isOnRide createdAt")
    .lean();

  res.json({
    success: true,
    data: {
      results: drivers.map((driver) => ({
        id: String(driver._id),
        name: driver.name || "",
        phone: driver.phone || "",
        email: driver.email || "",
        city: driver.city || "",
        salary: Number(driver.salary || 0),
        approve: driver.approve,
        status: driver.status,
        isOnline: Boolean(driver.isOnline),
        isOnRide: Boolean(driver.isOnRide),
        createdAt: driver.createdAt,
      })),
    },
  });
};

export const createOwnerFleetDriver = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet driver access is only available for owner accounts",
    );
  }

  const name = String(req.body?.name || "").trim();
  const phone = normalizePhone(req.body?.phone || req.body?.mobile);
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  if (!name) {
    throw new ApiError(400, "name is required");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "A valid 10-digit mobile number is required");
  }

  const existing = await Driver.findOne({ phone }).lean();
  if (existing) {
    throw new ApiError(409, "Phone number is already registered");
  }

  const serviceLocation = owner.service_location_id
    ? await ServiceLocation.findById(owner.service_location_id).lean()
    : null;
  const coordinates =
    Array.isArray(serviceLocation?.location?.coordinates) &&
    serviceLocation.location.coordinates.length === 2
      ? serviceLocation.location.coordinates
      : typeof serviceLocation?.longitude === "number" &&
          typeof serviceLocation?.latitude === "number"
        ? [serviceLocation.longitude, serviceLocation.latitude]
        : [75.8577, 22.7196];

  const city =
    String(req.body?.city || "").trim() ||
    String(
      serviceLocation?.service_location_name || serviceLocation?.name || "",
    ).trim() ||
    "";

  const tempPassword = crypto.randomUUID().slice(0, 12);

  const driver = await Driver.create({
    owner_id: owner._id,
    service_location_id: owner.service_location_id || null,
    name,
    phone,
    email,
    salary: salaryValue,
    gender: "",
    password: await hashPassword(tempPassword),
    vehicleType: "car",
    vehicleIconType: "car",
    registerFor: "taxi",
    vehicleNumber: "",
    vehicleColor: "",
    city,
    approve: false,
    status: "pending",
    location: toPoint(coordinates, "location"),
  });

  res.status(201).json({
    success: true,
    data: {
      id: String(driver._id),
      message: "Fleet driver request created",
    },
  });
};

export const getOwnerFleetDashboard = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Owner dashboard is only available for owner accounts",
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [serviceLocation, drivers, vehicles] = await Promise.all([
    owner.service_location_id
      ? ServiceLocation.findById(owner.service_location_id)
          .select(
            "name service_location_name address city status active latitude longitude location currency_symbol currency_code timezone",
          )
          .lean()
      : null,
    Driver.find({ owner_id: owner._id, deletedAt: null })
      .select("name phone email city approve status isOnline isOnRide createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    FleetVehicle.find({ owner_id: owner._id, active: true })
      .populate("vehicle_type_id", "name type_name transport_type")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const driverIds = drivers.map((driver) => driver._id);

  const emptyMetrics = {
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    activeBookings: 0,
    grossRevenue: 0,
    ownerEarnings: 0,
    cashTrips: 0,
    onlineTrips: 0,
  };

  let rideMetrics = emptyMetrics;
  let todayMetrics = emptyMetrics;
  let transportBreakdown = [];
  let recentRides = [];

  if (driverIds.length > 0) {
    const [rideMetricsResult, todayMetricsResult, transportBreakdownResult, recentRideDocs] =
      await Promise.all([
        Ride.aggregate([
          { $match: { driverId: { $in: driverIds } } },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: {
                  $cond: [{ $eq: ["$status", RIDE_STATUS.COMPLETED] }, 1, 0],
                },
              },
              cancelledBookings: {
                $sum: {
                  $cond: [{ $eq: ["$status", RIDE_STATUS.CANCELLED] }, 1, 0],
                },
              },
              activeBookings: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              grossRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                    { $ifNull: ["$fare", 0] },
                    0,
                  ],
                },
              },
              ownerEarnings: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                    { $ifNull: ["$driverEarnings", 0] },
                    0,
                  ],
                },
              },
              cashTrips: {
                $sum: {
                  $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0],
                },
              },
              onlineTrips: {
                $sum: {
                  $cond: [{ $eq: ["$paymentMethod", "online"] }, 1, 0],
                },
              },
            },
          },
        ]),
        Ride.aggregate([
          {
            $match: {
              driverId: { $in: driverIds },
              createdAt: { $gte: startOfToday },
            },
          },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: {
                  $cond: [{ $eq: ["$status", RIDE_STATUS.COMPLETED] }, 1, 0],
                },
              },
              cancelledBookings: {
                $sum: {
                  $cond: [{ $eq: ["$status", RIDE_STATUS.CANCELLED] }, 1, 0],
                },
              },
              activeBookings: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              grossRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                    { $ifNull: ["$fare", 0] },
                    0,
                  ],
                },
              },
              ownerEarnings: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                    { $ifNull: ["$driverEarnings", 0] },
                    0,
                  ],
                },
              },
              cashTrips: {
                $sum: {
                  $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0],
                },
              },
              onlineTrips: {
                $sum: {
                  $cond: [{ $eq: ["$paymentMethod", "online"] }, 1, 0],
                },
              },
            },
          },
        ]),
        Ride.aggregate([
          { $match: { driverId: { $in: driverIds } } },
          {
            $group: {
              _id: { $ifNull: ["$transport_type", "taxi"] },
              trips: { $sum: 1 },
              completedTrips: {
                $sum: {
                  $cond: [{ $eq: ["$status", RIDE_STATUS.COMPLETED] }, 1, 0],
                },
              },
              earnings: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                    { $ifNull: ["$driverEarnings", 0] },
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { trips: -1, _id: 1 } },
        ]),
        Ride.find({ driverId: { $in: driverIds } })
          .select(
            "pickupAddress dropAddress status fare driverEarnings paymentMethod transport_type createdAt driverId",
          )
          .populate("driverId", "name phone")
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
      ]);

    const normalizeMetrics = (value = {}) => ({
      totalBookings: Number(value.totalBookings || 0),
      completedBookings: Number(value.completedBookings || 0),
      cancelledBookings: Number(value.cancelledBookings || 0),
      activeBookings: Number(value.activeBookings || 0),
      grossRevenue: Number(value.grossRevenue || 0),
      ownerEarnings: Number(value.ownerEarnings || 0),
      cashTrips: Number(value.cashTrips || 0),
      onlineTrips: Number(value.onlineTrips || 0),
    });

    rideMetrics = normalizeMetrics(rideMetricsResult[0] || emptyMetrics);
    todayMetrics = normalizeMetrics(todayMetricsResult[0] || emptyMetrics);
    transportBreakdown = transportBreakdownResult.map((item) => ({
      transportType: String(item._id || "taxi"),
      trips: Number(item.trips || 0),
      completedTrips: Number(item.completedTrips || 0),
      earnings: Number(item.earnings || 0),
    }));
    recentRides = recentRideDocs.map((ride) => ({
      id: String(ride._id),
      pickupAddress: ride.pickupAddress || "",
      dropAddress: ride.dropAddress || "",
      status: ride.status || "",
      fare: Number(ride.fare || 0),
      earnings: Number(ride.driverEarnings || 0),
      paymentMethod: ride.paymentMethod || "cash",
      transportType: ride.transport_type || "taxi",
      createdAt: ride.createdAt,
      driver: {
        id: String(ride.driverId?._id || ""),
        name: ride.driverId?.name || "",
        phone: ride.driverId?.phone || "",
      },
    }));
  }

  const approvedDrivers = drivers.filter(
    (driver) =>
      driver.approve === true ||
      String(driver.status || "").toLowerCase() === "approved",
  );
  const onlineDrivers = approvedDrivers.filter((driver) => driver.isOnline);
  const busyDrivers = approvedDrivers.filter((driver) => driver.isOnRide);
  const availableDrivers = approvedDrivers.filter(
    (driver) => driver.isOnline && !driver.isOnRide,
  );

  const approvedVehicles = vehicles.filter(
    (vehicle) => String(vehicle.status || "").toLowerCase() === "approved",
  );
  const pendingVehicles = vehicles.filter(
    (vehicle) => String(vehicle.status || "").toLowerCase() === "pending",
  );
  const rejectedVehicles = vehicles.filter(
    (vehicle) => String(vehicle.status || "").toLowerCase() === "rejected",
  );

  res.json({
    success: true,
    data: {
      profile: {
        id: String(owner._id),
        companyName: owner.company_name || owner.name || "",
        ownerName: owner.owner_name || owner.name || "",
        phone: owner.mobile || owner.phone || "",
        email: owner.email || "",
        city: owner.city || "",
        address: owner.address || "",
        transportType: owner.transport_type || "taxi",
        status: owner.status || "approved",
        walletBalance: Number(owner.wallet?.balance || 0),
        noOfVehicles: Number(owner.no_of_vehicles || 0),
      },
      serviceLocation: serviceLocation
        ? {
            id: String(serviceLocation._id),
            name:
              serviceLocation.service_location_name ||
              serviceLocation.name ||
              "",
            address: serviceLocation.address || "",
            status: serviceLocation.status || "active",
            active: serviceLocation.active !== false,
            latitude: Number(serviceLocation.latitude || 0),
            longitude: Number(serviceLocation.longitude || 0),
            currencySymbol:
              serviceLocation.currency_symbol &&
              serviceLocation.currency_symbol !== "â‚¹"
                ? serviceLocation.currency_symbol
                : "₹",
            currencyCode: serviceLocation.currency_code || "INR",
            timezone: serviceLocation.timezone || "Asia/Kolkata",
          }
        : null,
      fleet: {
        totalDrivers: drivers.length,
        approvedDrivers: approvedDrivers.length,
        onlineDrivers: onlineDrivers.length,
        busyDrivers: busyDrivers.length,
        availableDrivers: availableDrivers.length,
        pendingDrivers: Math.max(0, drivers.length - approvedDrivers.length),
        totalVehicles: vehicles.length,
        approvedVehicles: approvedVehicles.length,
        pendingVehicles: pendingVehicles.length,
        rejectedVehicles: rejectedVehicles.length,
      },
      bookings: {
        total: rideMetrics.totalBookings,
        active: rideMetrics.activeBookings,
        completed: rideMetrics.completedBookings,
        cancelled: rideMetrics.cancelledBookings,
        todayTotal: todayMetrics.totalBookings,
        todayCompleted: todayMetrics.completedBookings,
        todayCancelled: todayMetrics.cancelledBookings,
      },
      earnings: {
        walletBalance: Number(owner.wallet?.balance || 0),
        grossRevenue: rideMetrics.grossRevenue,
        ownerEarnings: rideMetrics.ownerEarnings,
        todayGrossRevenue: todayMetrics.grossRevenue,
        todayOwnerEarnings: todayMetrics.ownerEarnings,
        onlineTrips: rideMetrics.onlineTrips,
        cashTrips: rideMetrics.cashTrips,
      },
      transportBreakdown,
      recentDrivers: drivers.slice(0, 5).map((driver) => ({
        id: String(driver._id),
        name: driver.name || "",
        phone: driver.phone || "",
        city: driver.city || "",
        status: driver.status || "pending",
        isOnline: Boolean(driver.isOnline),
        isOnRide: Boolean(driver.isOnRide),
        createdAt: driver.createdAt,
      })),
      recentVehicles: vehicles.slice(0, 5).map((vehicle) => ({
        id: String(vehicle._id),
        brand: vehicle.car_brand || "",
        model: vehicle.car_model || "",
        color: vehicle.car_color || "",
        number: vehicle.license_plate_number || "",
        status: vehicle.status || "pending",
        transportType: vehicle.transport_type || "taxi",
        vehicleTypeName:
          vehicle.vehicle_type_id?.name ||
          vehicle.vehicle_type_id?.type_name ||
          "",
        createdAt: vehicle.createdAt,
      })),
      recentRides,
    },
  });
};

export const updateOwnerFleetDriver = async (req, res) => {
  const owner = await resolveAuthenticatedOwner(req);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet driver access is only available for owner accounts",
    );
  }

  const driverId = String(req.params?.driverId || "").trim();
  if (!driverId || !mongoose.isValidObjectId(driverId)) {
    throw new ApiError(400, "A valid driver id is required");
  }

  const driver = await Driver.findOne({
    _id: driverId,
    owner_id: owner._id,
    deletedAt: null,
  });

  if (!driver) {
    throw new ApiError(404, "Fleet driver not found");
  }

  const name = String(req.body?.name || "").trim();
  const phone = normalizePhone(req.body?.phone || req.body?.mobile);
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const salaryValue = Number(
    req.body?.salary ?? req.body?.monthly_salary ?? req.body?.monthlySalary ?? 0,
  );
  const city = String(req.body?.city || req.body?.address || "").trim();

  if (!name) {
    throw new ApiError(400, "name is required");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "A valid 10-digit mobile number is required");
  }

  if (!Number.isFinite(salaryValue) || salaryValue < 0) {
    throw new ApiError(400, "A valid non-negative salary is required");
  }

  const existing = await Driver.findOne({
    phone,
    _id: { $ne: driver._id },
  }).lean();
  if (existing) {
    throw new ApiError(409, "Phone number is already registered");
  }

  driver.name = name;
  driver.phone = phone;
  driver.email = email;
  driver.city = city || driver.city || "";
  driver.salary = salaryValue;

  await driver.save();

  res.json({
    success: true,
    message: "Fleet driver updated successfully",
    data: {
      id: String(driver._id),
      name: driver.name || "",
      phone: driver.phone || "",
      email: driver.email || "",
      city: driver.city || "",
      salary: Number(driver.salary || 0),
      approve: driver.approve,
      status: driver.status,
      isOnline: Boolean(driver.isOnline),
      isOnRide: Boolean(driver.isOnRide),
      createdAt: driver.createdAt,
    },
  });
};

export const startDriverLoginOtpRequest = async (req, res) => {
  const result = await startDriverLoginOtp(req.body);
  res.status(201).json({ success: true, data: result });
};

export const verifyDriverLoginOtpRequest = async (req, res) => {
  const result = await verifyDriverLoginOtp(req.body);
  res.json({ success: true, data: result });
};

export const startOnboarding = async (req, res) => {
  const result = await startDriverOnboarding(req.body);
  res.status(201).json({ success: true, data: result });
};

export const verifyOnboardingOtp = async (req, res) => {
  const result = await verifyDriverOtp(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingPersonal = async (req, res) => {
  const result = await saveDriverPersonalDetails(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingReferral = async (req, res) => {
  const result = await saveDriverReferral(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingVehicle = async (req, res) => {
  const result = await saveDriverVehicle(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingDocuments = async (req, res) => {
  const result = await saveDriverDocuments(req.body);
  res.json({ success: true, data: result });
};

export const completeOnboarding = async (req, res) => {
  const result = await completeDriverOnboarding(req.body);
  res.status(201).json({ success: true, data: result });
};

export const getOnboardingSession = async (req, res) => {
  const result = await getDriverOnboardingSession({
    registrationId: req.params.registrationId,
    phone: req.query.phone,
  });
  res.json({ success: true, data: result });
};

export const goOffline = async (req, res) => {
  const existingDriver = await Driver.findById(req.auth.sub);

  if (!existingDriver) {
    throw new ApiError(404, "Driver not found");
  }

  const finalizedTracking = mergeOnlineSessionIntoTracking(
    existingDriver.incentiveTracking || {},
    existingDriver.incentiveTracking?.currentOnlineStartedAt,
    new Date(),
  );

  const driver = await Driver.findByIdAndUpdate(
    req.auth.sub,
    {
      isOnline: false,
      socketId: null,
      incentiveTracking: {
        ...finalizedTracking,
        currentOnlineStartedAt: null,
        claimedRewards: pruneClaimedRewards(finalizedTracking?.claimedRewards),
      },
    },
    { returnDocument: 'after' },
  );

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.json({
    success: true,
    data: driver,
  });
};

export const getDriverIncentives = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub).lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const liveDriver = {
    ...driver,
    incentiveTracking: {
      ...(driver.incentiveTracking || {}),
      ...mergeOnlineSessionIntoTracking(
        driver.incentiveTracking || {},
        driver.incentiveTracking?.currentOnlineStartedAt,
        new Date(),
      ),
    },
  };

  const settingsDoc = await AdminBusinessSetting.findOne({ scope: "default" }).lean();
  const driverSettings = settingsDoc?.referral?.driver || {};
  const rides = await Ride.find({ driverId: driver._id }).select("status liveStatus createdAt updatedAt completedAt").lean();

  const snapshot = buildDriverIncentiveSnapshot({
    driver: liveDriver,
    settings: driverSettings,
    rides,
  });

  res.json({
    success: true,
    data: snapshot,
  });
};

export const claimDriverIncentiveReward = async (req, res) => {
  const { rewardType, rewardKey } = req.body || {};
  const normalizedRewardType = String(rewardType || "").trim().toLowerCase();
  const normalizedRewardKey = String(rewardKey || "").trim();

  if (!["milestone", "feature"].includes(normalizedRewardType) || !normalizedRewardKey) {
    throw new ApiError(400, "Valid reward type and reward key are required");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const settingsDoc = await AdminBusinessSetting.findOne({ scope: "default" }).lean();
  const driverSettings = settingsDoc?.referral?.driver || {};
  const rides = await Ride.find({ driverId: driver._id }).select("status liveStatus createdAt updatedAt completedAt").lean();
  const liveDriver = {
    ...driver.toObject(),
    incentiveTracking: {
      ...(driver.incentiveTracking || {}),
      ...mergeOnlineSessionIntoTracking(
        driver.incentiveTracking || {},
        driver.incentiveTracking?.currentOnlineStartedAt,
        new Date(),
      ),
    },
  };
  const snapshot = buildDriverIncentiveSnapshot({
    driver: liveDriver,
    settings: driverSettings,
    rides,
  });

  const targetReward =
    normalizedRewardType === "milestone"
      ? snapshot.milestones.find((item) => String(item.id) === normalizedRewardKey)
      : snapshot.features.find((item) => String(item.key) === normalizedRewardKey);

  if (!targetReward) {
    throw new ApiError(404, "Reward not found");
  }

  if (!targetReward.isEligible) {
    throw new ApiError(400, "Reward is not eligible yet");
  }

  if (targetReward.isClaimed) {
    throw new ApiError(400, "Reward already claimed");
  }

  const claimedRewards = pruneClaimedRewards([
    ...(Array.isArray(driver.incentiveTracking?.claimedRewards) ? driver.incentiveTracking.claimedRewards : []),
    {
      rewardType: normalizedRewardType,
      rewardKey: normalizedRewardType === "milestone" ? String(targetReward.id) : String(targetReward.key),
      periodKey: targetReward.periodKey,
      amount: Number(targetReward.payout_amount ?? targetReward.reward_amount ?? 0),
      claimedAt: new Date(),
      metadata: {
        label: targetReward.name || targetReward.label || "",
        targetValue: targetReward.targetValue ?? targetReward.progress?.targetWeeks ?? 0,
      },
    },
  ]);

  driver.incentiveTracking = {
    ...(liveDriver.incentiveTracking || {}),
    dailyActivity: pruneDailyActivity(liveDriver.incentiveTracking?.dailyActivity),
    claimedRewards,
  };
  await driver.save();

  const rewardAmount = Number(targetReward.payout_amount ?? targetReward.reward_amount ?? 0);

  const walletResult = await applyDriverWalletAdjustment({
    driverId: driver._id,
    amount: rewardAmount,
    type: "adjustment",
    description: `Incentive reward credited for ${targetReward.name || targetReward.label || "milestone"}`,
    metadata: {
      category: "driver_incentive",
      rewardType: normalizedRewardType,
      rewardKey: normalizedRewardType === "milestone" ? String(targetReward.id) : String(targetReward.key),
      periodKey: targetReward.periodKey,
    },
  });

  res.json({
    success: true,
    data: {
      wallet: walletResult.wallet,
      transaction: walletResult.transaction,
      claimedReward: {
        rewardType: normalizedRewardType,
        rewardKey: normalizedRewardKey,
        amount: rewardAmount,
        periodKey: targetReward.periodKey,
      },
    },
  });
};
