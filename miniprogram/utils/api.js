const { getToken, clearAuth } = require('./storage')
const { API_BASE } = require('../config/env.js')

const BASE_URL = String(API_BASE || '').replace(/\/+$/, '')
const ASSET_ORIGIN = BASE_URL.replace(/\/?api\/?$/i, '').replace(/\/+$/, '') || 'http://127.0.0.1:3000'

/** 把后端返回的相对路径或 localhost 绝对路径转成真机可访问的完整 URL（供 <image> / 预览图） */
function resolveAssetUrl(path) {
  if (!path) return ''
  const p = String(path).trim()
  if (/^https?:\/\//i.test(p)) {
    return p
      .replace(/^http:\/\/localhost(?::\d+)?/i, ASSET_ORIGIN)
      .replace(/^http:\/\/127\.0\.0\.1(?::\d+)?/i, ASSET_ORIGIN)
  }
  const rel = p.startsWith('/') ? p : `/${p}`
  return `${ASSET_ORIGIN}${rel}`
}

function request(method, path, data = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = { 'Content-Type': 'application/json' }
    if (token) header['Authorization'] = `Bearer ${token}`

    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode === 401) {
          clearAuth()
          wx.reLaunch({ url: '/pages/login/login' })
          reject(new Error('未登录或登录已过期'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (res.data && res.data.success === false) {
            wx.showToast({ title: res.data.message || '操作失败', icon: 'none', duration: 2000 })
            reject(new Error(res.data.message))
          } else {
            resolve(res.data)
          }
        } else {
          const msg = res.data?.message || `请求失败(${res.statusCode})`
          wx.showToast({ title: msg, icon: 'none', duration: 2000 })
          reject(new Error(msg))
        }
      },
      fail(err) {
        wx.showToast({ title: '网络连接失败，请检查网络', icon: 'none', duration: 2500 })
        reject(err)
      },
    })
  })
}

function upload(path, filePath, formData = {}, fileField = 'proof_image') {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = {}
    if (token) header['Authorization'] = `Bearer ${token}`

    // wx.uploadFile 的 formData 键值需为 string（与后端 multer 字段名一致）
    const stringForm = {}
    Object.keys(formData || {}).forEach((k) => {
      const v = formData[k]
      if (v !== undefined && v !== null) stringForm[k] = String(v)
    })

    wx.uploadFile({
      url: `${BASE_URL}${path}`,
      filePath,
      name: fileField,
      formData: stringForm,
      header,
      success(res) {
        const statusCode = res.statusCode || 0
        let data
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch {
          wx.showToast({ title: '上传响应解析失败', icon: 'none' })
          reject(new Error('上传响应解析失败'))
          return
        }
        if (statusCode === 401) {
          clearAuth()
          wx.reLaunch({ url: '/pages/login/login' })
          reject(new Error('未登录或登录已过期'))
          return
        }
        if (statusCode < 200 || statusCode >= 300) {
          const msg = data?.message || `请求失败(${statusCode})`
          wx.showToast({ title: msg, icon: 'none', duration: 2000 })
          reject(new Error(msg))
          return
        }
        // 后端统一 { code: 0 成功, code: 1 失败 }
        if (data.code !== 0) {
          wx.showToast({ title: data.message || '上传失败', icon: 'none', duration: 2000 })
          reject(new Error(data.message || '上传失败'))
          return
        }
        resolve(data)
      },
      fail(err) {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
        reject(err)
      },
    })
  })
}

const api = {
  get:    (path, data)       => request('GET',    path, data),
  post:   (path, data)       => request('POST',   path, data),
  put:    (path, data)       => request('PUT',    path, data),
  delete: (path, data)       => request('DELETE', path, data),
  upload: (path, file, form, fileField) => upload(path, file, form || {}, fileField),

  // ── Auth ──
  getCompanies:   ()     => api.get('/auth/companies'),
  login:          (data) => api.post('/auth/login', data),
  register:       (data) => api.post('/auth/register', data),
  getProfile:     ()     => api.get('/auth/profile'),
  updateProfile:  (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),

  // ── Menu ──
  getTodayMenu: (data) => api.get('/menus/today', data),

  // ── Orders（员工）──
  createOrder: (data) => api.post('/orders', data),
  getMyOrders: (params) => api.get('/orders/my', params),
  getOrderById: (id) => api.get(`/orders/${id}`),
  cancelOrder: (id) => api.put(`/orders/${id}/status`, { status: 'cancelled' }),

  // ── Wish ──
  getWishActivities:    (params)   => api.get('/wish/activities', params || {}),
  getWishItems:         (actId)    => api.get(`/wish/activities/${actId}/items`),
  createWishItem:       (actId, d) => api.post(`/wish/activities/${actId}/items`, d),
  voteWishItem:         (itemId)   => api.post(`/wish/items/${itemId}/vote`),
  unvoteWishItem:       (itemId)   => api.delete(`/wish/items/${itemId}/vote`),
  getComments:          (itemId)   => api.get(`/wish/items/${itemId}/comments`),
  createComment:        (itemId, d) => api.post(`/wish/items/${itemId}/comments`, d),
  deleteComment:        (itemId, commentId) => api.delete(`/wish/items/${itemId}/comments/${commentId}`),

  // ── Recharge ──
  submitRecharge:    (filePath, form) => api.upload('/recharge', filePath, form),
  uploadAvatar:      (filePath)       => api.upload('/auth/profile/avatar', filePath, {}, 'avatar'),
  getMyRecharges:    (params)         => api.get('/recharge/my', params),

  ASSET_ORIGIN,
  resolveAssetUrl,
}

module.exports = api
