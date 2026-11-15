import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANNED_CLOSE,
  dayTypeAt,
  defaultReservation,
  formatReservationSummary,
  getZonedParts,
  inferClosingDayType,
  nextOccurrence,
  reservationWarning,
  zonedTimeToUtc,
} from '../../src/domain/schedule';

const TZ = 'Asia/Taipei';
/** 台北時間 → 時間點（台北固定 +8，沒有夏令時間） */
const tp = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);
const NINE = { hour: 9, minute: 0 };

// 2026-11-13 是週五、11-14 週六、11-16 週一
describe('預約時刻：確認那一刻之後下一次出現', () => {
  it('深夜 00:00 選 09:00 → 當天 09:00（使用者舉的例子）', () => {
    expect(nextOccurrence(tp(2026, 11, 13, 0, 0), NINE, TZ)).toBe(tp(2026, 11, 13, 9, 0));
  });

  it('跨午夜：23:30 選 09:00 → 隔天 09:00', () => {
    expect(nextOccurrence(tp(2026, 11, 12, 23, 30), NINE, TZ)).toBe(tp(2026, 11, 13, 9, 0));
  });

  it('08:50 選 09:00、09:05 才確認 → 隔天 09:00（GDD v0.4）', () => {
    expect(nextOccurrence(tp(2026, 11, 13, 9, 5), NINE, TZ)).toBe(tp(2026, 11, 14, 9, 0));
  });

  it('剛好同一分鐘確認（09:00:30）→ 隔天，不會變成馬上關店（GDD v0.6）', () => {
    expect(nextOccurrence(tp(2026, 11, 13, 9, 0, 30), NINE, TZ)).toBe(tp(2026, 11, 14, 9, 0));
    expect(nextOccurrence(tp(2026, 11, 13, 9, 0, 0), NINE, TZ)).toBe(tp(2026, 11, 14, 9, 0));
  });

  it('08:59:59 確認 → 當天 09:00', () => {
    expect(nextOccurrence(tp(2026, 11, 13, 8, 59, 59), NINE, TZ)).toBe(tp(2026, 11, 13, 9, 0));
  });

  it('跨月、跨年也正確', () => {
    expect(nextOccurrence(tp(2026, 12, 31, 23, 0), NINE, TZ)).toBe(tp(2027, 1, 1, 9, 0));
  });
});

describe('平日／假日：以關店當天判斷，不計國定假日', () => {
  it('週一到週五是平日，週六日是假日', () => {
    expect(dayTypeAt(tp(2026, 11, 13, 9, 0), TZ)).toBe('weekday'); // 週五
    expect(dayTypeAt(tp(2026, 11, 14, 9, 0), TZ)).toBe('weekend'); // 週六
    expect(dayTypeAt(tp(2026, 11, 15, 9, 0), TZ)).toBe('weekend'); // 週日
    expect(dayTypeAt(tp(2026, 11, 16, 9, 0), TZ)).toBe('weekday'); // 週一
  });

  it('同一時刻在不同時區可能是不同天', () => {
    const t = tp(2026, 11, 14, 2, 0); // 台北週六 02:00 ＝ 紐約週五下午
    expect(dayTypeAt(t, TZ)).toBe('weekend');
    expect(dayTypeAt(t, 'America/New_York')).toBe('weekday');
  });
});

describe('休店時推定關店當天（最近一次 09:00 所在那天）', () => {
  it('週五 23:30 → 週六 → 假日：預設 11:00、不勾（GDD v0.5 例子）', () => {
    const now = tp(2026, 11, 13, 23, 30);
    expect(inferClosingDayType(now, TZ)).toBe('weekend');
    expect(defaultReservation(now, TZ, DEFAULT_PLANNED_CLOSE)).toEqual({
      time: { hour: 11, minute: 0 },
      enabled: false,
      dayType: 'weekend',
    });
  });

  it('週日 22:00 → 週一 → 平日：預設 09:00、勾選', () => {
    expect(defaultReservation(tp(2026, 11, 15, 22, 0), TZ, DEFAULT_PLANNED_CLOSE)).toEqual({
      time: { hour: 9, minute: 0 },
      enabled: true,
      dayType: 'weekday',
    });
  });

  it('推定基準固定 09:00，不隨玩家改的平日關店時間變動（GDD v0.6）', () => {
    const planned = { weekday: { hour: 7, minute: 0 }, weekend: { hour: 11, minute: 0 } };
    // 週五 08:00：基準 09:00 還沒過 → 推定週五（平日）
    const d = defaultReservation(tp(2026, 11, 13, 8, 0), TZ, planned);
    expect(d.dayType).toBe('weekday');
    expect(d.time).toEqual({ hour: 7, minute: 0 });
  });
});

describe('預約提醒與摘要', () => {
  const open = tp(2026, 11, 13, 0, 30);
  it('不足 1 小時、超過 16 小時要提醒', () => {
    expect(reservationWarning(open, open + 59 * 60_000)).toBe('tooSoon');
    expect(reservationWarning(open, open + 60 * 60_000)).toBeNull();
    expect(reservationWarning(open, open + 16 * 3_600_000)).toBeNull();
    expect(reservationWarning(open, open + 16 * 3_600_000 + 60_000)).toBe('tooLate');
  });

  it('摘要文字', () => {
    expect(formatReservationSummary(open, tp(2026, 11, 13, 9, 0), TZ)).toBe('將於 09:00 自動準備關店（約 8 小時 30 分後）');
    expect(formatReservationSummary(open, open + 20 * 60_000, TZ)).toBe('將於 00:50 自動準備關店（約 20 分後）');
  });
});

describe('夏令時間（暫定規則，GDD v0.6）', () => {
  const NY = 'America/New_York';
  it('時刻不存在（2026-03-08 02:30 被跳過）→ 跳過後第一個有效時刻 03:00', () => {
    const t = zonedTimeToUtc(2026, 3, 8, 2, 30, NY);
    const p = getZonedParts(t, NY);
    expect([p.day, p.hour, p.minute]).toEqual([8, 3, 0]);
  });

  it('時刻出現兩次（2026-11-01 01:30）→ 取較早那次', () => {
    const t = zonedTimeToUtc(2026, 11, 1, 1, 30, NY);
    expect(t).toBe(Date.UTC(2026, 10, 1, 5, 30)); // 夏令時間 -4 的那次
  });

  it('一般時刻照常換算', () => {
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0, NY)).toBe(Date.UTC(2026, 6, 1, 13, 0));
  });
});
