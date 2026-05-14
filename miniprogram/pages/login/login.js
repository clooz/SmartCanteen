const api = require('../../utils/api')
const { setToken, setUserInfo, getLegalAgreedVersion, setLegalAgreedVersion } = require('../../utils/storage')
const { LEGAL_VERSION, needsConsent } = require('../../utils/legal')

Page({
  data: {
    mode: 'password',
    email: '',
    password: '',
    phone: '',
    smsCode: '',
    countdown: 0,
    loading: false,
    agreed: false,
    showLegalRow: true,
    serverLegalVersion: LEGAL_VERSION,
  },

  _timer: null,

  onLoad() {
    this.refreshLegalUi()
    this.fetchLegalVersion()
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  async fetchLegalVersion() {
    try {
      const res = await api.getLegalVersion()
      const v = res.data && res.data.version != null ? String(res.data.version) : LEGAL_VERSION
      this.setData({ serverLegalVersion: v })
    } catch {
      this.setData({ serverLegalVersion: LEGAL_VERSION })
    }
    this.refreshLegalUi()
  },

  refreshLegalUi() {
    const { serverLegalVersion } = this.data
    const agreedVer = getLegalAgreedVersion()
    const show = needsConsent(agreedVer, serverLegalVersion)
    this.setData({
      showLegalRow: show,
      agreed: !show,
    })
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  startCountdown() {
    if (this._timer) clearInterval(this._timer)
    this.setData({ countdown: 60 })
    this._timer = setInterval(() => {
      const n = this.data.countdown - 1
      if (n <= 0) {
        clearInterval(this._timer)
        this._timer = null
        this.setData({ countdown: 0 })
      } else {
        this.setData({ countdown: n })
      }
    }, 1000)
  },

  async sendSms() {
    const { phone, mode, countdown, loading, agreed, showLegalRow, serverLegalVersion } = this.data
    if (loading || countdown > 0) return
    if (showLegalRow && !agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }
    const purpose = mode === 'password' ? 'forgot_sms' : 'login'
    if (mode === 'password') {
      wx.showToast({ title: '请在「手机登录」下获取验证码', icon: 'none' })
      return
    }
    const p = String(phone).replace(/\D/g, '')
    if (!/^1\d{10}$/.test(p)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      await api.sendSmsCode({ phone: p, purpose: 'login' })
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      this.startCountdown()
    } catch {
    } finally {
      this.setData({ loading: false })
    }
  },

  async onSubmit() {
    const {
      mode,
      email,
      password,
      phone,
      smsCode,
      loading,
      agreed,
      showLegalRow,
      serverLegalVersion,
    } = this.data
    if (loading) return
    if (showLegalRow && !agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      if (mode === 'password') {
        const u = String(email).trim()
        if (!u) {
          wx.showToast({ title: '请输入邮箱', icon: 'none' })
          return
        }
        if (!password) {
          wx.showToast({ title: '请输入密码', icon: 'none' })
          return
        }
        const res = await api.login({ username: u, password })
        setToken(res.data.token)
        setUserInfo(res.data.user)
        setLegalAgreedVersion(serverLegalVersion)
        getApp().globalData.token = res.data.token
        getApp().globalData.userInfo = res.data.user
        wx.switchTab({ url: '/pages/index/index' })
      } else {
        const p = String(phone).replace(/\D/g, '')
        if (!/^1\d{10}$/.test(p)) {
          wx.showToast({ title: '请输入正确手机号', icon: 'none' })
          return
        }
        if (!smsCode.trim()) {
          wx.showToast({ title: '请输入验证码', icon: 'none' })
          return
        }
        const res = await api.loginSms({ phone: p, code: smsCode.trim() })
        setToken(res.data.token)
        setUserInfo(res.data.user)
        setLegalAgreedVersion(serverLegalVersion)
        getApp().globalData.token = res.data.token
        getApp().globalData.userInfo = res.data.user
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch {
    } finally {
      this.setData({ loading: false })
    }
  },

  goForgot() {
    wx.navigateTo({ url: '/pages/forgot-password/forgot-password' })
  },
})
