const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'site.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  disease TEXT NOT NULL,
  audience TEXT,
  platform TEXT,
  section1 TEXT,
  section2 TEXT,
  section3 TEXT,
  section4 TEXT,
  summary TEXT,
  image_notes TEXT,
  word_count INTEGER DEFAULT 500,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const defaultTemplate = `你现在是一名资深医院检验科健康科普编辑，同时熟悉医院公众号和小红书平台内容表达。

目标：围绕「{disease}」生成一套适合医院检验科使用的双平台健康科普内容。
发布平台：{platform}
面向人群：{audience}
目标字数：公众号正文约 {word_count} 字，小红书笔记控制在 600-900 字。

已知输入：
1. 内容标题 / 内部主题：{title}
2. 检验项目 / 科普主题：{disease}
3. 项目用途 / 为什么要查：
{section1}
4. 检查前注意事项：
{section2}
5. 报告指标 / 常见异常：
{section3}
6. 常见误区 / 风险边界：
{section4}
7. 结尾提醒 / 行动建议：
{summary}
8. 配图建议 / 科室补充要点：
{image_notes}

请严格输出以下内容：

一、公众号科普长文
- 给出 3 个克制、专业、不恐吓的标题备选。
- 正文结构建议：
  1. 开头：用患者常见问题引入，降低焦虑。
  2. 这个检验项目主要看什么。
  3. 哪些场景下医生可能会开这个检查。
  4. 检查前需要注意什么。
  5. 报告中常见指标或异常应该如何理性理解。
  6. 常见误区澄清。
  7. 什么情况下建议咨询医生或复查。
  8. 结尾免责声明。
- 语言要求：患者能看懂，避免专业术语堆砌；必要术语要解释。

二、小红书健康科普笔记
- 给出 5 个小红书标题备选，要求生活化但不标题党。
- 输出笔记正文，结构包括：开头钩子、3-5 个知识点、误区提醒、结尾行动建议。
- 给出 6-10 个标签建议。
- 适合做成图文卡片的分镜建议。

三、合规与安全风险检查
请用表格列出：
- 可能涉及的风险表达
- 为什么有风险
- 建议替代表达
重点检查：直接诊断、夸大检测作用、诱导过度检查、恐吓标题、具体治疗/用药建议、个人报告解读、患者隐私、平台审核敏感词。

四、发布前审核清单
列出医院公众号编辑或检验科审核时需要确认的事项。

必须遵守：
1. 不提供个人检验报告诊断。
2. 不把指标异常直接等同于疾病确诊。
3. 不提供治疗方案或用药建议。
4. 不夸大检验项目作用，不使用“精准诊断、一次查清、早筛所有疾病、必须做、不做就晚了”等表达。
5. 不制造焦虑，不诱导过度检查。
6. 所有内容都要提醒：检验结果需结合症状、病史、体征和医生判断，发布前建议由检验科专业人员或医院审核。
7. 不承诺公众号或小红书过审、涨粉、阅读量或咨询转化。`;

db.prepare('INSERT OR IGNORE INTO templates(name, content) VALUES (?, ?)').run('检验科双平台科普模板', defaultTemplate);

const sessions = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8' };

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => {
    const i = x.indexOf('='); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1))];
  }));
}
function currentUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid || !sessions.has(sid)) return null;
  return sessions.get(sid);
}
function send(res, code, data, type='application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(type.includes('json') ? JSON.stringify(data) : data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); } });
  });
}
function requireLogin(req, res) {
  const user = currentUser(req);
  if (!user) send(res, 401, { error: '请先登录' });
  return user;
}
function generatePrompt(article) {
  const row = db.prepare('SELECT content FROM templates WHERE name=?').get('检验科双平台科普模板');
  const tpl = row ? row.content : defaultTemplate;
  const value = key => String(article[key] || '');
  return tpl.replaceAll('{title}', value('title'))
    .replaceAll('{disease}', value('disease'))
    .replaceAll('{platform}', article.platform || '医院公众号 + 小红书')
    .replaceAll('{audience}', article.audience || '关注医院公众号的患者、体检人群、普通健康关注者')
    .replaceAll('{section1}', value('section1') || '暂无，请基于该检验项目的常见用途进行谨慎科普')
    .replaceAll('{section2}', value('section2') || '暂无，请提示用户以医院检查单、开单医生或检验科窗口要求为准')
    .replaceAll('{section3}', value('section3') || '暂无，请只做通俗解释，不做个人报告诊断')
    .replaceAll('{section4}', value('section4') || '暂无，请主动补充常见误区和风险边界')
    .replaceAll('{summary}', value('summary') || '报告异常需结合症状、病史和医生判断，必要时咨询医生或复查')
    .replaceAll('{image_notes}', value('image_notes') || '请给出适合公众号和小红书卡片的配图建议')
    .replaceAll('{word_count}', String(article.word_count || 1800));
}

async function api(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/register') {
    const { username, password } = await readBody(req);
    if (!username || !password || password.length < 6) return send(res, 400, { error: '用户名和至少6位密码必填' });
    try {
      db.prepare('INSERT INTO users(username, password_hash) VALUES (?, ?)').run(username, hashPassword(password));
      return send(res, 200, { ok: true });
    } catch { return send(res, 409, { error: '用户名已存在' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const { username, password } = await readBody(req);
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(username || '');
    if (!user || !verifyPassword(password || '', user.password_hash)) return send(res, 401, { error: '用户名或密码错误' });
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { id: user.id, username: user.username });
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Set-Cookie':`sid=${sid}; HttpOnly; SameSite=Lax; Path=/` });
    return res.end(JSON.stringify({ ok: true, user: { id: user.id, username: user.username } }));
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const sid = parseCookies(req).sid; if (sid) sessions.delete(sid);
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Set-Cookie':'sid=; Max-Age=0; Path=/' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === 'GET' && url.pathname === '/api/me') return send(res, 200, { user: currentUser(req) });
  if (req.method === 'GET' && url.pathname === '/api/articles') {
    const user = requireLogin(req, res); if (!user) return;
    const rows = db.prepare('SELECT * FROM articles WHERE user_id=? ORDER BY updated_at DESC').all(user.id);
    return send(res, 200, { articles: rows });
  }
  if (req.method === 'POST' && url.pathname === '/api/articles') {
    const user = requireLogin(req, res); if (!user) return;
    const a = await readBody(req);
    if (!a.title || !a.disease) return send(res, 400, { error: '标题和检验项目 / 科普主题必填' });
    const clean = v => v == null ? '' : String(v);
    const r = db.prepare(`INSERT INTO articles(user_id,title,disease,audience,platform,section1,section2,section3,section4,summary,image_notes,word_count,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id, clean(a.title), clean(a.disease), clean(a.audience), clean(a.platform), clean(a.section1), clean(a.section2), clean(a.section3), clean(a.section4), clean(a.summary), clean(a.image_notes), Number(a.word_count)||500, clean(a.status || 'draft'));
    return send(res, 200, { ok: true, id: r.lastInsertRowid });
  }
  if (req.method === 'PUT' && url.pathname.startsWith('/api/articles/')) {
    const user = requireLogin(req, res); if (!user) return;
    const id = Number(url.pathname.split('/').pop());
    const a = await readBody(req);
    const clean = v => v == null ? '' : String(v);
    db.prepare(`UPDATE articles SET title=?, disease=?, audience=?, platform=?, section1=?, section2=?, section3=?, section4=?, summary=?, image_notes=?, word_count=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`)
      .run(clean(a.title), clean(a.disease), clean(a.audience), clean(a.platform), clean(a.section1), clean(a.section2), clean(a.section3), clean(a.section4), clean(a.summary), clean(a.image_notes), Number(a.word_count)||500, clean(a.status || 'draft'), id, user.id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/articles/')) {
    const user = requireLogin(req, res); if (!user) return;
    const id = Number(url.pathname.split('/').pop());
    db.prepare('DELETE FROM articles WHERE id=? AND user_id=?').run(id, user.id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/prompt/')) {
    const user = requireLogin(req, res); if (!user) return;
    const id = Number(url.pathname.split('/').pop());
    const article = db.prepare('SELECT * FROM articles WHERE id=? AND user_id=?').get(id, user.id);
    if (!article) return send(res, 404, { error: '未找到文章' });
    return send(res, 200, { prompt: generatePrompt(article) });
  }
  send(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res).catch(e => send(res, 500, { error: e.message }));
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  file = path.normalize(file).replace(/^([.][.][\\/])+/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  send(res, 200, fs.readFileSync(full), mime[path.extname(full)] || 'application/octet-stream');
});
server.listen(PORT, '0.0.0.0', () => console.log(`检验科普内容工作台已启动：http://localhost:${PORT}`));
