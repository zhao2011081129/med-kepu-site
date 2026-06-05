const app = getApp()
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + path,
      method: options.method || 'GET',
      data: options.data || {},
      header: { 'Content-Type': 'application/json', ...(app.globalData.cookie ? { Cookie: app.globalData.cookie } : {}) },
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
  data: { articles: [], user: null },
  onShow() { this.loadArticles() },
  async loadArticles() {
    try {
      const me = await request('/api/me')
      if (!me.user) return wx.redirectTo({ url: '/pages/login/login' })
      const data = await request('/api/articles')
      this.setData({ user: me.user, articles: data.articles || [] })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  newArticle() { wx.navigateTo({ url: '/pages/editor/editor' }) },
  openArticle(e) { wx.navigateTo({ url: '/pages/editor/editor?id=' + e.currentTarget.dataset.id }) },
  async logout() {
    try { await request('/api/logout', { method: 'POST' }) } catch (_) {}
    app.globalData.cookie = ''
    wx.redirectTo({ url: '/pages/login/login' })
  }
})
