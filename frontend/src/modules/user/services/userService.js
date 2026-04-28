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
  getServiceLocations: async () => {
    const response = await api.get('/admin/service-locations');
    return response.data;
  },
  getServiceStores: async () => {
    const response = await api.get('/admin/service-stores');
    return response.data;
  },
};
