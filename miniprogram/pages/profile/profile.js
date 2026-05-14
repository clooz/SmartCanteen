const api = require('../../utils/api')
const { syncTabBarSelected } = require('../../utils/tab-bar')
const { getToken, getUserInfo, setUserInfo } = require('../../utils/storage')

const BIND_TIP_KEY = 'sc_bind_phone_tip_shown'

Page({
  data: {
    userInfo: {},
    avatarText: '?',
    avatarUrl: '',
    showNicknameSheet: false,
    newNickname: '',
    showPasswordSheet: false,
    oldPwd: '',
    newPwd: '',
    confirmPwd: '',
    showBindSheet: false,
    bindPhone: '',
    bindCode: '',
    bindCountdown: 0,
  },

  _bindTimer: null,

  onLoad() {
    if (!getToken()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    this.loadProfile()
  },

  onUnload() {
    if (this._bindTimer) clearInterval(this._bindTimer)
  },

  onShow() {
    syncTabBarSelected()
    this.loadProfile()
  },

  maybeBindTip(userInfo) {
    if (userInfo.has_phone) return
    if (wx.getStorageSync(BIND_TIP_KEY)) return
    wx.setStorageSync(BIND_TIP_KEY, 1)
    wx.showModal({
      title: '绑定手机号',
      content: '绑定后可使用手机号验证码登录，是否前往「我的」页面绑定？',
      confirmText: '去绑定',
      cancelText: '稍后',
      success: ({ confirm }) => {
        if (confirm) this.goBindPhone()
      },
    })
  },

  async loadProfile() {
    try {
      const res = await api.getProfile()
      const userInfo = res.data
      setUserInfo(userInfo)
      getApp().globalData.userInfo = userInfo
      const name = userInfo.nickname || userInfo.username || '?'
      const avatarUrl = userInfo.avatar ? api.resolveAssetUrl(userInfo.avatar) : ''
      this.setData({
        userInfo,
        avatarText: name.slice(-2),
        avatarUrl,
      })
      this.maybeBindTip(userInfo)
    } catch {}
  },

  async onChooseAvatar() {
    try {
      let tempPath = ''
      try {
        const r = await wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
        })
        tempPath = r.tempFiles[0].tempFilePath
      } catch {
        const r2 = await wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
        })
        tempPath = r2.tempFilePaths[0]
      }
      wx.showLoading({ title: '上传中', mask: true })
      await api.uploadAvatar(tempPath)
      wx.hideLoading()
      wx.showToast({ title: '头像已更新', icon: 'success' })
      this.loadProfile()
    } catch {
      wx.hideLoading()
    }
  },

  onEditProfileTap() {
    wx.showActionSheet({
      itemList: ['修改昵称', '更换头像'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) this.goEditNickname()
        else if (tapIndex === 1) this.onChooseAvatar()
      },
    })
  },

  goRechargeRecords() {
    wx.navigateTo({ url: '/pages/recharge-records/recharge-records' })
  },

  goMyOrders() {
    wx.navigateTo({ url: '/pages/my-orders/my-orders' })
  },

  goBindPhone() {
    this.setData({
      showBindSheet: true,
      bindPhone: '',
      bindCode: '',
      bindCountdown: 0,
    })
  },

  hideBindSheet() {
    this.setData({ showBindSheet: false })
    if (this._bindTimer) {
      clearInterval(this._bindTimer)
      this._bindTimer = null
    }
  },

  onBindPhoneInput(e) {
    this.setData({ bindPhone: e.detail.value })
  },

  onBindCodeInput(e) {
    this.setData({ bindCode: e.detail.value })
  },

  startBindCountdown() {
    if (this._bindTimer) clearInterval(this._bindTimer)
    this.setData({ bindCountdown: 60 })
    this._bindTimer = setInterval(() => {
      const n = this.data.bindCountdown - 1
      if (n <= 0) {
        clearInterval(this._bindTimer)
        this._bindTimer = null
        this.setData({ bindCountdown: 0 })
      } else {
        this.setData({ bindCountdown: n })
      }
    }, 1000)
  },

  async sendBindSms() {
    const { bindPhone, bindCountdown } = this.data
    if (bindCountdown > 0) return
    const p = String(bindPhone).replace(/\D/g, '')
    if (!/^1\d{10}$/.test(p)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    try {
      await api.sendBindPhoneCode({ phone: p })
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      this.startBindCountdown()
    } catch {}
  },

  async saveBindPhone() {
    const { bindPhone, bindCode } = this.data
    const p = String(bindPhone).replace(/\D/g, '')
    if (!/^1\d{10}$/.test(p)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!String(bindCode).trim()) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    try {
      await api.bindPhone({ phone: p, code: String(bindCode).trim() })
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.hideBindSheet()
      this.loadProfile()
    } catch {}
  },

  goEditNickname() {
    this.setData({ showNicknameSheet: true, newNickname: this.data.userInfo.nickname || '' })
  },

  hideNicknameSheet() { this.setData({ showNicknameSheet: false }) },

  onNicknameInput(e) { this.setData({ newNickname: e.detail.value }) },

  async saveNickname() {
    const { newNickname } = this.data
    if (!newNickname.trim()) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return }
    try {
      await api.updateProfile({ nickname: newNickname.trim() })
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.setData({ showNicknameSheet: false })
      this.loadProfile()
    } catch {}
  },

  goChangePassword() {
    this.setData({ showPasswordSheet: true, oldPwd: '', newPwd: '', confirmPwd: '' })
  },

  hidePasswordSheet() { this.setData({ showPasswordSheet: false }) },

  onPwdInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  async savePassword() {
    const { oldPwd, newPwd, confirmPwd } = this.data
    if (!oldPwd) { wx.showToast({ title: '请输入当前密码', icon: 'none' }); return }
    if (!newPwd || newPwd.length < 6) { wx.showToast({ title: '新密码至少6位', icon: 'none' }); return }
    if (newPwd !== confirmPwd) { wx.showToast({ title: '两次密码不一致', icon: 'none' }); return }
    try {
      await api.changePassword({ old_password: oldPwd, new_password: newPwd })
      wx.showToast({ title: '密码修改成功', icon: 'success' })
      this.setData({ showPasswordSheet: false })
    } catch {}
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号？',
      confirmText: '退出',
      confirmColor: '#DC2626',
      success: ({ confirm }) => { if (confirm) getApp().logout() },
    })
  },
})
