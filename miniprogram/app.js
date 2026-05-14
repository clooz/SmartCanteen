const { getToken, getUserInfo, clearAuth, getLegalAgreedVersion, setLegalAgreedVersion } = require('./utils/storage')
const { LEGAL_VERSION, needsConsent } = require('./utils/legal')
const api = require('./utils/api')

App({
  globalData: {
    userInfo: null,
    token: null,
    _legalModalOpen: false,
  },

  onLaunch() {
    const token = getToken()
    const userInfo = getUserInfo()
    if (token && userInfo) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
    }
  },

  onShow() {
    this.checkLegalVersion()
  },

  async checkLegalVersion() {
    if (!getToken() || this.globalData._legalModalOpen) return
    let serverV = LEGAL_VERSION
    try {
      const res = await api.getLegalVersion()
      if (res.data && res.data.version != null) serverV = String(res.data.version)
    } catch {
      return
    }
    const agreed = getLegalAgreedVersion()
    if (!needsConsent(agreed, serverV)) return

    this.globalData._legalModalOpen = true
    wx.showModal({
      title: '协议更新',
      content: '请阅读并同意更新后的《用户协议》与《隐私政策》后继续使用。',
      confirmText: '同意',
      cancelText: '退出登录',
      success: (r) => {
        if (r.confirm) {
          setLegalAgreedVersion(serverV)
        } else {
          this.logout()
        }
      },
      complete: () => {
        this.globalData._legalModalOpen = false
      },
    })
  },

  logout() {
    clearAuth()
    this.globalData.token = null
    this.globalData.userInfo = null
    wx.reLaunch({ url: '/pages/login/login' })
  },
})
