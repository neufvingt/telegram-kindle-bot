import jschardet from 'jschardet';
import iconv from 'iconv-lite';

// 检测文本编码并转换为UTF-8
export function detectAndConvertEncoding(buffer: Buffer): string {
  // 检测编码
  const detected = jschardet.detect(buffer);
  let encoding = detected.encoding || 'utf-8';

  // 规范化编码名称
  encoding = normalizeEncoding(encoding);

  // 如果已经是UTF-8，直接转换
  if (encoding.toLowerCase() === 'utf-8' || encoding.toLowerCase() === 'ascii') {
    return buffer.toString('utf-8');
  }

  // 使用iconv-lite转换编码
  try {
    return iconv.decode(buffer, encoding);
  } catch (e) {
    // 如果转换失败，尝试UTF-8
    return buffer.toString('utf-8');
  }
}

// 规范化编码名称
function normalizeEncoding(encoding: string): string {
  const encodingMap: Record<string, string> = {
    'gb2312': 'gbk',
    'gb18030': 'gbk',
    'big5': 'big5',
    'utf-16le': 'utf-16le',
    'utf-16be': 'utf-16be',
    'utf-16': 'utf-16le',
    'ascii': 'utf-8',
    'iso-8859-1': 'utf-8',
  };

  const lower = encoding.toLowerCase();
  return encodingMap[lower] || encoding;
}

// 检测文本语言（中文/英文）
export function detectLanguage(text: string): 'zh' | 'en' {
  // 统计中文字符数量
  const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
  // 统计英文单词数量
  const englishWords = text.match(/[a-zA-Z]+/g) || [];

  // 如果中文字符数量超过英文单词数量的2倍，认为是中文
  if (chineseChars.length > englishWords.length * 2) {
    return 'zh';
  }

  // 如果英文单词数量超过中文字符数量，认为是英文
  if (englishWords.length > chineseChars.length) {
    return 'en';
  }

  // 默认中文
  return 'zh';
}

// 标点符号规范化
export function normalizePunctuation(text: string, language: 'zh' | 'en'): string {
  if (language === 'zh') {
    return normalizeChinesePunctuation(text);
  } else {
    return normalizeEnglishPunctuation(text);
  }
}

// 中文标点规范化
function normalizeChinesePunctuation(text: string): string {
  let result = text;

  // 省略号转换：... → ……（保护数字中的小数点）
  result = result.replace(/\.{3,}/g, '\u2026\u2026');

  // 破折号转换：-- → ——
  result = result.replace(/--+/g, '\u2014\u2014');

  // 英文逗号转中文逗号（但保留数字中的千分位逗号）
  result = result.replace(/,(?!\d)/g, '\uff0c');

  // 英文句号转中文句号（但保留数字中的小数点）
  result = result.replace(/\.(?!\d)(?!\.)/g, '\u3002');

  // 英文问号转中文问号
  result = result.replace(/\?/g, '\uff1f');

  // 英文感叹号转中文感叹号
  result = result.replace(/!/g, '\uff01');

  // 英文冒号转中文冒号
  result = result.replace(/:/g, '\uff1a');

  // 英文分号转中文分号
  result = result.replace(/;/g, '\uff1b');

  // 智能处理引号
  result = normalizeChineseQuotes(result);

  return result;
}

// 英文标点规范化
function normalizeEnglishPunctuation(text: string): string {
  let result = text;

  // 中文逗号转英文逗号
  result = result.replace(/\uff0c/g, ',');

  // 中文句号转英文句号
  result = result.replace(/\u3002/g, '.');

  // 中文问号转英文问号
  result = result.replace(/\uff1f/g, '?');

  // 中文感叹号转英文感叹号
  result = result.replace(/\uff01/g, '!');

  // 中文冒号转英文冒号
  result = result.replace(/\uff1a/g, ':');

  // 中文分号转英文分号
  result = result.replace(/\uff1b/g, ';');

  // 中文省略号转英文省略号
  result = result.replace(/\u2026\u2026/g, '...');

  // 中文破折号转英文破折号
  result = result.replace(/\u2014\u2014/g, '--');

  // 智能处理引号
  result = normalizeEnglishQuotes(result);

  return result;
}

// 中文引号规范化（保留原文开闭状态，只转换类型）
function normalizeChineseQuotes(text: string): string {
  let result = text;

  // 英文弯双引号转中文双引号（保留开闭）
  result = result.replace(/\u201c/g, '\u201c'); // " → "（左双引号保持）
  result = result.replace(/\u201d/g, '\u201d'); // " → "（右双引号保持）

  // 英文直双引号 " 不转换（无法判断开闭）

  // 英文弯单引号转中文单引号（保留开闭）
  result = result.replace(/\u2018/g, '\u2018'); // ' → '（左单引号保持）
  result = result.replace(/\u2019/g, '\u2019'); // ' → '（右单引号保持）

  // 日文引号转中文引号
  result = result.replace(/\u300c/g, '\u201c'); // 「 → "
  result = result.replace(/\u300d/g, '\u201d'); // 」 → "
  result = result.replace(/\u300e/g, '\u2018'); // 『 → '
  result = result.replace(/\u300f/g, '\u2019'); // 』 → '

  return result;
}

// 英文引号规范化（保留原文开闭状态，只转换类型）
function normalizeEnglishQuotes(text: string): string {
  let result = text;

  // 中文双引号转英文弯双引号（保留开闭）
  result = result.replace(/\u201c/g, '\u201c'); // " → "（左双引号保持）
  result = result.replace(/\u201d/g, '\u201d'); // " → "（右双引号保持）

  // 中文单引号转英文弯单引号（保留开闭）
  result = result.replace(/\u2018/g, '\u2018'); // ' → '（左单引号保持）
  result = result.replace(/\u2019/g, '\u2019'); // ' → '（右单引号保持）

  // 日文引号转英文弯引号
  result = result.replace(/\u300c/g, '\u201c'); // 「 → "
  result = result.replace(/\u300d/g, '\u201d'); // 」 → "
  result = result.replace(/\u300e/g, '\u2018'); // 『 → '
  result = result.replace(/\u300f/g, '\u2019'); // 』 → '

  return result;
}
