export function tz(): string {
  return process.env.APP_TIMEZONE || "UTC";
}

/** Today's date (YYYY-MM-DD) in the configured time zone. */
export function todayISO(now = new Date(), zone = tz()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("es-ES", { timeZone: tz(), year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMoney(cents: number, currency = process.env.CURRENCY || "USD"): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

/** "1,234.50" / "1234,5" / "$1.2k"-free: parse a user-typed money string into cents. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const decimalSep = (sep: string, other: string) => {
    const i = s.lastIndexOf(sep);
    if (i < 0) return false;
    if (s.includes(other) && s.lastIndexOf(other) > i) return false; // other one comes last => it is the decimal
    const digitsAfter = s.length - i - 1;
    // a lone "12,500" / "1.234" is a thousands group, not a decimal
    return !(s.split(sep).length === 2 && digitsAfter === 3 && !s.includes(other));
  };
  let normalized: string;
  if (decimalSep(",", ".")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (decimalSep(".", ",")) normalized = s.replace(/,/g, "");
  else normalized = s.replace(/[.,]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
