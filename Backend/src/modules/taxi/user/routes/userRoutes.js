import { Router } from 'express';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { authenticateOrResolveUser } from '../../middlewares/authMiddleware.js';
import {
  createBusBookingOrder,
  createRentalAdvancePaymentOrder,
  createRentalBookingRequest,
  createRentalQuoteRequest,
  createRazorpayWalletTopupOrder,
  getBusSeatLayout,
  getBusRouteSuggestions,
  listMyBusBookings,
  getUserWallet,
  getCurrentUser,
  getUserNotifications,
  deleteUserNotification,
  endMyActiveRentalRide,
  clearAllUserNotifications,
  getMyActiveRentalBooking,
  loginUser,
  registerUser,
  requestAccountDeletion,
  saveUserFcmToken,
  searchBuses,
  signupUser,
  startUserOtpRequest,
  topupUserWallet,
  transferUserWalletToDriver,
  transferUserWallet,
  updateCurrentUser,
  uploadUserProfileImage,
  verifyBusBookingPayment,
  verifyRentalAdvancePayment,
  verifyRazorpayWalletTopup,
  verifyUserOtpRequest,
  verifyUserPhoneForOtpLogin,
} from '../controllers/userController.js';
import {
  searchPoolingRoutes,
  getPoolingRouteDetails,
  createPoolingBooking,
  getMyPoolingBookings
} from '../controllers/poolingController.js';
import { getAppModules, getGoodsTypes, getPublicRentalVehicleCatalog, getPublicVehicleTypeCatalog } from '../../admin/controllers/adminController.js';

export const userRouter = Router();

userRouter.get('/app-modules', asyncHandler(getAppModules));
userRouter.get('/goods-types', asyncHandler(getGoodsTypes));
userRouter.get('/vehicle-types', asyncHandler(getPublicVehicleTypeCatalog));
userRouter.get('/rental-vehicles', asyncHandler(getPublicRentalVehicleCatalog));
userRouter.post('/rental-quote-requests', asyncHandler(createRentalQuoteRequest));
userRouter.post('/rental-bookings', authenticateOrResolveUser(['user']), asyncHandler(createRentalBookingRequest));
userRouter.get('/rental-bookings/active', authenticateOrResolveUser(['user']), asyncHandler(getMyActiveRentalBooking));
userRouter.post('/rental-bookings/:id/end', authenticateOrResolveUser(['user']), asyncHandler(endMyActiveRentalRide));
userRouter.post('/register', asyncHandler(registerUser));
userRouter.post('/signup', asyncHandler(signupUser));
userRouter.post('/login', asyncHandler(loginUser));
userRouter.post('/profile-image', asyncHandler(uploadUserProfileImage));
userRouter.post('/auth/send-otp', asyncHandler(startUserOtpRequest));
userRouter.post('/auth/verify-otp', asyncHandler(verifyUserOtpRequest));
userRouter.post('/otp-login', asyncHandler(verifyUserPhoneForOtpLogin));
userRouter.post('/fcm-token', authenticateOrResolveUser(['user']), asyncHandler(saveUserFcmToken));
userRouter.get('/me', authenticateOrResolveUser(['user']), asyncHandler(getCurrentUser));
userRouter.patch('/me', authenticateOrResolveUser(['user']), asyncHandler(updateCurrentUser));
userRouter.post('/me/delete-request', authenticateOrResolveUser(['user']), asyncHandler(requestAccountDeletion));
userRouter.get('/notifications', authenticateOrResolveUser(['user']), asyncHandler(getUserNotifications));
userRouter.delete('/notifications/:id', authenticateOrResolveUser(['user']), asyncHandler(deleteUserNotification));
userRouter.delete('/notifications', authenticateOrResolveUser(['user']), asyncHandler(clearAllUserNotifications));
userRouter.get('/wallet', authenticateOrResolveUser(['user']), asyncHandler(getUserWallet));
userRouter.post('/wallet/topup', authenticateOrResolveUser(['user']), asyncHandler(topupUserWallet));
userRouter.post('/wallet/transfer', authenticateOrResolveUser(['user']), asyncHandler(transferUserWallet));
userRouter.post('/wallet/transfer/driver', authenticateOrResolveUser(['user']), asyncHandler(transferUserWalletToDriver));
userRouter.post('/wallet/razorpay/order', authenticateOrResolveUser(['user']), asyncHandler(createRazorpayWalletTopupOrder));
userRouter.post('/wallet/razorpay/verify', authenticateOrResolveUser(['user']), asyncHandler(verifyRazorpayWalletTopup));
userRouter.post('/rental-advance/razorpay/order', authenticateOrResolveUser(['user']), asyncHandler(createRentalAdvancePaymentOrder));
userRouter.post('/rental-advance/razorpay/verify', authenticateOrResolveUser(['user']), asyncHandler(verifyRentalAdvancePayment));
userRouter.get('/buses/routes', authenticateOrResolveUser(['user']), asyncHandler(getBusRouteSuggestions));
userRouter.get('/buses/search', authenticateOrResolveUser(['user']), asyncHandler(searchBuses));
userRouter.get('/buses/:id/seats', authenticateOrResolveUser(['user']), asyncHandler(getBusSeatLayout));
userRouter.get('/bus-bookings', authenticateOrResolveUser(['user']), asyncHandler(listMyBusBookings));
userRouter.post('/bus-bookings/order', authenticateOrResolveUser(['user']), asyncHandler(createBusBookingOrder));
userRouter.post('/bus-bookings/verify', authenticateOrResolveUser(['user']), asyncHandler(verifyBusBookingPayment));

userRouter.get('/pooling/search', authenticateOrResolveUser(['user']), asyncHandler(searchPoolingRoutes));
userRouter.get('/pooling/routes/:id', authenticateOrResolveUser(['user']), asyncHandler(getPoolingRouteDetails));
userRouter.post('/pooling/bookings', authenticateOrResolveUser(['user']), asyncHandler(createPoolingBooking));
userRouter.get('/pooling/bookings', authenticateOrResolveUser(['user']), asyncHandler(getMyPoolingBookings));
