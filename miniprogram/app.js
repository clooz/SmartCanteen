const { getToken, getUserInfo, clearAuth } = require('./utils/storage')

App({
  globalData: {
    userInfo: null,
    token: null,
  },

  onLaunch() {
    const token = getToken()
    const userInfo = getUserInfo()
    if (token && userInfo) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
    }
  },

  // 全局登出
  logout() {
    clearAuth()
    this.globalData.token = null
    this.globalData.userInfo = null
    wx.reLaunch({ url: '/pages/login/login' })
  },
})
