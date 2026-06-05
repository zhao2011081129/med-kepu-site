const app = getApp()
const defaultForm = {
  title: '',
  disease: '',
  platform: '医院公众号 / 小红书',
  word_count: 500,
  audience: '关注自身健康、无医学知识的普通群众',
  section1: '', section2: '', section3: '', section4: '',
  summary: '', image_notes: '', status: 'draft'
}
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
  data: { id: '', form: { ...defaultForm }, prompt: '' },
  async onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id })
      await this.loadArticle(query.id)
    }
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['form.' + field]: e.detail.value })
  },
  async loadArticle(id) {
    try {
      const data = await request('/api/articles')
      const article = (data.articles || []).find(x => String(x.id) === String(id))
      if (!article) return wx.showToast({ title: '未找到文章', icon: 'none' })
      this.setData({ form: { ...defaultForm, ...article } })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  async saveArticle() {
    const form = { ...this.data.form, word_count: Number(this.data.form.word_count) || 500, status: 'draft' }
    if (!form.title || !form.disease) return wx.showToast({ title: '请填写标题和疾病/主题', icon: 'none' })
    try {
      if (this.data.id) await request('/api/articles/' + this.data.id, { method: 'PUT', data: form })
      else {
        const r = await request('/api/articles', { method: 'POST', data: form })
        this.setData({ id: String(r.id) })
      }
      wx.showToast({ title: '已保存' })
      return this.data.id
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  async copyPrompt() {
    try {
      let id = this.data.id
      if (!id) id = await this.saveArticle()
      if (!id) return
      const { prompt } = await request('/api/prompt/' + id)
      this.setData({ prompt })
      wx.setClipboardData({ data: prompt, success: () => wx.showToast({ title: '提示词已复制' }) })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },
  deleteArticle() {
    if (!this.data.id) return
    wx.showModal({
      title: '确认删除',
      content: '确认删除这篇文章？',
      success: async res => {
        if (!res.confirm) return
        try {
          await request('/api/articles/' + this.data.id, { method: 'DELETE' })
          wx.navigateBack()
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
      }
    })
  }
})
