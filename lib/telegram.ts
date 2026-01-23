import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  document?: TelegramDocument;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// 获取API URL
function getApiUrl(method: string): string {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN 环境变量未设置');
  }
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

// 发送消息
export async function sendMessage(chatId: number, text: string): Promise<void> {
  const response = await fetch(getApiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`发送消息失败: ${error}`);
  }
}

// 获取文件信息
export async function getFile(fileId: string): Promise<TelegramFile> {
  const response = await fetch(getApiUrl('getFile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`获取文件信息失败: ${error}`);
  }

  const data = await response.json() as { ok: boolean; result: TelegramFile };
  if (!data.ok) {
    throw new Error('获取文件信息失败');
  }

  return data.result;
}

// 下载文件
export async function downloadFile(filePath: string): Promise<Buffer> {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN 环境变量未设置');
  }

  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`下载文件失败: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 解析更新
export function parseUpdate(body: unknown): TelegramUpdate | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  return body as TelegramUpdate;
}

// 获取文档信息
export function getDocument(update: TelegramUpdate): TelegramDocument | null {
  return update.message?.document || null;
}

// 获取聊天ID
export function getChatId(update: TelegramUpdate): number | null {
  return update.message?.chat?.id || null;
}

// 获取消息文本
export function getMessageText(update: TelegramUpdate): string | null {
  return update.message?.text || null;
}
