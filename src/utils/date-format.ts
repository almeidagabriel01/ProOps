const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

export type DateValue =
  | string
  | number
  | Date
  | TimestampLike
  | null
  | undefined;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const brazilDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function extractDateOnlyParts(value: string): DateParts | null {
  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return {
      year: Number(brMatch[3]),
      month: Number(brMatch[2]),
      day: Number(brMatch[1]),
    };
  }

  return null;
}

function dateFromParts(parts: DateParts): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0),
  );
}

function formatToBrazilDateParts(date: Date): DateParts | null {
  const partsMap = new Map(
    brazilDatePartsFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  const year = Number(partsMap.get("year"));
  const month = Number(partsMap.get("month"));
  const day = Number(partsMap.get("day"));

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function compareDateParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function parseDateValue(value: DateValue): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyParts = extractDateOnlyParts(trimmed);
    if (dateOnlyParts) {
      return dateFromParts(dateOnlyParts);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const seconds = value._seconds ?? value.seconds;
    if (typeof seconds === "number") {
      const parsed = new Date(seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export function getBrazilDateParts(value: DateValue): DateParts | null {
  if (typeof value === "string") {
    const dateOnlyParts = extractDateOnlyParts(value);
    if (dateOnlyParts) {
      return dateOnlyParts;
    }
  }

  const parsed = parseDateValue(value);
  if (!parsed) return null;

  return formatToBrazilDateParts(parsed);
}

export function formatDateBR(value: DateValue, fallback = "-"): string {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return dateFormatter.format(parsed);
}

export function formatDateTimeBR(value: DateValue, fallback = "-"): string {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return dateTimeFormatter.format(parsed);
}

export function isDateBeforeTodayBR(value: DateValue): boolean {
  const dateParts = getBrazilDateParts(value);
  if (!dateParts) return false;

  const todayParts = formatToBrazilDateParts(new Date());
  if (!todayParts) return false;

  return compareDateParts(dateParts, todayParts) < 0;
}
