const api = require('../../utils/api')
const { getToken, getUserInfo, setUserInfo } = require('../../utils/storage')

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
  },

  onLoad() {
    if (!getToken()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    this.loadProfile()
  },

  onShow() { this.loadProfile() },

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
    } catch {}
  },

  /** 头像区域：直接选图上传 */
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

  /** 右侧入口：与头像点击互补，选昵称或头像 */
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
