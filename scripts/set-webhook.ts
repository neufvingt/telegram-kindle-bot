// 设置Telegram Webhook的脚本
// 使用方法: npx ts-node scripts/set-webhook.ts <your-vercel-domain>

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function setWebhook(domain: string) {
  if (!BOT_TOKEN) {
    console.error('错误: 请设置 TELEGRAM_BOT_TOKEN 环境变量');
    process.exit(1);
  }

  const webhookUrl = `https://${domain}/api/webhook`;
  const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

  console.log(`设置 Webhook: ${webhookUrl}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
    }),
  });

  const result = await response.json();
  console.log('结果:', result);
}

const domain = process.argv[2];
if (!domain) {
  console.error('用法: npx ts-node scripts/set-webhook.ts <your-vercel-domain>');
  console.error('示例: npx ts-node scripts/set-webhook.ts my-bot.vercel.app');
  process.exit(1);
}

setWebhook(domain);
