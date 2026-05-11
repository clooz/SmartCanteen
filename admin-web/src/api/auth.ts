import request from '../utils/request'

export const authApi = {
  login: (data: { username: string; password: string }) =>
    request.post('/auth/login', data),

  getProfile: () => request.get('/auth/profile'),

  updateProfile: (data: { nickname: string }) =>
    request.put('/auth/profile', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    request.put('/auth/change-password', data),

  getCompanies: () => request.get('/auth/companies'),
}
