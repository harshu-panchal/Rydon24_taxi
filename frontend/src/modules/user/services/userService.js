import api from '../../../shared/api/axiosInstance';

export const userService = {
  getAppModules: async () => {
    const response = await api.get('/users/app-modules');
    return response;
  },
  getRentalVehicles: async () => {
    const response = await api.get('/users/rental-vehicles');
    return response;
  },
  getIntercityPackages: async () => {
    const response = await api.get('/users/intercity-packages');
    return response;
  },
  createRentalQuoteRequest: async (payload) => {
    const response = await api.post('/users/rental-quote-requests', payload);
    return response;
  },
  createRentalAdvanceOrder: async (payload) => {
    const response = await api.post('/users/rental-advance/razorpay/order', payload);
    return response;
  },
  verifyRentalAdvancePayment: async (payload) => {
    const response = await api.post('/users/rental-advance/razorpay/verify', payload);
    return response;
  },
  createRentalBookingRequest: async (payload) => {
    const response = await api.post('/users/rental-bookings', payload);
    return response;
  },
  getActiveRentalBooking: async () => {
    const response = await api.get('/users/rental-bookings/active');
    return response;
  },
  endRentalRide: async (bookingId) => {
    const response = await api.post(`/users/rental-bookings/${bookingId}/end`);
    return response;
  },
  getServiceLocations: async () => {
    const response = await api.get('/admin/service-locations');
    return response;
  },
  getServiceStores: async () => {
    const response = await api.get('/admin/service-stores');
    return response;
  },
  searchPoolingRoutes: async (params) => {
    const response = await api.get('/users/pooling/search', { params });
    return response;
  },
  getPoolingRouteDetails: async (id) => {
    const response = await api.get(`/users/pooling/routes/${id}`);
    return response;
  },
  createPoolingBooking: async (payload) => {
    const response = await api.post('/users/pooling/bookings', payload);
    return response;
  },
  getMyPoolingBookings: async () => {
    const response = await api.get('/users/pooling/bookings');
    return response;
  },
};
