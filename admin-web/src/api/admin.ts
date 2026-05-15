import request from '../utils/request'

export const adminApi = {
  /** 用户列表「后台岗位」筛选项（非超管；失败静默，避免旧后端无此路由时刷屏） */
  listAdminRolesBrief: () =>
    request.get('/admin/lookup/admin-roles', { skipErrorToast: true } as Parameters<typeof request.get>[1]),

  // 用户管理
  getUsers: (params?: object, reqConfig?: { skipErrorToast?: boolean }) =>
    request.get('/admin/users', { params, ...reqConfig } as Parameters<typeof request.get>[1]),
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
  deleteCompany: (id: number) => request.delete(`/admin/companies/${id}`),

  // 充值管理
  getRecharges: (params?: object) => request.get('/recharge', { params }),
  reviewRecharge: (id: number, data: object) =>
    request.put(`/recharge/${id}/review`, data),

  rbacListRoles: () => request.get('/admin/rbac/roles'),
  /** 指定岗位下已绑定用户（admin_role_id），与岗位列表 user_count 同源 */
  rbacRoleMembers: (
    roleId: number,
    params?: { page?: number; page_size?: number },
    reqConfig?: { skipErrorToast?: boolean },
  ) =>
    request.get(`/admin/rbac/roles/${roleId}/members`, {
      params,
      ...reqConfig,
    } as Parameters<typeof request.get>[1]),
  rbacPermissionsCatalog: () => request.get('/admin/rbac/permissions'),
  rbacCreateRole: (data: { code: string; name: string; description?: string }) =>
    request.post('/admin/rbac/roles', data),
  rbacUpdateRole: (id: number, data: { name?: string; description?: string }) =>
    request.put(`/admin/rbac/roles/${id}`, data),
  rbacDeleteRole: (id: number) => request.delete(`/admin/rbac/roles/${id}`),
  rbacSetRolePermissions: (id: number, permission_keys: string[]) =>
    request.put(`/admin/rbac/roles/${id}/permissions`, { permission_keys }),
  rbacGetRolePermissions: (id: number) => request.get(`/admin/rbac/roles/${id}/permissions`),
  rbacAuditLogs: (params?: { page?: number; page_size?: number }) =>
    request.get('/admin/rbac/audit-logs', { params }),
  rbacRolesForAssign: () => request.get('/admin/rbac/roles-for-assign'),
}
