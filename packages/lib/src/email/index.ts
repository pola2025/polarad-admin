import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
}

// SMTP 트랜스포터 생성
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"폴라애드" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    return true;
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    return false;
  }
}

// 계약서 이메일 발송
export async function sendContractEmail(
  to: string,
  contractNumber: string,
  companyName: string,
  pdfBuffer: Buffer
): Promise<boolean> {
  const subject = `[폴라애드] ${companyName} 광고 대행 서비스 계약서`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: #0066CC;
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
        }
        .footer {
          background: #374151;
          color: #9ca3af;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          border-radius: 0 0 8px 8px;
        }
        .highlight {
          background: #dbeafe;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #0066CC;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>광고 대행 서비스 계약서</h1>
        </div>
        <div class="content">
          <p>안녕하세요, <strong>${companyName}</strong> 담당자님.</p>

          <p>폴라애드와 함께해 주셔서 감사합니다.</p>

          <div class="highlight">
            <strong>계약번호:</strong> ${contractNumber}
          </div>

          <p>첨부된 PDF 파일에서 계약서 전문을 확인하실 수 있습니다.</p>

          <p>계약서와 관련하여 문의사항이 있으시면 언제든지 연락 주세요.</p>

          <p style="margin-top: 30px;">
            감사합니다.<br>
            <strong>폴라애드 팀</strong>
          </p>
        </div>
        <div class="footer">
          <p>주식회사 폴라애드</p>
          <p>서울특별시 강남구 테헤란로 123</p>
          <p>대표전화: 02-1234-5678 | 이메일: contact@polarad.co.kr</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    attachments: [
      {
        filename: `계약서_${contractNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

// 계약 요청 접수 알림 이메일
export async function sendContractRequestNotification(
  to: string,
  contractNumber: string,
  companyName: string
): Promise<boolean> {
  const subject = `[폴라애드] ${companyName} 계약 요청이 접수되었습니다`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: #0066CC;
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
        }
        .footer {
          background: #374151;
          color: #9ca3af;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          border-radius: 0 0 8px 8px;
        }
        .highlight {
          background: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #f59e0b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>계약 요청 접수 안내</h1>
        </div>
        <div class="content">
          <p>안녕하세요, <strong>${companyName}</strong> 담당자님.</p>

          <p>계약 요청이 정상적으로 접수되었습니다.</p>

          <div class="highlight">
            <strong>계약번호:</strong> ${contractNumber}<br>
            <strong>상태:</strong> 승인 대기 중
          </div>

          <p>담당자 검토 후 승인이 완료되면 이메일로 계약서를 발송해 드리겠습니다.</p>

          <p>일반적으로 1-2 영업일 내에 처리됩니다.</p>

          <p style="margin-top: 30px;">
            감사합니다.<br>
            <strong>폴라애드 팀</strong>
          </p>
        </div>
        <div class="footer">
          <p>주식회사 폴라애드</p>
          <p>서울특별시 강남구 테헤란로 123</p>
          <p>대표전화: 02-1234-5678 | 이메일: contact@polarad.co.kr</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}
