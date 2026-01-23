# Telegram Kindle Bot

部署在 Vercel 上的 Telegram 机器人，自动将 TXT/EPUB 文件处理后发送到 Kindle。

## 功能

### TXT 文件
- 自动转换为 EPUB 格式
- 智能提取书名、作者（支持多种文件名格式）
- 自动识别章节目录
- 自动编码检测（UTF-8、GBK、GB2312、GB18030、Big5、UTF-16）
- 标点符号自动规范化
- 短章节自动合并（< 300字）
- 发送到 Kindle

### EPUB 文件
- 调整行高为 1.4
- 调整段间距为 0.5em
- 去除文件名中的 `(Z-Library)`
- 发送到 Kindle

### Bot 命令
- `/start` - 显示使用说明
- `/help` - 显示使用说明

## 智能识别

### 书名作者识别

支持以下文件名格式：

**带书名号格式：**

| 格式 | 示例 |
|------|------|
| `《书名》作者：作者名` | `《三体》作者：刘慈欣.txt` |
| `《书名》著：作者` | `《三体》著：刘慈欣.txt` |
| `《书名》by作者` | `《三体》by刘慈欣.txt` |
| `《书名》（作者）` | `《三体》（刘慈欣）.txt` |
| `《书名》[作者]` | `《三体》[刘慈欣].txt` |
| `《书名》 作者` | `《三体》 刘慈欣.txt` |
| `《书名》` | `《三体》.txt` |
| `作者《书名》` | `刘慈欣《三体》.txt` |

**不带书名号格式：**

| 格式 | 示例 |
|------|------|
| `书名 作者：作者名` | `三体 作者：刘慈欣.txt` |
| `书名 by 作者` | `三体 by 刘慈欣.txt` |
| `书名（作者）` | `三体（刘慈欣）.txt` |
| `书名-作者` | `三体-刘慈欣.txt` |
| `书名——作者` | `三体——刘慈欣.txt` |
| `书名_作者` | `三体_刘慈欣.txt` |
| `书名.作者` | `三体.刘慈欣.txt` |
| `书名+作者` | `三体+刘慈欣.txt` |

**自动清理前后缀标签：**

- 前缀：`【完结】`、`【237】`、`[精校]`、`（全本）` 等
- 后缀：`(精校)`、`[校对版]`、`【完整版】`、`(出版)` 等

示例：`【完结】《三体》作者：刘慈欣(精校版).txt` → `三体.epub`

### 章节识别

支持以下章节格式：

- `第X章`、`第X节`、`第X回`、`第X部`、`第X卷`、`第X集`
- `Chapter X`
- `卷X`、`番X`
- `序章`、`终章`、`尾声`、`后记`、`前言`、`番外`、`楔子`
- `一、xxx`、`1 xxx`、`(1) xxx`
- `☆xxx`、`★xxx`
- `◎xxx◎`、`===xxx===`

配置参数：
- 标题最大长度：40 字符
- 标题前缀长度限制：5 字符
- 排除日期格式
- 排除引号对话（避免 `"1 xxx"` 被误识别）

### 标点符号规范化

自动检测文本语言（中文/英文），并进行相应的标点规范化：

**中文小说：**
- 省略号：`...` → `……`
- 破折号：`--` → `——`
- 逗号：`,` → `，`
- 句号：`.` → `。`
- 智能引号处理

**英文小说：**
- 中文标点转英文标点
- 智能引号处理

保留数字中的小数点和千分位逗号（如 `3.14`、`1,000`）

### 短章节合并

字数少于 300 字的章节会自动合并到前一章，不保留短章节的标题。

## 部署

### 1. 克隆项目

```bash
git clone <your-repo>
cd telegram-kindle-bot
npm install
```

### 2. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建机器人
3. 记录获取的 Bot Token

### 3. 配置 163 邮箱

1. 登录 [163邮箱](https://mail.163.com)
2. 设置 → POP3/SMTP/IMAP → 开启 SMTP 服务
3. 获取授权码（不是登录密码）

### 4. 配置 Kindle

1. 登录 [Amazon](https://www.amazon.cn/hz/mycd/myx#/home/settings/payment)
2. 管理我的内容和设备 → 首选项 → 个人文档设置
3. 将你的 163 邮箱添加到「已批准的发件人电子邮件列表」
4. 记录你的 Kindle 邮箱地址（xxx@kindle.cn）

### 5. 部署到 Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

在 Vercel Dashboard 中设置环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | `123456:ABC-DEF...` |
| `KINDLE_EMAIL` | Kindle 邮箱 | `xxx@kindle.cn` |
| `SMTP_HOST` | SMTP 服务器 | `smtp.163.com` |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_USER` | 163 邮箱地址 | `xxx@163.com` |
| `SMTP_PASS` | 163 邮箱授权码 | `ABCDEFGHIJKLMNOP` |
| `MAX_FILE_SIZE` | 文件大小限制（字节） | `10485760` |

### 6. 设置 Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/webhook"
```

或使用脚本：

```bash
TELEGRAM_BOT_TOKEN=xxx npx ts-node scripts/set-webhook.ts your-app.vercel.app
```

## EPUB 样式配置

### TXT 转换样式

| 属性 | 值 |
|------|-----|
| 段落缩进 | 2em |
| 标题大小 | 1.4em |
| 章节上方留白 | 1em |
| 章节下方留白 | 1em |
| 行高 | 1.5 |
| 段间距 | 0 |
| 文本对齐 | 两端对齐 |
| 章节标题对齐 | 居左 |
| 章节标题加粗 | 是 |

### EPUB 调整样式

| 属性 | 值 |
|------|-----|
| 行高 | 1.4 |
| 段间距 | 0.5em |

## 项目结构

```
telegram-kindle-bot/
├── api/
│   └── webhook.ts          # Vercel serverless 入口
├── lib/
│   ├── config.ts           # 配置（正则、样式）
│   ├── txt-to-epub.ts      # TXT 转 EPUB
│   ├── epub-processor.ts   # EPUB 样式调整
│   ├── encoding.ts         # 编码检测和标点规范化
│   ├── email.ts            # 邮件发送
│   └── telegram.ts         # Telegram API
├── scripts/
│   └── set-webhook.ts      # Webhook 设置脚本
├── package.json
├── tsconfig.json
├── vercel.json
└── .env.example
```

## License

MIT
