// API times are Swedish local time without an offset. new Date() reads them in the
// phone's own timezone, which is right as long as the phone is set to Swedish time.

export function minutesUntil(time: string, now: number) {
  return Math.floor((new Date(time).getTime() - now) / 60000);
}

// A departure counts as gone half a minute after its expected time.
export function hasLeft(time: string, now: number) {
  return new Date(time).getTime() < now - 30000;
}

export function clock(time: string) {
  return time.slice(11, 16);
}

export function minutesBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

// The current time as a value for <input type="datetime-local">.
export function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}

// "Hagatorget, Karlstad" and "Karlstad Stora torget" become "Hagatorget" and
// "Stora torget", which is enough inside the app's home town.
export function shortName(name: string) {
  return name.replace(/, Karlstad$/, "").replace(/^Karlstad (?=\S)/, "");
}

export function distance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
