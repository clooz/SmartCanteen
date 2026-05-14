const api = require('../../utils/api')
const { getLegalAgreedVersion, setLegalAgreedVersion } = require('../../utils/storage')
const { LEGAL_VERSION, needsConsent } = require('../../utils/legal')

Page({
  data: {
    mode: 'sms',
    phone: '',
    email: '',
    code: '',
    newPassword: '',
    countdown: 0,
    loading: false,
    agreed: false,
    showLegalRow: true,
    serverLegalVersion: LEGAL_VERSION,
  },
  _timer: null,

  onLoad() {
    this.initLegal()
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  async initLegal() {
    let serverV = LEGAL_VERSION
    try {
      const res = await api.getLegalVersion()
      if (res.data && res.data.version != null) serverV = String(res.data.version)
    } catch {}
    const agreedVer = getLegalAgreedVersion()
    const show = needsConsent(agreedVer, serverV)
    this.setData({
      serverLegalVersion: serverV,
      showLegalRow: show,
      agreed: !show,
    })
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, code: '' })
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
      } else this.setData({ countdown: n })
    }, 1000)
  },

  async sendCode() {
    const { mode, phone, email, countdown, loading, agreed, showLegalRow } = this.data
    if (loading || countdown > 0) return
    if (showLegalRow && !agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      if (mode === 'sms') {
        const p = String(phone).replace(/\D/g, '')
        if (!/^1\d{10}$/.test(p)) {
          wx.showToast({ title: '请输入正确手机号', icon: 'none' })
          return
        }
        await api.forgotSmsSend({ phone: p })
      } else {
        const em = String(email).trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          wx.showToast({ title: '请输入邮箱', icon: 'none' })
          return
        }
        await api.forgotEmailSend({ email: em.toLowerCase() })
      }
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
      phone,
      email,
      code,
      newPassword,
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
    if (!newPassword || newPassword.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    if (!String(code).trim()) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      if (mode === 'sms') {
        const p = String(phone).replace(/\D/g, '')
        await api.forgotSmsReset({
          phone: p,
          code: String(code).trim(),
          new_password: newPassword,
        })
      } else {
        const em = String(email).trim().toLowerCase()
        await api.forgotEmailReset({
          email: em,
          code: String(code).trim(),
          new_password: newPassword,
        })
      }
      setLegalAgreedVersion(serverLegalVersion)
      wx.showToast({ title: '已重置，请登录', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    } catch {
    } finally {
      this.setData({ loading: false })
    }
  },
})
