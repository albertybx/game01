// 營業狀態機（GDD §2）：REST → PREPARING → OPEN → CLOSING → SETTLEMENT → CLEANUP → REST
// 全部是純函式：輸入舊狀態＋現在時間，回傳新狀態。不看動畫有沒有播完，只看時間戳記（GDD v0.5）。
// 狀態只含數字與字串，可以直接存檔（第 3 步）。

import { SCHEDULE_CONFIG, type ClockTime } from './config';
import { dayTypeAt, nextOccurrence, type DayType } from './timeRules';

export type Phase = 'REST' | 'PREPARING' | 'OPEN' | 'CLOSING' | 'SETTLEMENT' | 'CLEANUP';
export type CloseReason = 'manual' | 'reservation' | 'safetyNet';

export interface SettlementResult {
  openedAt: number;
  closingStartedAt: number;
  lastCustomerLeftAt: number;
  closeReason: CloseReason;
  /** 平日／假日，以進入 CLOSING 那一刻判斷（GDD v0.5）。 */
  closingDayType: DayType;
  /** 營業時數＝確認開店到進入 CLOSING（GDD v0.5）。 */
  businessMinutes: number;
  /** 營業額。TODO: 顧客與商品在 M2 加入，目前一律 0。 */
  revenue: number;
}

export interface Session {
  timeZone: string;
  /** 確認開店那一刻。 */
  openedAt: number;
  preparingEndsAt: number;
  /** 預約關店時刻；沒勾選為 null。 */
  reservationAt: number | null;
  /** 未關店安全網時刻；有預約時為 null。 */
  safetyNetAt: number | null;
  /** 進入 CLOSING（停止進客）時間。 */
  closingStartedAt: number | null;
  closeReason: CloseReason | null;
  /** 最後一位顧客離開時間。 */
  lastCustomerLeftAt: number | null;
  /** 結算結果；算過一次就不再算（冪等）。 */
  settlement: SettlementResult | null;
}

export interface ShopState {
  phase: Phase;
  session: Session | null;
  /**
   * 營業中看過的最晚時間；手機時鐘調回去時不倒退（GDD v0.6）。
   * 休店時（沒有營業）一律換成手機當下的時間，不受「不倒退」限制（GDD v0.7）。
   */
  lastSeenAt: number;
  /** 上一場營業的結算，回到 REST 後保留給報表看。 */
  lastReport: SettlementResult | null;
}

export function createInitialState(nowMs: number): ShopState {
  return { phase: 'REST', session: null, lastSeenAt: nowMs, lastReport: null };
}

/** 只有休店時能經營（GDD §2）。 */
export function canManage(state: ShopState): boolean {
  return state.phase === 'REST';
}

function clampNow(state: ShopState, nowMs: number): number {
  return Math.max(nowMs, state.lastSeenAt);
}

function enterClosing(state: ShopState, at: number, reason: CloseReason): ShopState {
  const session = state.session!;
  return { ...state, phase: 'CLOSING', session: { ...session, closingStartedAt: at, closeReason: reason } };
}

function settle(state: ShopState): ShopState {
  const s = state.session!;
  const closingStartedAt = s.closingStartedAt!;
  // TODO: M2 顧客模擬。目前店裡沒有顧客，進入 CLOSING 就立刻結算（GDD v0.6）。
  const lastCustomerLeftAt = closingStartedAt;
  const settlement: SettlementResult = {
    openedAt: s.openedAt,
    closingStartedAt,
    lastCustomerLeftAt,
    closeReason: s.closeReason!,
    closingDayType: dayTypeAt(closingStartedAt, s.timeZone),
    businessMinutes: Math.floor((closingStartedAt - s.openedAt) / 60_000),
    revenue: 0,
  };
  return { ...state, phase: 'SETTLEMENT', session: { ...s, lastCustomerLeftAt, settlement } };
}

/**
 * 依現在時間把狀態往前推。頁面重開、離線很久都只要呼叫這個；重複呼叫結果相同，不會重複結算。
 */
export function advance(state: ShopState, nowMs: number): ShopState {
  // 休店時沒有要保護的營業，直接用手機當下的時間；
  // 否則時鐘曾被調快又調回，會一直沿用未來時間開店而卡住（GDD v0.7）。
  if (!state.session) return { ...state, lastSeenAt: nowMs };

  const now = clampNow(state, nowMs);
  let s: ShopState = { ...state, lastSeenAt: now };
  const session = state.session;

  if (s.phase === 'PREPARING' && now >= session.preparingEndsAt) {
    s = { ...s, phase: 'OPEN' };
  }

  if (s.phase === 'OPEN') {
    const autoAt = session.reservationAt ?? session.safetyNetAt;
    if (autoAt !== null && now >= autoAt) {
      // 預約落在準備動畫期間：動畫一結束就準備關店（GDD v0.6）
      const at = Math.max(autoAt, session.preparingEndsAt);
      s = enterClosing(s, at, session.reservationAt !== null ? 'reservation' : 'safetyNet');
    }
  }

  if (s.phase === 'CLOSING') {
    s = settle(s);
  }

  return s;
}

export interface OpenRequest {
  nowMs: number;
  timeZone: string;
  reservation: { enabled: boolean; time: ClockTime };
  /** 確認視窗上顯示的預約時刻（沒勾選可省略）。 */
  shownReservationAt?: number | null;
}

export type OpenResult =
  | { ok: true; state: ShopState }
  | { ok: false; reason: 'notRest'; state: ShopState }
  | { ok: false; reason: 'needReconfirm'; reservationAt: number; state: ShopState };

/**
 * 玩家在確認視窗按下「確認」。取消時不要呼叫這個，狀態就完全不變。
 * 確認當下重算預約；和視窗顯示的不同，就要求再確認，維持 REST（GDD v0.5）。
 */
export function confirmOpen(state: ShopState, req: OpenRequest): OpenResult {
  const s = advance(state, req.nowMs);
  if (s.phase !== 'REST') return { ok: false, reason: 'notRest', state: s };
  const now = s.lastSeenAt;

  let reservationAt: number | null = null;
  if (req.reservation.enabled) {
    reservationAt = nextOccurrence(now, req.reservation.time, req.timeZone);
    if (reservationAt !== req.shownReservationAt) {
      return { ok: false, reason: 'needReconfirm', reservationAt, state: s };
    }
  }

  const session: Session = {
    timeZone: req.timeZone,
    openedAt: now,
    preparingEndsAt: now + SCHEDULE_CONFIG.preparingMs,
    reservationAt,
    safetyNetAt: reservationAt === null ? now + SCHEDULE_CONFIG.safetyNetMs : null,
    closingStartedAt: null,
    closeReason: null,
    lastCustomerLeftAt: null,
    settlement: null,
  };
  return { ok: true, state: { ...s, phase: 'PREPARING', session } };
}

export type CloseResult = { ok: true; state: ShopState } | { ok: false; reason: 'notOpen'; state: ShopState };

/** 玩家按「準備關店」。只有 OPEN 可以按（PREPARING 不行，GDD v0.6）。 */
export function requestClose(state: ShopState, nowMs: number): CloseResult {
  const s = advance(state, nowMs);
  if (s.phase !== 'OPEN') return { ok: false, reason: 'notOpen', state: s };
  return { ok: true, state: advance(enterClosing(s, s.lastSeenAt, 'manual'), s.lastSeenAt) };
}

/** 結算演出播完或按跳過（GDD v0.6：不靠經過時間推進）。 */
export function finishSettlementShow(state: ShopState): ShopState {
  return state.phase === 'SETTLEMENT' ? { ...state, phase: 'CLEANUP' } : state;
}

/** 善後演出播完或按跳過，回到休店。 */
export function finishCleanupShow(state: ShopState): ShopState {
  if (state.phase !== 'CLEANUP') return state;
  return { ...state, phase: 'REST', session: null, lastReport: state.session?.settlement ?? null };
}
