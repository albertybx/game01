// 指定時區的「牆上時間」換算。只用瀏覽器內建的 Intl，App 版也能用（GDD §8）。

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0＝週日 … 6＝週六
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** 某個時間點，在指定時區看到的年月日時分秒與星期。 */
export function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(ms)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

/** 該時間點的時區偏移（毫秒，例如台北 +8 小時）。 */
function offsetAt(ms: number, timeZone: string): number {
  const p = getZonedParts(ms, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** 日曆往後加幾天（不受時區影響）。 */
export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * 指定時區的某日某時某分，換成實際時間點。
 * 夏令時間（GDD v0.6 暫定）：時刻出現兩次取較早那次；時刻不存在取跳過後第一個有效時刻。
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = [...new Set([offsetAt(wall - DAY, timeZone), offsetAt(wall, timeZone), offsetAt(wall + DAY, timeZone)])];

  const matches = offsets
    .map((o) => wall - o)
    .filter((ms) => {
      const p = getZonedParts(ms, timeZone);
      return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
    })
    .sort((a, b) => a - b);
  if (matches.length > 0) return matches[0];

  // 時刻不存在（撥快一小時那段）：找出切換的那一刻
  const later = Math.max(...offsets);
  let lo = wall - later;
  let hi = wall - Math.min(...offsets);
  while (hi - lo > MINUTE) {
    const mid = Math.floor((lo + hi) / 2 / MINUTE) * MINUTE;
    if (mid <= lo) break;
    if (offsetAt(mid, timeZone) === later) hi = mid;
    else lo = mid;
  }
  return hi;
}
