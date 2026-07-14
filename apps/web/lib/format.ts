export function minorToMajor(minor: number): number {
  return minor / 100;
}

/** Format a minor-unit price in its currency. Defaults to the Polish locale. */
export function formatMoney(minor: number, currency: string, locale = "pl-PL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minorToMajor(minor));
}

/** Format an ISO date string (YYYY-MM-DD or full ISO) for display. */
export function formatDate(iso: string, locale = "pl-PL"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
}
