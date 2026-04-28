import api from '../../../shared/api/axiosInstance';

export const userService = {
  getAppModules: async () => {
    const response = await api.get('/users/app-modules');
    return response.data;
  },
  getRentalVehicles: async () => {
    const response = await api.get('/users/rental-vehicles');
    return response.data;
  },
  createRentalQuoteRequest: async (payload) => {
    const response = await api.post('/users/rental-quote-requests', payload);
    return response.data;
  },
  createRentalAdvanceOrder: async (payload) => {
    const response = await api.post('/users/rental-advance/razorpay/order', payload);
    return response.data;
  },
  verifyRentalAdvancePayment: async (payload) => {
    const response = await api.post('/users/rental-advance/razorpay/verify', payload);
    return response.data;
  },
  createRentalBookingRequest: async (payload) => {
    const response = await api.post('/users/rental-bookings', payload);
    return response.data;
  },
  getActiveRentalBooking: async () => {
    const response = await api.get('/users/rental-bookings/active');
    return response.data;
  },
  endRentalRide: async (bookingId) => {
    const response = await api.post(`/users/rental-bookings/${bookingId}/end`);
    return response.data;
  },
  getServiceLocations: async () => {
    const response = await api.get('/admin/service-locations');
    return response.data;
  },
  getServiceStores: async () => {
    const response = await api.get('/admin/service-stores');
    return response.data;
  },
};
