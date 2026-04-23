import api from '../../../shared/api/axiosInstance';

export const userService = {
  getAppModules: async () => {
    const response = await api.get('/users/app-modules');
    return response.data;
  },
};
