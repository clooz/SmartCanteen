// 简单的全局用户状态（无需 Redux，用 localStorage + 自定义 hook）
export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
  role: 'employee' | 'chef' | 'admin'
  company_id: number | null
  company_name: string | null
  admin_role_id?: number | null
  admin_role_code?: string | null
  /** 管理端权限点（仅 chef/admin 登录时有值） */
  permissions?: string[]
  is_super_admin?: boolean
}

export function userHasPermission(user: UserInfo | null, key: string): boolean {
  if (!user?.permissions?.length) return false
  return user.permissions.includes(key)
}

export function userHasAnyPermission(user: UserInfo | null, keys: string[]): boolean {
  if (!user?.permissions?.length) return false
  return keys.some((k) => user.permissions!.includes(k))
}

export const authStore = {
  getToken: () => localStorage.getItem('token') || '',
  getUser: (): UserInfo | null => {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try {
      const u = JSON.parse(raw) as UserInfo
      if (!u || typeof u !== 'object') return null
      return u
    } catch {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      return null
    }
  },
  setAuth: (token: string, user: UserInfo) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
  /** 同时存在 token 与 user 才视为已登录，避免仅有残留 token 时逻辑抖动 */
  isLoggedIn: () =>
    !!localStorage.getItem('token') && !!localStorage.getItem('user'),
}
