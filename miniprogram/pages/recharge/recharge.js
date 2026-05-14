const api = require('../../utils/api')
const { getToken } = require('../../utils/storage')

Page({
  data: {
    statusBarHeight: 20,
    amount: '',
    proofImage: '',
    remark: '',
    loading: false,
    quickAmounts: ['50', '100', '200', '500'],
  },

  onLoad() {
    if (!getToken()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    const sys = wx.getSystemInfoSync()
    let statusBarHeight = sys.statusBarHeight || 20
    try {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu && menu.top > 0) {
        statusBarHeight = menu.top
      }
    } catch (_) {}
    this.setData({ statusBarHeight })
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  setQuickAmount(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ amount: this.data.amount === val ? '' : val })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ proofImage: res.tempFiles[0].tempFilePath })
      },
    })
  },

  previewImage() {
    wx.previewImage({
      current: this.data.proofImage,
      urls: [this.data.proofImage],
    })
  },

  removeImage() { this.setData({ proofImage: '' }) },

  async onSubmit() {
    const { amount, proofImage, remark, loading } = this.data
    if (loading) return
    if (!proofImage) { wx.showToast({ title: '请上传转账凭证', icon: 'none' }); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' }); return
    }

    this.setData({ loading: true })
    try {
      await api.submitRecharge(proofImage, { amount, remark })
      wx.showToast({ title: '提交成功！等待审核', icon: 'success', duration: 2000 })
      setTimeout(() => {
        this.setData({ amount: '', proofImage: '', remark: '' })
      }, 2000)
    } catch {
      // api.js 已统一处理
    } finally {
      this.setData({ loading: false })
    }
  },
})
