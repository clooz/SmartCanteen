// 简单的全局用户状态（无需 Redux，用 localStorage + 自定义 hook）
export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
  role: 'employee' | 'chef' | 'admin'
  company_id: number | null
  company_name: string | null
}

export const authStore = {
  getToken: () => localStorage.getItem('token') || '',
  getUser: (): UserInfo | null => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  },
  setAuth: (token: string, user: UserInfo) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
  isLoggedIn: () => !!localStorage.getItem('token'),
}
