import { asyncHandler } from "../../../../utils/asyncHandler.js";
import * as adminService from "../services/adminService.js";
import ExcelJS from 'exceljs';
import { Driver } from '../../driver/models/Driver.js';
import { Owner } from '../models/Owner.js';
import { ServiceLocation } from '../models/ServiceLocation.js';

const ok = (res, data, extra = {}) =>
  res.json({ success: true, data, ...extra });

const sendFile = async (res, filename, reportData, format) => {
  const { headers, rows } = reportData;

  if (format === 'csv') {
    const content = adminService.csvFromRows(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(content);
  } else {
    // Generate real Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Add headers
    worksheet.addRow(headers.map(h => String(h).toUpperCase()));
    
    // Add rows
    rows.forEach(row => {
      worksheet.addRow(headers.map(h => row[h]));
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  }
};

export const getAdminStatus = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getAdminModuleInfo()),
);
export const loginAdmin = asyncHandler(async (req, res) =>
  ok(res, await adminService.loginAdmin(req.body)),
);
export const forgotPassword = asyncHandler(async (req, res) =>
  ok(res, await adminService.forgotPassword(req.body.email)),
);
export const verifyResetOtp = asyncHandler(async (req, res) =>
  ok(res, await adminService.verifyResetOtp(req.body)),
);
export const resetPassword = asyncHandler(async (req, res) =>
  ok(res, await adminService.resetPassword(req.body)),
);

export const getUsers = asyncHandler(async (req, res) =>
  ok(res, await adminService.listUsers(req.query)),
);
export const bulkImportUsers = asyncHandler(async (req, res) =>
  ok(res, await adminService.bulkImportUsers(req.body)),
);
export const bulkImportDrivers = asyncHandler(async (req, res) =>
  ok(res, await adminService.bulkImportDrivers(req.body)),
);
export const createUser = asyncHandler(async (req, res) =>
  ok(res, await adminService.createUser(req.body)),
);
export const updateUser = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateUser(req.params.id, req.body)),
);
export const getUser = asyncHandler(async (req, res) =>
  ok(res, await adminService.getUserById(req.params.id)),
);
export const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.params.id);
  ok(res, { deleted: true });
});

export const getDeletedUsers = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDeletedUsers(req.query)),
);

export const restoreDeletedUser = asyncHandler(async (req, res) =>
  ok(res, await adminService.restoreDeletedUser(req.params.id)),
);

export const permanentlyDeleteDeletedUser = asyncHandler(async (req, res) => {
  await adminService.permanentlyDeleteDeletedUser(req.params.id);
  ok(res, { deleted: true });
});

export const getUserDeletionRequests = asyncHandler(async (req, res) =>
  ok(res, await adminService.listUserDeletionRequests(req.query)),
);

export const approveUserDeletionRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.approveUserDeletionRequest(req.params.id, req.auth?.sub),
  ),
);

export const rejectUserDeletionRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.rejectUserDeletionRequest(
      req.params.id,
      req.body,
      req.auth?.sub,
    ),
  ),
);

export const getUserRequests = asyncHandler(async (req, res) =>
  ok(res, await adminService.listUserRequests(req.params.id)),
);

export const getUserWalletHistory = asyncHandler(async (req, res) =>
  ok(res, await adminService.listUserWalletHistory(req.params.id)),
);

export const adjustUserWallet = asyncHandler(async (req, res) =>
  ok(res, await adminService.adjustUserWallet(req.params.id, req.body)),
);

export const getDrivers = asyncHandler(async (req, res) => {
  const safePage = Number(req.query.page) || 1;
  const safeLimit = Number(req.query.limit) || 50;
  const start = (safePage - 1) * safeLimit;
  const query = { deletedAt: null };

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.approve !== undefined) {
    query.approve =
      req.query.approve === 'true' ||
      req.query.approve === true ||
      req.query.approve === 1;
  }

  if (req.query.isOnline !== undefined) {
    query.isOnline =
      req.query.isOnline === 'true' ||
      req.query.isOnline === true ||
      req.query.isOnline === 1;
  }

  if (req.query.search) {
    const regex = new RegExp(
      String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );
    query.$or = [
      { name: regex },
      { phone: regex },
      { email: regex },
      { vehicleNumber: regex },
    ];
  }

  const total = await Driver.countDocuments(query);
  const drivers = await Driver.find(query)
    .select(
      '_id name phone email owner_id service_location_id city registerFor vehicleType vehicleNumber vehicleColor rating ratingCount isOnline onlineSelfie approve status createdAt updatedAt',
    )
    .sort({ createdAt: -1 })
    .skip(start)
    .limit(safeLimit)
    .lean();

  const ownerIds = [
    ...new Set(drivers.map((driver) => String(driver.owner_id || '')).filter(Boolean)),
  ];
  const serviceLocationIds = [
    ...new Set(
      drivers.map((driver) => String(driver.service_location_id || '')).filter(Boolean),
    ),
  ];

  const [owners, serviceLocations] = await Promise.all([
    ownerIds.length
      ? Owner.find({ _id: { $in: ownerIds } })
          .select('_id company_name owner_name name email mobile')
          .lean()
      : [],
    serviceLocationIds.length
      ? ServiceLocation.find({ _id: { $in: serviceLocationIds } })
          .select('_id service_location_name name country')
          .lean()
      : [],
  ]);

  const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));
  const serviceLocationMap = new Map(
    serviceLocations.map((location) => [String(location._id), location]),
  );

  const results = drivers.map((driver) => {
    const owner = driver.owner_id ? ownerMap.get(String(driver.owner_id)) || null : null;
    const serviceLocation = driver.service_location_id
      ? serviceLocationMap.get(String(driver.service_location_id)) || null
      : null;

    return {
      _id: driver._id,
      id: driver._id,
      name: driver.name || '',
      phone: driver.phone || '',
      mobile: driver.phone || '',
      email: driver.email || '',
      owner_id: owner,
      service_location_id: serviceLocation,
      city: driver.city || '',
      service_location_name:
        serviceLocation?.service_location_name ||
        serviceLocation?.name ||
        driver.city ||
        '',
      transport_type: driver.registerFor || driver.vehicleType || '',
      register_for: driver.registerFor || '',
      vehicle_type: driver.vehicleType || '',
      vehicle_number: driver.vehicleNumber || '',
      vehicle_color: driver.vehicleColor || '',
      rating: Number(driver.ratingCount || 0) > 0 ? Number(driver.rating || 0) : 0,
      rating_count: Number(driver.ratingCount || 0),
      isOnline: Boolean(driver.isOnline),
      online_selfie_image: driver.onlineSelfie?.imageUrl || '',
      online_selfie_captured_at: driver.onlineSelfie?.capturedAt || null,
      online_selfie_for_date: driver.onlineSelfie?.forDate || '',
      approve: Boolean(driver.approve),
      status: driver.status || (driver.approve ? 'approved' : 'pending'),
      active:
        driver.approve !== false &&
        String(driver.status || '').toLowerCase() !== 'inactive',
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  });

  ok(res, {
    results,
    paginator: {
      current_page: safePage,
      per_page: safeLimit,
      total,
      last_page: Math.max(1, Math.ceil(total / safeLimit)),
    },
  });
});

export const getDriverRatings = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDriverRatings(req.query)),
);

export const getDriverRatingDetail = asyncHandler(async (req, res) =>
  ok(res, await adminService.getDriverRatingDetail(req.params.id)),
);

export const listDriverWalletHistory = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDriverWalletHistory(req.params.id)),
);

export const adjustOwnerWallet = asyncHandler(async (req, res) =>
  ok(res, await adminService.adjustOwnerWallet(req.params.id, req.body)),
);

export const listOwnerWalletHistory = asyncHandler(async (req, res) =>
  ok(res, await adminService.listOwnerWalletHistory(req.params.id)),
);

export const getNegativeBalanceDrivers = asyncHandler(async (req, res) =>
  ok(res, await adminService.listNegativeBalanceDrivers(req.query)),
);

export const getDriverWithdrawalSummaries = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDriverWithdrawalSummaries(req.query)),
);

export const getDriverWithdrawals = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.listDriverWithdrawals({
      driverId: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
    }),
  ),
);

export const getDriverWithdrawalContextByRequestId = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.getDriverWithdrawalContextByRequestId({
      requestId: req.params.requestId,
      page: req.query.page,
      limit: req.query.limit,
    }),
  ),
);

export const approveDriverWithdrawalRequest = asyncHandler(async (req, res) =>
  ok(res, await adminService.approveDriverWithdrawalRequest(req.params.requestId, req.auth?.sub)),
);

export const rejectDriverWithdrawalRequest = asyncHandler(async (req, res) =>
  ok(res, await adminService.rejectDriverWithdrawalRequest(req.params.requestId)),
);


export const getDeletedDrivers = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDeletedDrivers(req.query)),
);

export const restoreDeletedDriver = asyncHandler(async (req, res) =>
  ok(res, await adminService.restoreDeletedDriver(req.params.id)),
);

export const permanentlyDeleteDeletedDriver = asyncHandler(async (req, res) => {
  await adminService.permanentlyDeleteDeletedDriver(req.params.id);
  ok(res, { deleted: true });
});

export const getDriverDeletionRequests = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDriverDeletionRequests(req.query)),
);

export const approveDriverDeletionRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.approveDriverDeletionRequest(req.params.id, req.auth?.sub),
  ),
);

export const rejectDriverDeletionRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.rejectDriverDeletionRequest(
      req.params.id,
      req.body,
      req.auth?.sub,
    ),
  ),
);

export const createDriver = asyncHandler(async (req, res) =>
  ok(res, await adminService.createDriver(req.body)),
);
export const getDriver = asyncHandler(async (req, res) =>
  ok(res, await adminService.getDriverById(req.params.id)),
);
export const getDriverProfile = asyncHandler(async (req, res) =>
  ok(res, await adminService.getDriverProfile(req.params.id)),
);
export const updateDriver = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateDriver(req.params.id, req.body)),
);
export const updateDriverPassword = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.updateDriverPassword(req.params.id, req.body.password),
  ),
);
export const deleteDriver = asyncHandler(async (req, res) => {
  await adminService.deleteDriver(req.params.id);
  ok(res, { deleted: true });
});

export const adjustDriverWallet = asyncHandler(async (req, res) =>
  ok(res, await adminService.adjustDriverWallet(req.params.id, req.body)),
);

export const getSubscriptionPlans = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listSubscriptionPlans() }),
);
export const createSubscriptionPlan = asyncHandler(async (req, res) =>
  ok(res, await adminService.createSubscriptionPlan(req.body)),
);

export const getSubscriptionSettings = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getSubscriptionSettings()),
);
export const updateSubscriptionSettings = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateSubscriptionSettings(req.body)),
);

export const getReferralSettings = asyncHandler(async (req, res) =>
  ok(res, await adminService.getReferralSettings(req.params.type)),
);

export const updateReferralSettings = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateReferralSettings(req.params.type, req.body)),
);

export const getReferralDashboard = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getReferralDashboard()),
);

export const getServiceLocations = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listServiceLocations()),
);
export const getServiceStores = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listServiceStores() }),
);
export const getCountries = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listCountries() }),
);
export const createServiceLocation = asyncHandler(async (req, res) =>
  ok(res, await adminService.createServiceLocation(req.body)),
);
export const createServiceStore = asyncHandler(async (req, res) =>
  ok(res, await adminService.createServiceStore(req.body)),
);
export const updateServiceLocation = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateServiceLocation(req.params.id, req.body)),
);
export const updateServiceStore = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateServiceStore(req.params.id, req.body)),
);
export const deleteServiceLocation = asyncHandler(async (req, res) => {
  await adminService.deleteServiceLocation(req.params.id);
  ok(res, { deleted: true });
});
export const deleteServiceStore = asyncHandler(async (req, res) => {
  await adminService.deleteServiceStore(req.params.id);
  ok(res, { deleted: true });
});
export const getNearbyServiceLocations = asyncHandler(async (req, res) =>
  ok(res, {
    results: await adminService.listNearbyServiceLocations(req.query),
  }),
);
export const getRideModules = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listRideModules()),
);
export const getOngoingRides = asyncHandler(async (req, res) =>
  ok(res, await adminService.listOngoingRides(req.query)),
);
export const getRideRequests = asyncHandler(async (req, res) =>
  ok(res, await adminService.listRideRequests(req.query)),
);
export const getDeliveries = asyncHandler(async (req, res) =>
  ok(res, await adminService.listDeliveries(req.query)),
);
export const getIntercityTrips = asyncHandler(async (req, res) =>
  ok(res, await adminService.listIntercityTrips(req.query)),
);
export const deleteOngoingRide = asyncHandler(async (req, res) =>
  ok(res, await adminService.deleteOngoingRide(req.params.id)),
);
export const getVehicleTypes = asyncHandler(async (req, res) =>
  ok(res, await adminService.listVehicleTypes(req.query)),
);
export const getVehicleTypeCatalog = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listVehicleCatalog()),
);
export const getPublicVehicleTypeCatalog = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listPublicVehicleCatalog()),
);
export const getVehiclePreferenceOptions = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listVehiclePreferences()),
);
export const createVehicleType = asyncHandler(async (req, res) =>
  ok(res, await adminService.createVehicleType(req.body)),
);
export const updateVehicleType = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateVehicleType(req.params.id, req.body)),
);
export const deleteVehicleType = asyncHandler(async (req, res) => {
  await adminService.deleteVehicleType(req.params.id);
  ok(res, { deleted: true });
});

export const getOwners = asyncHandler(async (req, res) =>
  ok(res, { results: await adminService.listOwners(req.query) }),
);
export const getOwner = asyncHandler(async (req, res) =>
  ok(res, await adminService.getOwnerById(req.params.id)),
);
export const createOwner = asyncHandler(async (req, res) =>
  ok(res, await adminService.createOwner(req.body)),
);
export const updateOwner = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateOwner(req.params.id, req.body)),
);
export const approveOwner = asyncHandler(async (req, res) =>
  ok(res, await adminService.approveOwner(req.params.id, req.body)),
);
export const approveOwnerSignupFromDriver = asyncHandler(async (req, res) =>
  ok(res, await adminService.approveOwnerSignupFromDriver(req.params.driverId)),
);
export const deleteOwner = asyncHandler(async (req, res) => {
  await adminService.deleteOwner(req.params.id);
  ok(res, { deleted: true });
});

export const getFleetVehicles = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listFleetVehicles()),
);
export const createFleetVehicle = asyncHandler(async (req, res) =>
  ok(res, await adminService.createFleetVehicle(req.body)),
);
export const updateFleetVehicle = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateFleetVehicle(req.params.id, req.body)),
);
export const deleteFleetVehicle = asyncHandler(async (req, res) => {
  await adminService.deleteFleetVehicle(req.params.id);
  ok(res, { deleted: true });
});

export const getOwnerBookings = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listOwnerBookings() }),
);
export const createOwnerBooking = asyncHandler(async (req, res) =>
  ok(res, await adminService.createOwnerBooking(req.body)),
);
export const updateOwnerBooking = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateOwnerBooking(req.params.id, req.body)),
);
export const deleteOwnerBooking = asyncHandler(async (req, res) => {
  await adminService.deleteOwnerBooking(req.params.id);
  ok(res, { deleted: true });
});

export const getDashboardData = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getDashboardData()),
);
export const getOwnerDashboardData = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getOwnerDashboardData()),
);
export const getOverallEarnings = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getOverallEarnings()),
);
export const getAdminEarnings = asyncHandler(async (req, res) =>
  ok(res, await adminService.getAdminEarnings(req.query)),
);
export const getTodayEarnings = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getTodayEarnings()),
);
export const getCancelChart = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getCancelChart()),
);
export const getWithdrawals = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listWithdrawals() }),
);

export const getZones = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listZones() }),
);
export const createZone = asyncHandler(async (req, res) =>
  ok(res, await adminService.createZone(req.body)),
);
export const updateZone = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateZone(req.params.id, req.body)),
);
export const deleteZone = asyncHandler(async (req, res) => {
  await adminService.deleteZone(req.params.id);
  ok(res, { deleted: true });
});
export const toggleZoneStatus = asyncHandler(async (req, res) =>
  ok(res, await adminService.toggleZoneStatus(req.params.id)),
);

export const getSetPrices = asyncHandler(async (_req, res) => {
  const data = await adminService.listSetPrices();
  res.json({ success: true, ...data });
});
export const createSetPrice = asyncHandler(async (req, res) =>
  ok(res, await adminService.createSetPrice(req.body)),
);
export const updateSetPrice = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateSetPrice(req.params.id, req.body)),
);
export const deleteSetPrice = asyncHandler(async (req, res) => {
  await adminService.deleteSetPrice(req.params.id);
  ok(res, { deleted: true });
});

export const getAirports = asyncHandler(async (_req, res) =>
  ok(res, { airports: await adminService.listAirports() }),
);
export const createAirport = asyncHandler(async (req, res) =>
  ok(res, await adminService.createAirport(req.body)),
);
export const updateAirport = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateAirport(req.params.id, req.body)),
);
export const deleteAirport = asyncHandler(async (req, res) => {
  await adminService.deleteAirport(req.params.id);
  ok(res, { deleted: true });
});

export const getBusServices = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listBusServices() }),
);
export const createBusService = asyncHandler(async (req, res) =>
  ok(res, await adminService.createBusService(req.body)),
);
export const updateBusService = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateBusService(req.params.id, req.body)),
);
export const deleteBusService = asyncHandler(async (req, res) => {
  await adminService.deleteBusService(req.params.id);
  ok(res, { deleted: true });
});

export const getRentalVehicleTypes = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listRentalVehicleTypes() }),
);
export const createRentalVehicleType = asyncHandler(async (req, res) =>
  ok(res, await adminService.createRentalVehicleType(req.body)),
);
export const updateRentalVehicleType = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateRentalVehicleType(req.params.id, req.body)),
);
export const deleteRentalVehicleType = asyncHandler(async (req, res) => {
  await adminService.deleteRentalVehicleType(req.params.id);
  ok(res, { deleted: true });
});

export const getGoodsTypes = asyncHandler(async (_req, res) =>
  res.json(await adminService.listGoodsTypes()),
);
export const createGoodsType = asyncHandler(async (req, res) =>
  ok(res, await adminService.createGoodsType(req.body)),
);
export const updateGoodsType = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateGoodsType(req.params.id, req.body)),
);
export const deleteGoodsType = asyncHandler(async (req, res) => {
  await adminService.deleteGoodsType(req.params.id);
  ok(res, { deleted: true });
});

export const getRentalPackageTypes = asyncHandler(async (_req, res) =>
  ok(res, { rental_packages: await adminService.listRentalPackageTypes() }),
);
export const createRentalPackageType = asyncHandler(async (req, res) =>
  ok(res, await adminService.createRentalPackageType(req.body)),
);
export const updateRentalPackageType = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateRentalPackageType(req.params.id, req.body)),
);
export const deleteRentalPackageType = asyncHandler(async (req, res) => {
  await adminService.deleteRentalPackageType(req.params.id);
  ok(res, { deleted: true });
});

export const getOwnerNeededDocuments = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listOwnerNeededDocuments() }),
);
export const getDriverNeededDocuments = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listDriverNeededDocuments() }),
);
export const getDriverNeededDocument = asyncHandler(async (req, res) =>
  ok(res, await adminService.getDriverNeededDocumentById(req.params.id)),
);
export const createDriverNeededDocument = asyncHandler(async (req, res) =>
  ok(res, await adminService.createDriverNeededDocument(req.body)),
);
export const updateDriverNeededDocument = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateDriverNeededDocument(req.params.id, req.body)),
);
export const deleteDriverNeededDocument = asyncHandler(async (req, res) => {
  await adminService.deleteDriverNeededDocument(req.params.id);
  ok(res, { deleted: true });
});
export const getReferralTranslations = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listReferralTranslations() }),
);
export const updateReferralTranslation = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateReferralTranslation(req.params.languageCode, req.body)),
);
export const createOwnerNeededDocument = asyncHandler(async (req, res) =>
  ok(res, await adminService.createOwnerNeededDocument(req.body)),
);
export const updateOwnerNeededDocument = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.updateOwnerNeededDocument(req.params.id, req.body),
  ),
);
export const deleteOwnerNeededDocument = asyncHandler(async (req, res) => {
  await adminService.deleteOwnerNeededDocument(req.params.id);
  ok(res, { deleted: true });
});

export const getLanguages = asyncHandler(async (_req, res) => {
  const items = await adminService.listLanguages();
  res.json({ success: true, paginator: { data: items }, results: items });
});
export const updateLanguageStatus = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateLanguageStatus(req.params.id, req.body)),
);
export const deleteLanguage = asyncHandler(async (req, res) => {
  await adminService.deleteLanguage(req.params.id);
  ok(res, { deleted: true });
});

export const getPreferences = asyncHandler(async (_req, res) => {
  const items = await adminService.listPreferences();
  res.json({ success: true, paginator: { data: items }, results: items });
});
export const createPreference = asyncHandler(async (req, res) =>
  ok(res, await adminService.createPreference(req.body)),
);
export const updatePreferenceStatus = asyncHandler(async (req, res) =>
  ok(res, await adminService.updatePreferenceStatus(req.params.id, req.body)),
);
export const deletePreference = asyncHandler(async (req, res) => {
  await adminService.deletePreference(req.params.id);
  ok(res, { deleted: true });
});

export const getRoles = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listRoles() }),
);
export const createRole = asyncHandler(async (req, res) =>
  ok(res, await adminService.createRole(req.body)),
);
export const deleteRole = asyncHandler(async (req, res) => {
  await adminService.deleteRole(req.params.id);
  ok(res, { deleted: true });
});

export const getAppModules = asyncHandler(async (req, res) =>
  ok(res, await adminService.listAppModules(req.query)),
);
export const createAppModule = asyncHandler(async (req, res) =>
  ok(res, await adminService.createAppModule(req.body)),
);
export const updateAppModule = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateAppModule(req.params.id, req.body)),
);
export const deleteAppModule = asyncHandler(async (req, res) => {
  await adminService.deleteAppModule(req.params.id);
  ok(res, { deleted: true });
});

export const getNotificationChannels = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listNotificationChannels() }),
);
export const toggleChannelPush = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.updateNotificationChannelField(
      req.params.id,
      "push_notification",
      req.body.push_notification,
    ),
  ),
);
export const toggleChannelMail = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.updateNotificationChannelField(
      req.params.id,
      "mail",
      req.body.mail,
    ),
  ),
);

export const getPaymentGateways = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listPaymentGateways() }),
);
export const getPaymentMethods = asyncHandler(async (_req, res) =>
  ok(res, { results: await adminService.listPaymentMethods() }),
);
export const createPaymentMethod = asyncHandler(async (req, res) =>
  ok(res, await adminService.createPaymentMethod(req.body)),
);
export const updatePaymentMethod = asyncHandler(async (req, res) =>
  ok(res, await adminService.updatePaymentMethod(req.params.id, req.body)),
);
export const deletePaymentMethod = asyncHandler(async (req, res) => {
  await adminService.deletePaymentMethod(req.params.id);
  ok(res, { deleted: true });
});
export const getPaymentSettings = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getPaymentSettings()),
);
export const updatePaymentSettings = asyncHandler(async (req, res) =>
  ok(res, await adminService.updatePaymentSettings(req.body)),
);

export const getSmsSettings = asyncHandler(async (_req, res) =>
  ok(res, await adminService.getSMSSettings()),
);
export const updateSmsSettings = asyncHandler(async (req, res) =>
  ok(res, await adminService.updateSMSSettings(req.body)),
);

export const getFirebaseSettings = asyncHandler(async (_req, res) =>
  ok(res, { settings: await adminService.getFirebaseSettings() }),
);
export const updateFirebaseSettings = asyncHandler(async (req, res) =>
  ok(res, { settings: await adminService.updateFirebaseSettings(req.body) }),
);

export const getMapSettings = asyncHandler(async (_req, res) =>
  ok(res, { settings: await adminService.getMapSettings() }),
);
export const updateMapSettings = asyncHandler(async (req, res) =>
  ok(res, { settings: await adminService.updateMapSettings(req.body) }),
);

export const getMailSettings = asyncHandler(async (_req, res) =>
  ok(res, { settings: await adminService.getMailSettings() }),
);
export const updateMailSettings = asyncHandler(async (req, res) =>
  ok(res, { settings: await adminService.updateMailSettings(req.body) }),
);

export const getUserOnboarding = asyncHandler(async (_req, res) =>
  res.json({
    success: true,
    results: await adminService.listOnboardingScreens("user"),
  }),
);
export const getDriverOnboarding = asyncHandler(async (_req, res) =>
  res.json({
    success: true,
    results: await adminService.listOnboardingScreens("driver"),
  }),
);
export const getOwnerOnboarding = asyncHandler(async (_req, res) =>
  res.json({
    success: true,
    results: await adminService.listOnboardingScreens("owner"),
  }),
);

export const downloadUserReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildUserReport(req.query);
  await sendFile(res, "user-report", data, format);
});

export const downloadDriverReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildDriverReport(req.query);
  await sendFile(res, "driver-report", data, format);
});

export const downloadDriverDutyReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildDriverDutyReport(req.query);
  await sendFile(res, "driver-duty-report", data, format);
});

export const downloadOwnerReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildOwnerReport(req.query);
  await sendFile(res, "owner-report", data, format);
});

export const downloadFinanceReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildFinanceReport(req.query);
  await sendFile(res, "finance-report", data, format);
});

export const downloadFleetFinanceReport = asyncHandler(async (req, res) => {
  const format = req.query.file_format || 'csv';
  const data = await adminService.buildFleetFinanceReport(req.query);
  await sendFile(res, "fleet-finance-report", data, format);
});
export const getGeneralSettingsCategory = asyncHandler(async (req, res) =>
  ok(res, await adminService.getGeneralSettings(req.params.category)),
);
export const updateGeneralSettingsCategory = asyncHandler(async (req, res) =>
  ok(
    res,
    await adminService.updateGeneralSettings(req.params.category, req.body),
  ),
);
export const getTransportTypes = asyncHandler(async (_req, res) =>
  ok(res, await adminService.listTransportTypes()),
);
