const LOCALE = 'pt-BR';

export interface FormatOptions {
  /** Fuso horário IANA; padrão: o do sistema. */
  timeZone?: string | undefined;
}

export function formatDate(iso: string, { timeZone }: FormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string, { timeZone }: FormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

const hoursFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export function formatHours(hours: number): string {
  return `${hoursFormat.format(hours)} h`;
}

const regionNames = new Intl.DisplayNames([LOCALE], { type: 'region' });

export function countryName(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Remove caracteres de controle de textos vindos de terceiros (ex.: nome do perfil),
 * evitando que sequências ANSI alterem o terminal do usuário.
 */
export function safeText(text: string): string {
  return text.replace(/\p{Cc}/gu, '');
}
