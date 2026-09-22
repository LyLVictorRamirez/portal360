import type { TicketExternalPriority } from "../../../lib/tickets-client";

type TicketFormValues = Readonly<{
  clientId: string | null;
  description: string;
  externalPriority: TicketExternalPriority;
  externalReference: string;
  externalUrl: string;
  title: string;
}>;

type ValidatedTicketForm = Readonly<{
  clientId: string | null;
  description: string | null;
  externalPriority: TicketExternalPriority;
  externalReference: string;
  externalUrl: string | null;
  title: string;
}>;

export function validateTicketForm(
  values: TicketFormValues,
  requireClient: boolean,
): { kind: "valid"; values: ValidatedTicketForm } | { kind: "error"; message: string } {
  const externalReference = values.externalReference.trim();
  const title = values.title.trim();
  const description = values.description.trim() || null;
  const externalUrl = values.externalUrl.trim() || null;

  if (!externalReference || externalReference.length > 200) {
    return {
      kind: "error",
      message: "La referencia externa es obligatoria y debe tener máximo 200 caracteres.",
    };
  }

  if (!title || title.length > 200) {
    return {
      kind: "error",
      message: "El título es obligatorio y debe tener máximo 200 caracteres.",
    };
  }

  if (description && description.length > 2000) {
    return { kind: "error", message: "La descripción debe tener máximo 2.000 caracteres." };
  }

  if (externalUrl && (externalUrl.length > 2048 || !isHttpUrl(externalUrl))) {
    return { kind: "error", message: "La URL externa debe ser una URL HTTP o HTTPS válida." };
  }

  if (requireClient && !values.clientId) {
    return { kind: "error", message: "Selecciona un Cliente activo para el Ticket." };
  }

  return {
    kind: "valid",
    values: {
      clientId: values.clientId,
      description,
      externalPriority: values.externalPriority,
      externalReference,
      externalUrl,
      title,
    },
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
