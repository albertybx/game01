import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANNED_CLOSE,
  createReservationForm,
  editReservationEnabled,
  editReservationTime,
  previewReservation,
  refreshReservationForm,
} from '../../src/domain/schedule';

const TZ = 'Asia/Taipei';
const tp = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);

describe('預約關店欄位', () => {
  it('週五 08:50 開著休店畫面放到 09:05：沒動過的欄位換成假日預設（GDD v0.6）', () => {
    const form = createReservationForm(tp(2026, 11, 13, 8, 50), TZ, DEFAULT_PLANNED_CLOSE);
    expect(form.time).toEqual({ hour: 9, minute: 0 });
    expect(form.enabled).toBe(true);
    const later = refreshReservationForm(form, tp(2026, 11, 13, 9, 5), TZ, DEFAULT_PLANNED_CLOSE);
    expect(later.time).toEqual({ hour: 11, minute: 0 });
    expect(later.enabled).toBe(false);
  });

  it('玩家動過的欄位保留', () => {
    let form = createReservationForm(tp(2026, 11, 13, 8, 50), TZ, DEFAULT_PLANNED_CLOSE);
    form = editReservationTime(form, { hour: 8, minute: 15 });
    const later = refreshReservationForm(form, tp(2026, 11, 13, 9, 5), TZ, DEFAULT_PLANNED_CLOSE);
    expect(later.time).toEqual({ hour: 8, minute: 15 });
    expect(later.enabled).toBe(false); // 勾選框沒動過，照樣換成假日預設

    const kept = refreshReservationForm(editReservationEnabled(form, true), tp(2026, 11, 13, 9, 5), TZ, DEFAULT_PLANNED_CLOSE);
    expect(kept.enabled).toBe(true);
  });

  it('預覽：沒勾選回傳 null；有勾選顯示時刻、提醒與摘要', () => {
    const now = tp(2026, 11, 13, 0, 30);
    const form = createReservationForm(now, TZ, DEFAULT_PLANNED_CLOSE);
    expect(previewReservation(editReservationEnabled(form, false), now, TZ)).toBeNull();
    const p = previewReservation(form, now, TZ)!;
    expect(p.reservationAt).toBe(tp(2026, 11, 13, 9, 0));
    expect(p.warning).toBeNull();
    expect(p.summary).toBe('將於 09:00 自動準備關店（約 8 小時 30 分後）');
  });
});
