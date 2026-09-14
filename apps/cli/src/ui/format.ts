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

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/** Número com quantidade fixa de casas decimais, ex.: 1,20. */
export function formatDecimal(value: number, digits: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Recebe o valor já em porcentagem (81.3 → "81,3%"). */
export function formatPercent(value: number): string {
  return `${formatDecimal(value, 1)}%`;
}

/** "de_mirage" → "Mirage", "cs_office" → "Office". Nomes fora do padrão são exibidos como vieram. */
export function formatMapName(map: string): string {
  const clean = safeText(map);
  const match = /^(?:de|cs|ar|dz|gd)_(.+)$/.exec(clean);
  if (!match?.[1]) return clean;
  return match[1]
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
