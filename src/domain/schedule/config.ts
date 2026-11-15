// 營業時間規則的暫定數值（GDD §2、§3）。改數值只改這裡。

export interface ClockTime {
  hour: number; // 0–23（24 小時制）
  minute: number; // 0–59
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const SCHEDULE_CONFIG = {
  /** 開店準備動畫長度。TODO: UX */
  preparingMs: 10_000,
  /** 未關店安全網：沒勾預約也沒關店，確認開店後多久自動準備關店（GDD v0.5）。TODO: balance */
  safetyNetMs: 24 * HOUR,
  /** 預約時刻離開店不足這麼久就提醒（GDD §3）。 */
  warnTooSoonMs: 1 * HOUR,
  /** 預約時刻離開店超過這麼久就提醒（GDD v0.5）。TODO: UX */
  warnTooLateMs: 16 * HOUR,
  /** 休店時推定「關店當天」的基準時刻，固定 09:00，不隨預計關店時間變動（GDD v0.6）。 */
  inferAnchor: { hour: 9, minute: 0 } as ClockTime,
} as const;

/** 預計關店時間（玩家可調整，GDD §3）。 */
export interface PlannedCloseTimes {
  weekday: ClockTime;
  weekend: ClockTime;
}

export const DEFAULT_PLANNED_CLOSE: PlannedCloseTimes = {
  weekday: { hour: 9, minute: 0 },
  weekend: { hour: 11, minute: 0 },
};
