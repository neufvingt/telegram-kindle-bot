import JSZip from 'jszip';
import { EPUB_STYLES, FILENAME_CLEANUP_REGEX } from './config.js';

// 清理文件名
export function cleanFilename(filename: string): string {
  return filename.replace(FILENAME_CLEANUP_REGEX, '');
}

// 调整EPUB样式
export async function adjustEpubStyles(epubBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(epubBuffer);
  const styles = EPUB_STYLES.epub;

  // 查找所有CSS文件并修改
  const cssFiles = Object.keys(zip.files).filter(name =>
    name.endsWith('.css') && !zip.files[name].dir
  );

  for (const cssFile of cssFiles) {
    let cssContent = await zip.files[cssFile].async('string');
    cssContent = injectStyles(cssContent, styles);
    zip.file(cssFile, cssContent);
  }

  // 查找所有XHTML/HTML文件并添加内联样式
  const htmlFiles = Object.keys(zip.files).filter(name =>
    (name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm')) &&
    !zip.files[name].dir
  );

  for (const htmlFile of htmlFiles) {
    let htmlContent = await zip.files[htmlFile].async('string');
    htmlContent = injectInlineStyles(htmlContent, styles);
    zip.file(htmlFile, htmlContent);
  }

  // 重新生成EPUB
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

// 注入CSS样式
function injectStyles(css: string, styles: typeof EPUB_STYLES.epub): string {
  const additionalCSS = `
/* Injected by Kindle Bot */
body, p, div, span {
  line-height: ${styles.lineHeight} !important;
}
p:not([class*="title"]):not([class*="heading"]):not([class*="chapter"]):not([class*="h1"]):not([class*="h2"]):not([class*="h3"]) {
  margin: 0 0 ${styles.paragraphSpacing} 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
`;

  // 替换现有的line-height（不影响标题）
  css = css.replace(/line-height\s*:\s*[^;!}]+/g, `line-height: ${styles.lineHeight}`);

  return css + additionalCSS;
}

// 注入内联样式到HTML
function injectInlineStyles(html: string, styles: typeof EPUB_STYLES.epub): string {
  const styleTag = `<style type="text/css">
/* Injected by Kindle Bot */
body, p, div, span { line-height: ${styles.lineHeight} !important; }
p:not([class*="title"]):not([class*="heading"]):not([class*="chapter"]):not([class*="h1"]):not([class*="h2"]):not([class*="h3"]) { margin: 0 0 ${styles.paragraphSpacing} 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
</style>`;

  // 在</head>前插入样式
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${styleTag}\n</head>`);
  } else if (html.includes('<body')) {
    // 如果没有head标签，在body前插入
    html = html.replace('<body', `${styleTag}\n<body`);
  }

  return html;
}
