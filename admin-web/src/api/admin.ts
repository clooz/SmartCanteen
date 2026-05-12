import request from '../utils/request'

export const adminApi = {
  // 用户管理
  getUsers: (params?: object) => request.get('/admin/users', { params }),
  createUser: (data: object) => request.post('/admin/users', data),
  updateUser: (id: number, data: object) => request.put(`/admin/users/${id}`, data),
  resetPassword: (id: number, data: object) =>
    request.put(`/admin/users/${id}/reset-password`, data),
  /**
   * 外部工作平台批量同步用户（钉钉/企微/飞书/自研HR皆可对接）
   * source: 来源标识字符串，如 'dingtalk' | 'wecom' | 'feishu' | 'hr'
   * users:  用户数组，每项包含 ext_uid / username / nickname / company_code / role / is_active
   */
  syncUsers: (data: { source: string; users: object[] }) =>
    request.post('/admin/users/sync', data),

  // 公司管理
  getCompanies: () => request.get('/admin/companies'),
  createCompany: (data: object) => request.post('/admin/companies', data),
  updateCompany: (id: number, data: object) =>
    request.put(`/admin/companies/${id}`, data),

  // 充值管理
  getRecharges: (params?: object) => request.get('/recharge', { params }),
  reviewRecharge: (id: number, data: object) =>
    request.put(`/recharge/${id}/review`, data),
}
