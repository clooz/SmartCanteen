const api = require('../../utils/api')
const { setToken, setUserInfo } = require('../../utils/storage')

Page({
  data: {
    mode: 'login',
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    companies: [],
    selectedCompany: null,
    selectedCompanyIndex: -1,
    showPicker: false,
    loading: false,
  },

  onLoad() {
    this.loadCompanies()
  },

  async loadCompanies() {
    try {
      const res = await api.getCompanies()
      this.setData({ companies: res.data || [] })
    } catch {}
  },

  switchMode(e) {
    this.setData({
      mode: e.currentTarget.dataset.mode,
      password: '',
      confirmPassword: '',
    })
  },

  switchToLogin() {
    this.setData({ mode: 'login' })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  showCompanyPicker() {
    this.setData({ showPicker: true })
  },

  hidePicker() {
    this.setData({ showPicker: false })
  },

  selectCompanyItem(e) {
    this.setData({ selectedCompanyIndex: e.currentTarget.dataset.index })
  },

  confirmCompany() {
    const { selectedCompanyIndex, companies } = this.data
    if (selectedCompanyIndex < 0) {
      wx.showToast({ title: '请选择公司', icon: 'none' })
      return
    }
    this.setData({
      selectedCompany: companies[selectedCompanyIndex],
      showPicker: false,
    })
  },

  async onSubmit() {
    const { mode, username, password, confirmPassword, nickname, selectedCompany, loading } = this.data
    if (loading) return

    if (!username.trim()) { wx.showToast({ title: '请输入用户名', icon: 'none' }); return }
    if (!password) { wx.showToast({ title: '请输入密码', icon: 'none' }); return }

    if (mode === 'register') {
      if (!selectedCompany) { wx.showToast({ title: '请选择所在公司', icon: 'none' }); return }
      if (password !== confirmPassword) { wx.showToast({ title: '两次密码不一致', icon: 'none' }); return }
      if (password.length < 6) { wx.showToast({ title: '密码至少6位', icon: 'none' }); return }
    }

    this.setData({ loading: true })
    try {
      if (mode === 'login') {
        const res = await api.login({ username: username.trim(), password })
        setToken(res.data.token)
        setUserInfo(res.data.user)
        getApp().globalData.token = res.data.token
        getApp().globalData.userInfo = res.data.user
        wx.switchTab({ url: '/pages/index/index' })
      } else {
        await api.register({
          username: username.trim(),
          password,
          nickname: nickname.trim() || username.trim(),
          company_id: selectedCompany.id,
        })
        wx.showToast({ title: '注册成功，请登录', icon: 'success' })
        setTimeout(() => this.setData({ mode: 'login', password: '', confirmPassword: '' }), 1500)
      }
    } catch {
      // api.js 已统一 showToast
    } finally {
      this.setData({ loading: false })
    }
  },
})
