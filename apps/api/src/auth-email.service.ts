import { Logger } from "@nestjs/common";
import { createTransport, type SendMailOptions, type Transporter } from "nodemailer";

import { type AppEnvironment, loadEnvironment } from "./config/environment.js";

interface AuthEmailLogger {
  error(message: string): void;
  log(message: string): void;
}

interface MailTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
}

interface AuthEmailMessage {
  email: string;
  name: string;
  url: string;
}

interface OutgoingAuthEmail {
  email: string;
  subject: string;
  text: string;
  type: string;
  url: string;
}

export class EmailDeliveryUnavailableError extends Error {
  constructor() {
    super("Email delivery is currently unavailable. Try again later.");
    this.name = "EmailDeliveryUnavailableError";
  }
}

export class AuthEmailService {
  constructor(
    private readonly environment: AppEnvironment = loadEnvironment(),
    private readonly logger: AuthEmailLogger = new Logger(AuthEmailService.name),
    private readonly transporter: MailTransport | undefined = createSmtpTransport(environment),
  ) {}

  async sendPasswordResetEmail({ email, name, url }: AuthEmailMessage): Promise<void> {
    await this.send({
      email,
      subject: "Restablece tu contraseña de Portal 360",
      text: `Hola ${name},\n\nRestablece tu contraseña de Portal 360: ${url}\n\nSi no solicitaste este cambio, puedes ignorar este correo.`,
      type: "password reset",
      url,
    });
  }

  async sendVerificationEmail({ email, name, url }: AuthEmailMessage): Promise<void> {
    await this.send({
      email,
      subject: "Verifica tu correo de Portal 360",
      text: `Hola ${name},\n\nVerifica tu correo para acceder a Portal 360: ${url}`,
      type: "email verification",
      url,
    });
  }

  private async send({ email, subject, text, type, url }: OutgoingAuthEmail): Promise<void> {
    if (!this.transporter) {
      if (!this.environment.isProduction) {
        this.logger.log(`Development ${type} link for ${email}: ${url}`);
        return;
      }

      throw new EmailDeliveryUnavailableError();
    }

    try {
      await this.transporter.sendMail({
        from: this.environment.smtp?.from,
        subject,
        text,
        to: email,
      });
    } catch {
      this.logger.error(`Unable to deliver ${type} email.`);
      throw new EmailDeliveryUnavailableError();
    }
  }
}

function createSmtpTransport(environment: AppEnvironment): Transporter | undefined {
  if (!environment.smtp) {
    return undefined;
  }

  return createTransport({
    auth: {
      pass: environment.smtp.password,
      user: environment.smtp.user,
    },
    host: environment.smtp.host,
    port: environment.smtp.port,
    secure: environment.smtp.secure,
  });
}
