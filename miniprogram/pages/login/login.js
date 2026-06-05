const app = getApp()

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + path,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(app.globalData.cookie ? { Cookie: app.globalData.cookie } : {})
      },
      success(res) {
        const cookie = res.header['Set-Cookie'] || res.header['set-cookie']
        if (cookie) app.globalData.cookie = Array.isArray(cookie) ? cookie.join(';') : cookie
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data || {})
        else reject(new Error((res.data && res.data.error) || '操作失败'))
      },
      fail: reject
    })
  })
}

Page({
  data: { username: '', password: '' },
  onLoad() { this.checkMe() },
  onUsername(e) { this.setData({ username: e.detail.value }) },
  onPassword(e) { this.setData({ password: e.detail.value }) },
  async checkMe() {
    try {
      const { user } = await request('/api/me')
      if (user) {
        app.globalData.user = user
        wx.redirectTo({ url: '/pages/articles/articles' })
      }
    } catch (_) {}
  },
  async register() {
    try {
      await request('/api/register', { method: 'POST', data: { username: this.data.username.trim(), password: this.data.password } })
      wx.showToast({ title: '注册成功' })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  async login() {
    try {
      await request('/api/login', { method: 'POST', data: { username: this.data.username.trim(), password: this.data.password } })
      wx.redirectTo({ url: '/pages/articles/articles' })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  }
})
