"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "../../lib/auth-client";
import {
  maximumPasswordLength,
  minimumPasswordLength,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "../../lib/auth-form-validation";
import { getBrowserCallbackUrl, getSafeReturnTo, withReturnTo } from "../../lib/auth-route";
import { Button } from "../ui/button";
import { TextField } from "../ui/text-field";
import { AuthPageShell } from "./auth-page-shell";

const linkClassName =
  "font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:text-primary-hover";
const entryInputClassName = "bg-muted/80 shadow-none";

type FieldErrors = Record<string, string | undefined>;

function getFormError(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 429
  ) {
    return "Has realizado varios intentos. Espera unos minutos antes de volver a intentarlo.";
  }

  return fallback;
}

function FormError({ message }: Readonly<{ message: string | null }>) {
  return message ? (
    <p
      className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm leading-5 text-danger"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

function FormNotice({ message }: Readonly<{ message: string | null }>) {
  return message ? (
    <p
      className="rounded-md border border-success bg-success-surface px-3 py-2 text-sm leading-5 text-success"
      role="status"
    >
      {message}
    </p>
  ) : null;
}

function useReturnTo() {
  return getSafeReturnTo(useSearchParams().get("returnTo"));
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: password ? undefined : "Escribe tu contraseña.",
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.signIn.email({
        callbackURL: returnTo,
        email: email.trim(),
        password,
      });

      if (result.error) {
        setFormError(
          getFormError(
            result.error,
            "No fue posible iniciar sesión. Revisa tus datos o verifica tu correo.",
          ),
        );
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch (error) {
      setFormError(getFormError(error, "No fue posible iniciar sesión. Inténtalo de nuevo."));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthPageShell
      description="Ingresa con tu correo y contraseña."
      footer={
        <p className="text-sm leading-6 text-muted-foreground">
          ¿Aún no tienes cuenta?{" "}
          <Link className={linkClassName} href={withReturnTo("/registro", returnTo)}>
            Crea tu cuenta
          </Link>
          .
        </p>
      }
      title="Inicia sesión"
      variant="entry"
    >
      <form aria-busy={isPending} className="space-y-5" onSubmit={handleSubmit}>
        {searchParams.get("restablecida") === "1" ? (
          <FormNotice message="Tu contraseña se actualizó. Ya puedes iniciar sesión." />
        ) : null}
        <FormError message={formError} />
        <TextField
          autoComplete="email"
          className={entryInputClassName}
          error={errors.email}
          label="Correo electrónico"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <TextField
          autoComplete="current-password"
          className={entryInputClassName}
          error={errors.password}
          label="Contraseña"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <div className="space-y-4">
          <Link
            className={`block text-sm ${linkClassName}`}
            href={withReturnTo("/recuperar-contrasena", returnTo)}
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Button className="w-full" disabled={isPending} size="lg" type="submit">
            {isPending ? "Ingresando…" : "Iniciar sesión"}
          </Button>
        </div>
      </form>
    </AuthPageShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const returnTo = useReturnTo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      name: validateName(name),
      password: validatePassword(password),
      passwordConfirmation: validatePasswordConfirmation(password, passwordConfirmation),
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.signUp.email({
        callbackURL: getBrowserCallbackUrl(
          withReturnTo("/verificar-correo?estado=verificado", returnTo),
        ),
        email: email.trim(),
        name: name.trim(),
        password,
      });

      if (result.error) {
        setFormError(
          getFormError(
            result.error,
            "No fue posible crear la cuenta. Revisa los datos e inténtalo de nuevo.",
          ),
        );
        return;
      }

      router.replace(withReturnTo("/verificar-correo", returnTo));
    } catch (error) {
      setFormError(getFormError(error, "No fue posible crear la cuenta. Inténtalo de nuevo."));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthPageShell
      description="Crea tu acceso. Te enviaremos un enlace para verificar tu correo."
      footer={
        <p className="text-sm leading-6 text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link className={linkClassName} href={withReturnTo("/login", returnTo)}>
            Inicia sesión
          </Link>
          .
        </p>
      }
      title="Crea tu cuenta"
      variant="entry"
    >
      <form aria-busy={isPending} className="space-y-4" onSubmit={handleSubmit}>
        <FormError message={formError} />
        <TextField
          autoComplete="name"
          className={entryInputClassName}
          error={errors.name}
          label="Nombre"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <TextField
          autoComplete="email"
          className={entryInputClassName}
          error={errors.email}
          label="Correo electrónico"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <TextField
          autoComplete="new-password"
          className={entryInputClassName}
          error={errors.password}
          helpText={`Entre ${minimumPasswordLength} y ${maximumPasswordLength} caracteres.`}
          helpTextDisplay="focus"
          label="Contraseña"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          className={entryInputClassName}
          error={errors.passwordConfirmation}
          label="Confirmar contraseña"
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          required
          type="password"
          value={passwordConfirmation}
        />
        <Button className="w-full" disabled={isPending} size="lg" type="submit">
          {isPending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthPageShell>
  );
}

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const loginHref = withReturnTo("/login", returnTo);
  const isVerified = searchParams.get("estado") === "verificado";
  const hasInvalidLink = Boolean(searchParams.get("error"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(null);
    setNotice(null);

    if (nextEmailError) {
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        callbackURL: getBrowserCallbackUrl(
          withReturnTo("/verificar-correo?estado=verificado", returnTo),
        ),
        email: email.trim(),
      });

      if (result.error) {
        setFormError(
          getFormError(result.error, "No fue posible enviar el enlace. Inténtalo más tarde."),
        );
        return;
      }

      setNotice("Si hay una cuenta pendiente, recibirás un nuevo enlace de verificación.");
    } catch (error) {
      setFormError(getFormError(error, "No fue posible enviar el enlace. Inténtalo más tarde."));
    } finally {
      setIsPending(false);
    }
  }

  if (isVerified) {
    return (
      <AuthPageShell
        description="Tu correo fue verificado correctamente."
        title="Correo verificado"
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Ya puedes ingresar a Portal 360 con tu cuenta.
        </p>
        <Link className="mt-6 inline-flex" href={loginHref}>
          <Button>Iniciar sesión</Button>
        </Link>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      description={
        hasInvalidLink
          ? "El enlace ya no es válido. Solicita uno nuevo para verificar tu correo."
          : "Revisa tu correo y abre el enlace de verificación para continuar."
      }
      title={hasInvalidLink ? "Solicita un nuevo enlace" : "Verifica tu correo"}
    >
      <form aria-busy={isPending} className="space-y-5" onSubmit={handleSubmit}>
        <FormNotice message={notice} />
        <FormError message={formError} />
        <TextField
          autoComplete="email"
          error={emailError}
          label="Correo electrónico"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? "Enviando enlace…" : "Reenviar enlace"}
        </Button>
      </form>
      <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
        ¿Ya verificaste tu correo?{" "}
        <Link className={linkClassName} href={loginHref}>
          Inicia sesión
        </Link>
        .
      </p>
    </AuthPageShell>
  );
}

export function PasswordRecoveryForm() {
  const returnTo = useReturnTo();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(null);
    setNotice(null);

    if (nextEmailError) {
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: getBrowserCallbackUrl(withReturnTo("/restablecer-contrasena", returnTo)),
      });

      if (result.error) {
        setFormError(
          getFormError(result.error, "No fue posible procesar la solicitud. Inténtalo más tarde."),
        );
        return;
      }

      setNotice(
        "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      );
    } catch (error) {
      setFormError(
        getFormError(error, "No fue posible procesar la solicitud. Inténtalo más tarde."),
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AuthPageShell
      description="Te enviaremos instrucciones si encontramos una cuenta asociada al correo."
      title="Recupera tu contraseña"
    >
      <form aria-busy={isPending} className="space-y-5" onSubmit={handleSubmit}>
        <FormNotice message={notice} />
        <FormError message={formError} />
        <TextField
          autoComplete="email"
          error={emailError}
          label="Correo electrónico"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? "Enviando instrucciones…" : "Enviar instrucciones"}
        </Button>
      </form>
      <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
        <Link className={linkClassName} href={withReturnTo("/login", returnTo)}>
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthPageShell>
  );
}

export function PasswordResetForm() {
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      password: validatePassword(password),
      passwordConfirmation: validatePasswordConfirmation(password, passwordConfirmation),
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: token ?? undefined,
      });

      if (result.error) {
        setFormError(
          getFormError(result.error, "Este enlace no es válido o ha vencido. Solicita uno nuevo."),
        );
        return;
      }

      setIsComplete(true);
    } catch (error) {
      setFormError(
        getFormError(error, "No fue posible restablecer la contraseña. Inténtalo de nuevo."),
      );
    } finally {
      setIsPending(false);
    }
  }

  if (isComplete) {
    return (
      <AuthPageShell
        description="Tu contraseña se actualizó y las sesiones anteriores se cerraron."
        title="Contraseña actualizada"
      >
        <Link className="inline-flex" href={withReturnTo("/login?restablecida=1", returnTo)}>
          <Button>Iniciar sesión</Button>
        </Link>
      </AuthPageShell>
    );
  }

  if (!token) {
    return (
      <AuthPageShell
        description="Solicita un nuevo enlace para elegir una contraseña."
        title="Enlace no válido"
      >
        <Link className="inline-flex" href={withReturnTo("/recuperar-contrasena", returnTo)}>
          <Button>Solicitar enlace</Button>
        </Link>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      description="Elige una contraseña nueva para volver a acceder."
      title="Restablece tu contraseña"
    >
      <form aria-busy={isPending} className="space-y-5" onSubmit={handleSubmit}>
        <FormError message={formError} />
        <TextField
          autoComplete="new-password"
          error={errors.password}
          helpText={`Entre ${minimumPasswordLength} y ${maximumPasswordLength} caracteres.`}
          label="Nueva contraseña"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          error={errors.passwordConfirmation}
          label="Confirmar contraseña"
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          required
          type="password"
          value={passwordConfirmation}
        />
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? "Actualizando contraseña…" : "Actualizar contraseña"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
