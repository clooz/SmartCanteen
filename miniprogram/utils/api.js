const { getToken, clearAuth } = require('./storage')

// 与 BASE_URL 同源；填本机 ipconfig 的 IPv4（换 WiFi 后常会变）；真机勿用 localhost
const BASE_URL = 'http://172.16.0.26:3000/api'
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

function upload(path, filePath, formData = {}) {
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
      // 须与 server/src/routes/recharge.js 中 upload.single('proof_image') 一致
      name: 'proof_image',
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
  upload: (path, file, form) => upload(path, file, form),

  // ── Auth ──
  getCompanies:   ()     => api.get('/auth/companies'),
  login:          (data) => api.post('/auth/login', data),
  register:       (data) => api.post('/auth/register', data),
  getProfile:     ()     => api.get('/auth/profile'),
  updateProfile:  (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),

  // ── Menu ──
  getTodayMenu: () => api.get('/menus/today'),

  // ── Wish ──
  getWishActivities:    ()         => api.get('/wish/activities'),
  getWishItems:         (actId)    => api.get(`/wish/activities/${actId}/items`),
  createWishItem:       (actId, d) => api.post(`/wish/activities/${actId}/items`, d),
  voteWishItem:         (itemId)   => api.post(`/wish/items/${itemId}/vote`),
  unvoteWishItem:       (itemId)   => api.delete(`/wish/items/${itemId}/vote`),
  getComments:          (itemId)   => api.get(`/wish/items/${itemId}/comments`),
  createComment:        (itemId, d) => api.post(`/wish/items/${itemId}/comments`, d),
  deleteComment:        (itemId, commentId) => api.delete(`/wish/items/${itemId}/comments/${commentId}`),

  // ── Recharge ──
  submitRecharge:    (filePath, form) => api.upload('/recharge', filePath, form),
  getMyRecharges:    (params)         => api.get('/recharge/my', params),

  ASSET_ORIGIN,
  resolveAssetUrl,
}

module.exports = api
