import axios from 'axios'
import { message } from 'antd'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截：自动带上 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function skipToast(config: unknown): boolean {
  return Boolean(config && typeof config === 'object' && (config as { skipErrorToast?: boolean }).skipErrorToast)
}

// 响应拦截：统一错误提示
request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code !== 0) {
      if (!skipToast(response.config)) {
        message.error(data.message || '请求失败')
      }
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (!skipToast(error.config)) {
      message.error(error.response?.data?.message || '网络错误，请稍后重试')
    }
    return Promise.reject(error)
  }
)

export default request
