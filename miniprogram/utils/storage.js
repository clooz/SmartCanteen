const TOKEN_KEY = 'sc_token'
const USER_KEY = 'sc_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || null
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function getUserInfo() {
  return wx.getStorageSync(USER_KEY) || null
}

function setUserInfo(userInfo) {
  wx.setStorageSync(USER_KEY, userInfo)
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

module.exports = { getToken, setToken, getUserInfo, setUserInfo, clearAuth }
