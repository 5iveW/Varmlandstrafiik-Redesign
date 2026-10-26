// Swedish local time as "YYYY-MM-DDTHH:mm", the format Trafiklab expects.
// Intl applies the CET/CEST switch, so this is right in winter and summer and
// does not depend on the server's own timezone (Vercel runs in UTC).
const format = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function stockholmTime(date: Date) {
  return format.format(date).replace(" ", "T");
}

// Swedish time `minutes` from now, rounded down to a 5-minute step so
// requests made close together share one cached response.
export function stockholmMinutesFromNow(minutes: number) {
  const step = 5 * 60000;
  return stockholmTime(new Date(Math.floor((Date.now() + minutes * 60000) / step) * step));
}
