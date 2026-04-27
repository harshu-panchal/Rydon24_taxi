import { Router } from 'express';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { authenticate, authenticateOrResolveUser } from '../../middlewares/authMiddleware.js';
import {
  cancelRide,
  createRazorpayRideTipOrder,
  createRide,
  getRideAppTipSettings,
  getMyActiveRide,
  getRideById,
  listMyRides,
  listAvailableDrivers,
  submitRideReview,
  updateRideStatus,
  verifyRazorpayRideTip,
} from '../controllers/rideController.js';

export const rideRouter = Router();

rideRouter.post('/', authenticateOrResolveUser(['user']), asyncHandler(createRide));
rideRouter.get('/', authenticateOrResolveUser(['user', 'driver']), asyncHandler(listMyRides));
rideRouter.get('/app-settings/tip', asyncHandler(getRideAppTipSettings));
rideRouter.get('/available-drivers', asyncHandler(listAvailableDrivers));
rideRouter.get('/active/me', authenticateOrResolveUser(['user', 'driver']), asyncHandler(getMyActiveRide));
rideRouter.patch('/:rideId/cancel', authenticate(['user']), asyncHandler(cancelRide));
rideRouter.get('/:rideId', authenticateOrResolveUser(['user', 'driver']), asyncHandler(getRideById));
rideRouter.patch('/:rideId/status', authenticate(['driver']), asyncHandler(updateRideStatus));
rideRouter.post('/:rideId/tip/razorpay/order', authenticate(['user']), asyncHandler(createRazorpayRideTipOrder));
rideRouter.post('/:rideId/tip/razorpay/verify', authenticate(['user']), asyncHandler(verifyRazorpayRideTip));
rideRouter.patch('/:rideId/feedback', authenticate(['user']), asyncHandler(submitRideReview));
