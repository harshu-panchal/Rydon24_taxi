import api from '../../../shared/api/axiosInstance';

export const userBusService = {
  getRoutes: () => api.get('/users/buses/routes'),

  searchBuses: ({ fromCity, toCity, date }) =>
    api.get('/users/buses/search', {
      params: { fromCity, toCity, date },
    }),

  getSeatLayout: ({ busServiceId, scheduleId, date }) =>
    api.get(`/users/buses/${busServiceId}/seats`, {
      params: { scheduleId, date },
    }),

  getMyBookings: ({ page = 1, limit = 10 } = {}) =>
    api.get('/users/bus-bookings', {
      params: { page, limit },
    }),

  createBookingOrder: (payload) => api.post('/users/bus-bookings/order', payload),

  verifyBookingPayment: (payload) => api.post('/users/bus-bookings/verify', payload),
};

export default userBusService;
