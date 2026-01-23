import nodemailer from 'nodemailer';

interface SendEmailOptions {
  filename: string;
  fileBuffer: Buffer;
}

// 创建邮件传输器
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.163.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER 和 SMTP_PASS 环境变量未设置');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

// 发送EPUB到Kindle
export async function sendToKindle(options: SendEmailOptions): Promise<void> {
  const kindleEmail = process.env.KINDLE_EMAIL;
  const smtpUser = process.env.SMTP_USER;

  if (!kindleEmail) {
    throw new Error('KINDLE_EMAIL 环境变量未设置');
  }

  if (!smtpUser) {
    throw new Error('SMTP_USER 环境变量未设置');
  }

  const transporter = createTransporter();

  // 确保文件名以.epub结尾
  let filename = options.filename;
  if (!filename.toLowerCase().endsWith('.epub')) {
    filename = filename.replace(/\.[^.]+$/, '') + '.epub';
  }

  const mailOptions = {
    from: smtpUser,
    to: kindleEmail,
    subject: 'Kindle Document',
    text: 'Sent from Telegram Kindle Bot',
    attachments: [
      {
        filename,
        content: options.fileBuffer,
        contentType: 'application/epub+zip',
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}
