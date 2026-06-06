let articles = [];
const $ = id => document.getElementById(id);

const examples = {
  blood: {
    title: '血常规报告里的箭头，到底代表什么？',
    disease: '血常规',
    platform: '医院公众号 + 小红书',
    word_count: 1800,
    audience: '关注医院公众号的患者、体检人群、普通健康关注者；看到报告上有↑↓箭头时容易紧张。',
    section1: '血常规是常见基础检验项目，可帮助医生了解红细胞、白细胞、血小板等情况，常用于感染、贫血、出血风险等初步判断。',
    section2: '多数血常规不强制空腹，但如果同时检查肝功能、血脂、血糖等项目，通常需要按医嘱空腹。采血后按压针眼 3-5 分钟，不揉搓。',
    section3: '白细胞、红细胞、血红蛋白、血小板等指标可能出现↑↓，异常不等于确诊，需要结合症状、病史和其他检查。',
    section4: '不要看到箭头就恐慌；不要自行用药；不要把一次异常直接等同于严重疾病；不要脱离医生判断解读报告。',
    summary: '如果报告异常并伴有发热、乏力、出血、胸闷等症状，建议及时咨询医生；体检异常可按医生建议复查。',
    image_notes: '配图：血常规报告局部示意、箭头含义卡片、采血后按压动作示意。'
  },
  tumor: {
    title: '肿瘤标志物升高，就是得癌了吗？',
    disease: '肿瘤标志物',
    platform: '医院公众号 + 小红书',
    word_count: 2000,
    audience: '体检人群、肿瘤筛查关注者、看到肿瘤标志物升高后焦虑的普通人。',
    section1: '肿瘤标志物是辅助判断指标之一，可用于部分疾病风险提示、治疗随访或复查参考，但不能单独作为癌症诊断依据。',
    section2: '通常按具体项目要求准备，部分抽血项目可能需要空腹；复查时尽量在同一家医院或同一检测体系下对比趋势。',
    section3: '轻度升高可能与炎症、良性疾病、生理因素、检测波动等有关，也可能需要进一步检查，重点看医生结合影像、症状和病史综合判断。',
    section4: '不能写“升高就是癌”；不能宣传“一次检查发现所有癌症”；不能诱导所有人盲目检查；避免制造恐慌。',
    summary: '发现肿瘤标志物异常不要自行下结论，建议携带完整报告到相关专科咨询，必要时按医生建议复查或进一步检查。',
    image_notes: '配图：肿瘤标志物不是诊断书、异常原因示意、复查流程图。'
  },
  fasting: {
    title: '抽血前到底能不能喝水？一篇讲清空腹检查',
    disease: '抽血空腹注意事项',
    platform: '医院公众号 + 小红书',
    word_count: 1600,
    audience: '准备体检、复查、抽血化验的患者和普通人。',
    section1: '空腹要求主要是为了减少饮食对血糖、血脂、肝功能等部分检验结果的影响，不是所有抽血项目都必须空腹。',
    section2: '一般建议按医嘱空腹 8-12 小时；少量白水通常可以，但不要喝奶茶、咖啡、饮料、酒；特殊用药是否停用需问医生。',
    section3: '进食可能影响血糖、甘油三酯等结果；空腹时间过长也可能影响部分指标，不能认为饿得越久越准确。',
    section4: '不要擅自停药；不要过度禁水；不要把所有检查都理解为必须空腹；孕妇、儿童、慢病患者应听医生安排。',
    summary: '不确定是否需要空腹时，可提前咨询开单医生或检验科窗口；按检查单和医院提示准备更稳妥。',
    image_notes: '配图：空腹检查清单、能不能喝水对照卡、抽血前一晚注意事项。'
  }
};

async function request(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '操作失败');
  return data;
}

async function checkMe() {
  const { user } = await request('/api/me');
  if (user) {
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('userBox').innerHTML = `<span>已登录：${escapeHtml(user.username)}</span><button class="secondary" onclick="logout()">退出</button>`;
    loadArticles();
  } else {
    $('auth').classList.remove('hidden');
    $('app').classList.add('hidden');
    $('userBox').innerHTML = '';
  }
}

async function register() {
  try {
    await request('/api/register', { method: 'POST', body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value }) });
    toast('注册成功，请登录');
  } catch (e) { toast(e.message, true); }
}

async function login() {
  try {
    await request('/api/login', { method: 'POST', body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value }) });
    checkMe();
  } catch (e) { toast(e.message, true); }
}

async function logout() {
  await request('/api/logout', { method: 'POST' });
  checkMe();
}

function formData() {
  return {
    title: $('title').value.trim(),
    disease: $('disease').value.trim(),
    platform: $('platform').value.trim(),
    word_count: $('word_count').value,
    audience: $('audience').value.trim(),
    section1: $('section1').value,
    section2: $('section2').value,
    section3: $('section3').value,
    section4: $('section4').value,
    summary: $('summary').value,
    image_notes: $('image_notes').value,
    status: 'draft'
  };
}

function fill(a = {}) {
  for (const id of ['articleId', 'title', 'disease', 'platform', 'word_count', 'audience', 'section1', 'section2', 'section3', 'section4', 'summary', 'image_notes']) {
    $(id).value = a[id] || '';
  }
  if (!a.id) {
    $('articleId').value = '';
    $('platform').value = '医院公众号 + 小红书';
    $('word_count').value = 1800;
    $('audience').value = '关注医院公众号的患者、体检人群、普通健康关注者';
  } else {
    $('articleId').value = a.id;
  }
  $('promptBox').classList.add('hidden');
}

function newArticle() {
  fill({});
  $('title').focus();
}

function applyExample(key) {
  fill(examples[key] || {});
  toast('已填入示例，可继续修改');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function loadArticles() {
  const data = await request('/api/articles');
  articles = data.articles;
  $('articleList').innerHTML = articles.map(a => `<div class="item" onclick="openArticle(${a.id})"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.disease)} · ${escapeHtml(a.updated_at)}</span></div>`).join('') || '<p class="hint">暂无草稿，点“新建”开始。</p>';
  if (!articles.length) newArticle();
}

function openArticle(id) {
  const a = articles.find(x => x.id === id);
  if (a) fill(a);
}

async function saveArticle() {
  try {
    const id = $('articleId').value;
    const data = formData();
    if (!data.title || !data.disease) return toast('请填写内容标题和检验项目 / 科普主题', true);
    if (id) await request('/api/articles/' + id, { method: 'PUT', body: JSON.stringify(data) });
    else {
      const r = await request('/api/articles', { method: 'POST', body: JSON.stringify(data) });
      $('articleId').value = r.id;
    }
    await loadArticles();
    toast('已保存草稿');
  } catch (e) { toast(e.message, true); }
}

async function deleteArticle() {
  const id = $('articleId').value;
  if (!id) return toast('还没有选择草稿', true);
  if (!confirm('确认删除这份草稿？')) return;
  await request('/api/articles/' + id, { method: 'DELETE' });
  await loadArticles();
  newArticle();
  toast('已删除');
}

async function copyPrompt() {
  try {
    let id = $('articleId').value;
    if (!id) {
      await saveArticle();
      id = $('articleId').value;
    }
    const { prompt } = await request('/api/prompt/' + id);
    $('promptBox').textContent = prompt;
    $('promptBox').classList.remove('hidden');
    await navigator.clipboard.writeText(prompt);
    toast('双平台提示词已复制，可以粘贴给 AI 生成内容');
  } catch (e) { toast(e.message, true); }
}

async function downloadPrompt() {
  try {
    let id = $('articleId').value;
    if (!id) {
      await saveArticle();
      id = $('articleId').value;
    }
    const { prompt } = await request('/api/prompt/' + id);
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${($('title').value || '检验科普双平台提示词').replace(/[\\/:*?"<>|]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { toast(e.message, true); }
}

function toast(message, isError = false) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

checkMe();
