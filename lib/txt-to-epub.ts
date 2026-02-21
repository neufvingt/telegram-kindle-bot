import JSZip from 'jszip';
import {
  CHAPTER_REGEX,
  DATE_REGEX,
  QUOTE_CHARS,
  MAX_TITLE_LENGTH,
  TITLE_PREFIX_LENGTH,
  MIN_CHAPTER_LENGTH,
  EPUB_STYLES,
  BOOK_INFO_PATTERNS,
  CONTENT_INFO_PATTERNS,
  FILENAME_SITE_CLEANUP_REGEX,
} from './config.js';
import {
  detectAndConvertEncoding,
  detectLanguage,
  normalizePunctuation,
} from './encoding.js';

export interface BookInfo {
  title: string;
  author: string;
}

export interface Chapter {
  title: string;
  content: string;
  id: string;
}

// 从文件名提取书名和作者
export function extractBookInfoFromFilename(filename: string): BookInfo {
  let nameWithoutExt = filename.replace(/\.(txt|epub)$/i, '');

  // 清理括号内的网站域名（如 (z-library.sk, 1lib.sk, z-lib.sk)）
  nameWithoutExt = nameWithoutExt.replace(FILENAME_SITE_CLEANUP_REGEX, '');

  // 清理所有前缀标签：【xxx】[xxx]（xxx）(xxx) 等
  // 包括：【237】【完结】【番15】【番外全】【番全】【补番x~x】【补章x~x】【车版】【车版番】【车版完结】【车版番全】等
  nameWithoutExt = nameWithoutExt.replace(/^([\[【［（(][^\]】］）)]*[\]】］）)]\s*)+/g, '');

  // 清理末尾后缀标签：(精校)、[校对版]、(全本)、【完整版】、(出版) 等
  nameWithoutExt = nameWithoutExt.replace(/(\s*[\[【［（(][^\]】］）)]*[\]】］）)])+$/g, '');

  // 特殊处理：作者《书名》格式（作者在前）
  const authorFirstMatch = nameWithoutExt.match(/^(.+?)《(.+?)》$/);
  if (authorFirstMatch) {
    return {
      title: authorFirstMatch[2].trim(),
      author: authorFirstMatch[1].trim(),
    };
  }

  for (const pattern of BOOK_INFO_PATTERNS) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      // 如果只有一个捕获组（仅书名），作者为空
      if (match.length === 2) {
        return {
          title: match[1].trim(),
          author: '',
        };
      }
      return {
        title: match[1].trim(),
        author: match[2]?.trim() || '',
      };
    }
  }

  return {
    title: nameWithoutExt.trim(),
    author: '',
  };
}

// 从内容开头提取书名和作者
export function extractBookInfoFromContent(content: string): Partial<BookInfo> {
  const lines = content.split('\n').slice(0, 30);
  const result: Partial<BookInfo> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // 书名匹配
    const titleMatch = trimmed.match(CONTENT_INFO_PATTERNS[0]) || trimmed.match(CONTENT_INFO_PATTERNS[2]);
    if (titleMatch && !result.title) {
      result.title = titleMatch[1].trim();
    }

    // 作者匹配
    const authorMatch = trimmed.match(CONTENT_INFO_PATTERNS[1]) || trimmed.match(CONTENT_INFO_PATTERNS[3]);
    if (authorMatch && !result.author) {
      result.author = authorMatch[1].trim();
    }
  }

  return result;
}

// 判断是否为章节标题
function isChapterTitle(line: string, prevLine: string): boolean {
  const trimmed = line.trim();

  // 空行或太长的行不是标题
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) {
    return false;
  }

  // 排除以引号开头或结尾的行（避免对话被误识别）
  if (QUOTE_CHARS.test(trimmed)) {
    return false;
  }

  // 排除日期格式
  if (DATE_REGEX.test(trimmed)) {
    return false;
  }

  // 检查标题前缀长度（允许标题前有最多 TITLE_PREFIX_LENGTH 个字符）
  const leadingSpaces = line.length - line.trimStart().length;
  if (leadingSpaces > TITLE_PREFIX_LENGTH) {
    return false;
  }

  return CHAPTER_REGEX.test(trimmed);
}

// 解析章节
export function parseChapters(content: string): Chapter[] {
  const lines = content.split('\n');
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let contentLines: string[] = [];
  let chapterIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';

    if (isChapterTitle(line, prevLine)) {
      // 保存之前的章节
      if (currentChapter) {
        currentChapter.content = contentLines.join('\n').trim();
        if (currentChapter.content) {
          chapters.push(currentChapter);
        }
      } else if (contentLines.length > 0) {
        // 第一个章节之前的内容作为序言
        const prologueContent = contentLines.join('\n').trim();
        if (prologueContent) {
          chapters.push({
            title: '序',
            content: prologueContent,
            id: `chapter_${chapterIndex++}`,
          });
        }
      }

      // 开始新章节
      currentChapter = {
        title: line.trim(),
        content: '',
        id: `chapter_${chapterIndex++}`,
      };
      contentLines = [];
    } else {
      contentLines.push(line);
    }
  }

  // 保存最后一个章节
  if (currentChapter) {
    currentChapter.content = contentLines.join('\n').trim();
    if (currentChapter.content) {
      chapters.push(currentChapter);
    }
  } else if (contentLines.length > 0) {
    // 没有识别到任何章节，整个内容作为一章
    chapters.push({
      title: '正文',
      content: contentLines.join('\n').trim(),
      id: 'chapter_0',
    });
  }

  return chapters;
}

// 合并短章节（字数少于阈值的章节合并到前一章）
function mergeShortChapters(chapters: Chapter[]): Chapter[] {
  if (chapters.length <= 1) {
    return chapters;
  }

  const merged: Chapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const contentLength = chapter.content.replace(/\s/g, '').length;

    if (contentLength < MIN_CHAPTER_LENGTH && merged.length > 0) {
      // 合并到前一章，不保留短章节的标题
      const prevChapter = merged[merged.length - 1];
      prevChapter.content = prevChapter.content + '\n\n' + chapter.content;
    } else {
      merged.push({ ...chapter });
    }
  }

  // 重新分配ID
  return merged.map((ch, i) => ({
    ...ch,
    id: `chapter_${i}`,
  }));
}

// 处理段落内容
function processContent(content: string): string {
  const lines = content.split('\n');
  const paragraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      // 转义HTML特殊字符
      const escaped = trimmed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      paragraphs.push(`<p>${escaped}</p>`);
    }
  }

  return paragraphs.join('\n');
}

// 生成UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 生成EPUB CSS
function generateCSS(): string {
  const styles = EPUB_STYLES.txt;
  return `
body {
  margin: ${styles.pageMargin};
  padding: 0;
  line-height: ${styles.lineHeight};
  text-align: ${styles.textAlign};
}

p {
  text-indent: ${styles.paragraphIndent};
  margin: 0 0 ${styles.paragraphSpacing} 0;
  line-height: ${styles.lineHeight};
}

h1, h2, h3 {
  text-align: ${styles.titleAlign};
  font-size: ${styles.titleSize};
  font-weight: ${styles.titleBold ? 'bold' : 'normal'};
  margin-top: ${styles.chapterMarginTop};
  margin-bottom: ${styles.chapterMarginBottom};
  page-break-before: always;
}

h1:first-child {
  page-break-before: avoid;
}

.toc-item {
  margin-bottom: ${styles.tocItemSpacing};
}

.toc-item a {
  text-decoration: none;
  color: inherit;
}
`;
}

// 生成章节XHTML
function generateChapterXHTML(chapter: Chapter): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>${chapter.title}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h2>${chapter.title}</h2>
  ${processContent(chapter.content)}
</body>
</html>`;
}

// 生成目录XHTML
function generateTocXHTML(chapters: Chapter[], title: string): string {
  const tocItems = chapters.map(ch =>
    `<li class="toc-item"><a href="${ch.id}.xhtml">${ch.title}</a></li>`
  ).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>目录</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${title}</h1>
  <nav epub:type="toc">
    <h2>目录</h2>
    <ol>
    ${tocItems}
    </ol>
  </nav>
</body>
</html>`;
}

// 生成NCX文件
function generateNCX(chapters: Chapter[], bookInfo: BookInfo, uuid: string): string {
  const navPoints = chapters.map((ch, i) => `
    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${ch.title}</text></navLabel>
      <content src="OEBPS/${ch.id}.xhtml"/>
    </navPoint>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${bookInfo.title}</text></docTitle>
  <docAuthor><text>${bookInfo.author || '未知'}</text></docAuthor>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
}

// 生成OPF文件
function generateOPF(chapters: Chapter[], bookInfo: BookInfo, uuid: string): string {
  const manifestItems = chapters.map(ch =>
    `<item id="${ch.id}" href="OEBPS/${ch.id}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n    ');

  const spineItems = chapters.map(ch =>
    `<itemref idref="${ch.id}"/>`
  ).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${bookInfo.title}</dc:title>
    <dc:creator>${bookInfo.author || '未知'}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="OEBPS/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="OEBPS/styles.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="nav"/>
    ${spineItems}
  </spine>
</package>`;
}

export interface TxtToEpubResult {
  buffer: Buffer;
  bookInfo: BookInfo;
}

// TXT转EPUB主函数（接受字符串）
export async function txtToEpub(txtContent: string, filename: string): Promise<TxtToEpubResult> {
  // 检测语言并规范化标点
  const language = detectLanguage(txtContent);
  const normalizedContent = normalizePunctuation(txtContent, language);

  // 提取书籍信息
  const filenameInfo = extractBookInfoFromFilename(filename);
  const contentInfo = extractBookInfoFromContent(normalizedContent);

  const bookInfo: BookInfo = {
    title: contentInfo.title || filenameInfo.title,
    author: contentInfo.author || filenameInfo.author,
  };

  // 解析章节
  let chapters = parseChapters(normalizedContent);

  if (chapters.length === 0) {
    throw new Error('无法识别任何章节内容');
  }

  // 合并短章节
  chapters = mergeShortChapters(chapters);

  // 生成UUID
  const uuid = generateUUID();

  // 创建EPUB (ZIP格式)
  const zip = new JSZip();

  // mimetype (必须是第一个文件，不压缩)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // content.opf
  zip.file('content.opf', generateOPF(chapters, bookInfo, uuid));

  // toc.ncx
  zip.file('toc.ncx', generateNCX(chapters, bookInfo, uuid));

  // OEBPS/styles.css
  zip.file('OEBPS/styles.css', generateCSS());

  // OEBPS/nav.xhtml (目录)
  zip.file('OEBPS/nav.xhtml', generateTocXHTML(chapters, bookInfo.title));

  // 各章节文件
  for (const chapter of chapters) {
    zip.file(`OEBPS/${chapter.id}.xhtml`, generateChapterXHTML(chapter));
  }

  // 生成EPUB文件
  const epubBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return {
    buffer: epubBuffer,
    bookInfo,
  };
}

// TXT转EPUB主函数（接受Buffer，自动检测编码）
export async function txtBufferToEpub(buffer: Buffer, filename: string): Promise<TxtToEpubResult> {
  const txtContent = detectAndConvertEncoding(buffer);
  return txtToEpub(txtContent, filename);
}
