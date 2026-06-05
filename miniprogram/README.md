# 微信小程序版

这是医学科普文章工作台的小程序前端，复用同一个 Node.js + SQLite 后端接口。

## 本地预览

1. 先启动后端：

```bash
node server.js
```

后端默认地址：

```text
http://localhost:3000
```

2. 用微信开发者工具打开项目根目录：

```text
C:\Users\大泽\.openclaw\workspace\med-kepu-site
```

3. 开发者工具里建议先勾选：

```text
详情 → 本地设置 → 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

4. 小程序本地接口地址在：

```text
miniprogram/app.js
```

默认：

```js
baseUrl: 'http://127.0.0.1:3000'
```

## 上线前需要改

微信正式小程序不能直接请求 `localhost` 或普通 `http`，需要：

1. 把后端部署到 Render 等云平台；
2. 绑定 HTTPS 域名；
3. 在微信公众平台后台配置 request 合法域名；
4. 把 `miniprogram/app.js` 里的 `baseUrl` 改成云端 HTTPS 地址，例如：

```js
baseUrl: 'https://your-domain.example.com'
```

## 页面

- `pages/login/login`：登录 / 注册
- `pages/articles/articles`：文章列表
- `pages/editor/editor`：新建、编辑、删除文章，生成并复制 AI 提示词

## 数据持久化

小程序只负责前端展示，数据仍由后端 SQLite 保存。Render 部署时请使用根目录 `render.yaml` 中的持久化磁盘配置。
