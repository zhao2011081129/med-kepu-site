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

const defaultTemplate = `你现在是一名资深医学科普类编辑。
目标：写一篇关于「{disease}」的医学科普文章。
发布平台：{platform}。
受众：{audience}。
要求：
1. 制定一个吸引人的标题。
2. 内容包含：
   2.1 什么是{disease}
   2.2 临床表现：常见症状、什么情况下入院或被发现
   2.3 实验室/医学诊断依据
   2.4 治疗原则及疾病转归
3. 结尾总结：重点提醒出现哪些身体信号要及时就医。
4. 通篇科学、严谨，避免夸大；语气像医生面对面向患者解释。
5. 关键地方提示配图建议。
6. 不替代医生诊疗，不确定内容需核实。
字数：约{word_count}字。
输出格式：标题、正文小标题、结尾提醒。`;

db.prepare('INSERT OR IGNORE INTO templates(name, content) VALUES (?, ?)').run('医学科普文章模板', defaultTemplate);

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
  const tpl = db.prepare('SELECT content FROM templates WHERE name=?').get('医学科普文章模板').content;
  return tpl.replaceAll('{disease}', article.disease || '')
    .replaceAll('{platform}', article.platform || '医院公众号/小红书')
    .replaceAll('{audience}', article.audience || '关注自身健康、无医学知识的普通群众')
    .replaceAll('{word_count}', String(article.word_count || 500));
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
    if (!a.title || !a.disease) return send(res, 400, { error: '标题和疾病名称必填' });
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
server.listen(PORT, '0.0.0.0', () => console.log(`医学科普网站已启动：http://localhost:${PORT}`));
