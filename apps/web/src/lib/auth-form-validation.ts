export const minimumPasswordLength = 8;
export const maximumPasswordLength = 128;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return "Escribe tu correo electrónico.";
  }

  return emailPattern.test(email.trim()) ? undefined : "Escribe un correo electrónico válido.";
}

export function validateName(name: string): string | undefined {
  return name.trim() ? undefined : "Escribe tu nombre.";
}

export function validatePassword(password: string): string | undefined {
  if (password.length < minimumPasswordLength) {
    return `La contraseña debe tener al menos ${minimumPasswordLength} caracteres.`;
  }

  if (password.length > maximumPasswordLength) {
    return `La contraseña no puede superar ${maximumPasswordLength} caracteres.`;
  }

  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  passwordConfirmation: string,
): string | undefined {
  return password === passwordConfirmation ? undefined : "Las contraseñas deben coincidir.";
}
