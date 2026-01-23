import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  parseUpdate,
  getDocument,
  getChatId,
  getMessageText,
  sendMessage,
  getFile,
  downloadFile,
} from '../lib/telegram.js';
import { txtBufferToEpub } from '../lib/txt-to-epub.js';
import { adjustEpubStyles, cleanFilename } from '../lib/epub-processor.js';
import { sendToKindle } from '../lib/email.js';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

// 已处理的 update_id 缓存（防止重复处理）
// 注意：Vercel Serverless 函数是无状态的，这个缓存只在同一实例内有效
// 但可以防止短时间内的重复请求
const processedUpdates = new Set<number>();
const MAX_CACHE_SIZE = 1000;

function isProcessed(updateId: number): boolean {
  return processedUpdates.has(updateId);
}

function markProcessed(updateId: number): void {
  processedUpdates.add(updateId);
  // 防止内存泄漏，限制缓存大小
  if (processedUpdates.size > MAX_CACHE_SIZE) {
    const firstId = processedUpdates.values().next().value;
    if (firstId !== undefined) {
      processedUpdates.delete(firstId);
    }
  }
}

// 帮助信息
const HELP_MESSAGE = `📚 <b>Kindle Bot 使用说明</b>

发送 <b>TXT</b> 文件：
• 自动转换为 EPUB 格式
• 智能识别书名、作者和章节
• 发送到您的 Kindle

发送 <b>EPUB</b> 文件：
• 自动调整行高和段间距
• 清理文件名中的 (Z-Library)
• 发送到您的 Kindle

⚠️ 文件大小限制：${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;

// 处理文档
async function handleDocument(chatId: number, document: { file_id: string; file_name?: string; file_size?: number }): Promise<void> {
  const filename = document.file_name || 'unknown';
  const fileSize = document.file_size || 0;
  const ext = filename.toLowerCase().split('.').pop();

  // 检查文件大小
  if (fileSize > MAX_FILE_SIZE) {
    await sendMessage(chatId, `❌ 文件过大，不予处理。\n\n文件大小：${Math.round(fileSize / 1024 / 1024)}MB\n限制：${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
    return;
  }

  // 检查文件类型
  if (ext !== 'txt' && ext !== 'epub') {
    await sendMessage(chatId, '❌ 不支持的文件格式。\n\n请发送 TXT 或 EPUB 文件。');
    return;
  }

  await sendMessage(chatId, '⏳ 正在处理文件...');

  try {
    // 获取文件信息并下载
    const fileInfo = await getFile(document.file_id);
    if (!fileInfo.file_path) {
      throw new Error('无法获取文件路径');
    }

    const fileBuffer = await downloadFile(fileInfo.file_path);

    let epubBuffer: Buffer;
    let epubFilename: string;

    if (ext === 'txt') {
      // TXT转EPUB（自动检测编码）
      await sendMessage(chatId, '📖 正在转换 TXT 为 EPUB...');
      const result = await txtBufferToEpub(fileBuffer, filename);
      epubBuffer = result.buffer;
      // 使用提取的书名作为文件名
      epubFilename = result.bookInfo.title + '.epub';
    } else {
      // EPUB样式调整
      await sendMessage(chatId, '✨ 正在调整 EPUB 样式...');
      epubBuffer = await adjustEpubStyles(fileBuffer);
      epubFilename = cleanFilename(filename);
    }

    // 发送到Kindle
    await sendMessage(chatId, '📧 正在发送到 Kindle...');
    await sendToKindle({
      filename: epubFilename,
      fileBuffer: epubBuffer,
    });

    await sendMessage(chatId, `✅ 已发送到 Kindle！\n\n📚 ${epubFilename}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    await sendMessage(chatId, `❌ 处理失败：${errorMessage}`);
    console.error('处理文件错误:', error);
  }
}

// Webhook处理函数
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = parseUpdate(req.body);
    if (!update) {
      return res.status(200).json({ ok: true });
    }

    // 检查是否已处理过（防止 Telegram 重试导致重复处理）
    if (isProcessed(update.update_id)) {
      console.log(`跳过已处理的 update_id: ${update.update_id}`);
      return res.status(200).json({ ok: true });
    }
    markProcessed(update.update_id);

    const chatId = getChatId(update);
    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    // 处理文本消息
    const text = getMessageText(update);
    if (text) {
      const command = text.toLowerCase().trim();
      if (command === '/start' || command === '/help') {
        await sendMessage(chatId, HELP_MESSAGE);
        return res.status(200).json({ ok: true });
      }
    }

    // 处理文档
    const document = getDocument(update);
    if (document) {
      // 必须等待处理完成，否则 Vercel 会终止函数
      await handleDocument(chatId, document);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook错误:', error);
    return res.status(200).json({ ok: true });
  }
}
