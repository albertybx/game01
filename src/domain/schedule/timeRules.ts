// 時間規則（GDD §3）：預約時刻、平日／假日、推定關店當天、提醒。全部是純函式。

import { SCHEDULE_CONFIG, type ClockTime, type PlannedCloseTimes } from './config';
import { addCalendarDays, getZonedParts, zonedTimeToUtc } from './zonedTime';

const MINUTE = 60_000;

export type DayType = 'weekday' | 'weekend';

/**
 * 在 afterMs 之後「下一次出現」的 time。
 * 不含 afterMs 當下那一分鐘（GDD v0.6）：09:00:30 確認、預約 09:00 → 隔天 09:00。
 */
export function nextOccurrence(afterMs: number, time: ClockTime, timeZone: string): number {
  const currentMinute = Math.floor(afterMs / MINUTE) * MINUTE;
  const today = getZonedParts(afterMs, timeZone);
  for (let i = 0; i < 3; i++) {
    const d = addCalendarDays(today.year, today.month, today.day, i);
    const candidate = zonedTimeToUtc(d.year, d.month, d.day, time.hour, time.minute, timeZone);
    if (candidate > currentMinute) return candidate;
  }
  throw new Error('nextOccurrence：找不到下一次出現的時刻');
}

/** 週一至週五＝平日、週六日＝假日，不計國定假日（GDD v0.4）。 */
export function dayTypeAt(ms: number, timeZone: string): DayType {
  const w = getZonedParts(ms, timeZone).weekday;
  return w === 0 || w === 6 ? 'weekend' : 'weekday';
}

/** 休店時推定的「關店當天」：現在之後最近一次 09:00 所在那天（GDD v0.5）。 */
export function inferClosingDayType(nowMs: number, timeZone: string): DayType {
  return dayTypeAt(nextOccurrence(nowMs, SCHEDULE_CONFIG.inferAnchor, timeZone), timeZone);
}

/** 預約關店的預設值：平日＝平日預計關店時間＋勾選；假日＝假日預計關店時間＋不勾（GDD §3）。 */
export function defaultReservation(
  nowMs: number,
  timeZone: string,
  planned: PlannedCloseTimes,
): { time: ClockTime; enabled: boolean; dayType: DayType } {
  const dayType = inferClosingDayType(nowMs, timeZone);
  return dayType === 'weekday'
    ? { time: { ...planned.weekday }, enabled: true, dayType }
    : { time: { ...planned.weekend }, enabled: false, dayType };
}

export type ReservationWarning = 'tooSoon' | 'tooLate' | null;

/** 不足 1 小時或超過 16 小時要提醒（GDD §3、v0.5）。 */
export function reservationWarning(openAtMs: number, reservationAtMs: number): ReservationWarning {
  const gap = reservationAtMs - openAtMs;
  if (gap < SCHEDULE_CONFIG.warnTooSoonMs) return 'tooSoon';
  if (gap > SCHEDULE_CONFIG.warnTooLateMs) return 'tooLate';
  return null;
}

/** 摘要文字，例如「將於 09:00 自動準備關店（約 8 小時 30 分後）」。 */
export function formatReservationSummary(nowMs: number, reservationAtMs: number, timeZone: string): string {
  const p = getZonedParts(reservationAtMs, timeZone);
  const hhmm = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const totalMin = Math.max(0, Math.round((reservationAtMs - nowMs) / MINUTE));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const span = h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`;
  return `將於 ${hhmm} 自動準備關店（約 ${span}後）`;
}
