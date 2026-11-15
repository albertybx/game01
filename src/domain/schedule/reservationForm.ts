// 休店時的「預約關店」欄位（GDD §3，介面 TODO: UX）。
// 玩家沒動過的欄位跟著推定的關店當天更新；動過的保留（GDD v0.6）。

import type { ClockTime, PlannedCloseTimes } from './config';
import {
  defaultReservation,
  formatReservationSummary,
  nextOccurrence,
  reservationWarning,
  type ReservationWarning,
} from './timeRules';

export interface ReservationForm {
  time: ClockTime;
  enabled: boolean;
  timeEdited: boolean;
  enabledEdited: boolean;
}

/** 每次進入休店時建立，不記憶上一次的選擇。 */
export function createReservationForm(nowMs: number, timeZone: string, planned: PlannedCloseTimes): ReservationForm {
  const d = defaultReservation(nowMs, timeZone, planned);
  return { time: d.time, enabled: d.enabled, timeEdited: false, enabledEdited: false };
}

/** 休店畫面開著時定期呼叫，跨過 09:00 時更新沒動過的欄位。 */
export function refreshReservationForm(
  form: ReservationForm,
  nowMs: number,
  timeZone: string,
  planned: PlannedCloseTimes,
): ReservationForm {
  const d = defaultReservation(nowMs, timeZone, planned);
  return {
    ...form,
    time: form.timeEdited ? form.time : d.time,
    enabled: form.enabledEdited ? form.enabled : d.enabled,
  };
}

export function editReservationTime(form: ReservationForm, time: ClockTime): ReservationForm {
  return { ...form, time: { ...time }, timeEdited: true };
}

export function editReservationEnabled(form: ReservationForm, enabled: boolean): ReservationForm {
  return { ...form, enabled, enabledEdited: true };
}

export interface ReservationPreview {
  reservationAt: number;
  warning: ReservationWarning;
  summary: string;
}

/** 若現在按下確認，預約會落在哪個時刻；沒勾選回傳 null。 */
export function previewReservation(form: ReservationForm, nowMs: number, timeZone: string): ReservationPreview | null {
  if (!form.enabled) return null;
  const reservationAt = nextOccurrence(nowMs, form.time, timeZone);
  return {
    reservationAt,
    warning: reservationWarning(nowMs, reservationAt),
    summary: formatReservationSummary(nowMs, reservationAt, timeZone),
  };
}
