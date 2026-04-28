import { PoolingRoute } from '../../admin/models/PoolingRoute.js';
import { PoolingVehicle } from '../../admin/models/PoolingVehicle.js';
import { PoolingBooking } from '../../admin/models/PoolingBooking.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { ApiError } from '../../../../utils/ApiError.js';

const ok = (res, data, message) => res.status(200).json({ success: true, data, message });
const created = (res, data, message) => res.status(201).json({ success: true, data, message });

export const searchPoolingRoutes = asyncHandler(async (req, res) => {
  const { from, to, date } = req.query;
  
  // Search for routes where origin or destination matches (fuzzy search for now)
  const routes = await PoolingRoute.find({
    status: 'active',
    $or: [
      { originLabel: { $regex: from || '', $options: 'i' } },
      { destinationLabel: { $regex: to || '', $options: 'i' } }
    ]
  }).populate('assignedVehicleTypeIds');

  // Filter routes that actually connect from -> to if needed, 
  // but for simplicity we return routes matching the search
  
  return ok(res, routes, 'Routes fetched successfully');
});

export const getPoolingRouteDetails = asyncHandler(async (req, res) => {
  const route = await PoolingRoute.findById(req.params.id)
    .populate('assignedVehicleTypeIds');
  
  if (!route) throw new ApiError(404, 'Route not found');

  // For each vehicle type, we'd normally get available schedules/trips
  // For now, we'll return the route and the vehicles it supports
  
  return ok(res, route, 'Route details fetched successfully');
});

export const createPoolingBooking = asyncHandler(async (req, res) => {
  const { routeId, vehicleId, scheduleId, selectedSeats, fare, pickupPoint, dropPoint } = req.body;
  
  const booking = await PoolingBooking.create({
    userId: req.user._id,
    routeId,
    vehicleId,
    scheduleId,
    selectedSeats,
    fare,
    pickupPoint,
    dropPoint,
    status: 'confirmed'
  });

  return created(res, booking, 'Booking created successfully');
});

export const getMyPoolingBookings = asyncHandler(async (req, res) => {
  const bookings = await PoolingBooking.find({ userId: req.user._id })
    .populate('routeId')
    .populate('vehicleId')
    .sort({ createdAt: -1 });

  return ok(res, bookings, 'My bookings fetched successfully');
});
