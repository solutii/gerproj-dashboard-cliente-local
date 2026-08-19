import nodemailer, { Transporter } from 'nodemailer';

// ─── Singleton do transporter ─────────────────────────────────────────────────
// Criado uma única vez e reutilizado em todas as requisições (evita overhead
// de reconexão SMTP a cada chamado aberto).
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (_transporter) return _transporter;

    _transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT ?? 465),
        secure: process.env.EMAIL_SECURE === 'true', // true = TLS implícito (porta 465)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    return _transporter;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface MailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string; // plain text: força multipart/alternative (Delphi lê HTML dentro dele)
    from?: string; // cabeçalho From: visível (Delphi lê este)
    envelopeFrom?: string; // envelope SMTP: o servidor autentica com este
    replyTo?: string;
    messageId?: string;
    references?: string;
    inReplyTo?: string;
}

// ─── Envio ────────────────────────────────────────────────────────────────────
export async function sendMail(opts: MailOptions): Promise<void> {
    const transporter = getTransporter();

    const fromHeader = opts.from ?? process.env.EMAIL_FROM;
    const envelopeSender = opts.envelopeFrom ?? process.env.EMAIL_USER;

    await transporter.sendMail({
        from: fromHeader,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        // Envelope separado do header: Locaweb autentica com envelopeSender,
        // mas o cabeçalho From: fica com o email do cliente para o Delphi ler.
        envelope: {
            from: envelopeSender,
            to: opts.to,
        },
        ...(opts.replyTo && { replyTo: opts.replyTo }),
        ...(opts.messageId && { messageId: opts.messageId }),
        ...(opts.references && { references: opts.references }),
        ...(opts.inReplyTo && { inReplyTo: opts.inReplyTo }),
    });
}
