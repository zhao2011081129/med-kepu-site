# 医学科普文章工作台

一个面向医院公众号 / 小红书医学科普稿的本地/云端文章工作台。

## 功能

- 登录 / 注册
- 保存医学科普文章草稿
- 按固定医学科普结构整理内容
- 生成并复制 AI 写作提示词
- 高级 Scrollytelling 风格界面

## 本地运行

```bash
node server.js
```

默认访问：

```text
http://localhost:3000
```

## 云端部署

项目支持 Render 等 Node.js 平台：

- Start Command: `node server.js`
- Node Version: 24+
- 环境变量可选：
  - `PORT`：平台通常自动提供
  - `DATA_DIR`：数据库目录，默认 `./data`
  - `DB_PATH`：SQLite 数据库路径

注意：如果云平台没有持久化磁盘，SQLite 数据可能会在服务重启后丢失。正式使用建议绑定持久化磁盘或改成云数据库。
