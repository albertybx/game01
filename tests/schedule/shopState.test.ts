import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_CONFIG,
  advance,
  canManage,
  confirmOpen,
  createInitialState,
  finishCleanupShow,
  finishSettlementShow,
  nextOccurrence,
  requestClose,
  type ShopState,
} from '../../src/domain/schedule';

const TZ = 'Asia/Taipei';
const tp = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);
const NINE = { hour: 9, minute: 0 };
const HOUR = 3_600_000;

function open(state: ShopState, nowMs: number, enabled: boolean, time = NINE): ShopState {
  const shown = enabled ? nextOccurrence(nowMs, time, TZ) : null;
  const r = confirmOpen(state, { nowMs, timeZone: TZ, reservation: { enabled, time }, shownReservationAt: shown });
  if (!r.ok) throw new Error(`開店失敗：${r.reason}`);
  return r.state;
}

describe('開店', () => {
  it('不開店就一直是休店、可以經營，不會自動開店', () => {
    const s = advance(createInitialState(tp(2026, 11, 12, 20, 0)), tp(2026, 11, 14, 20, 0));
    expect(s.phase).toBe('REST');
    expect(canManage(s)).toBe(true);
    expect(s.session).toBeNull();
  });

  it('確認後進入準備、鎖定經營，存下開店時間與準備結束時間', () => {
    const t = tp(2026, 11, 12, 23, 30);
    const s = open(createInitialState(t), t, true);
    expect(s.phase).toBe('PREPARING');
    expect(canManage(s)).toBe(false);
    expect(s.session!.openedAt).toBe(t);
    expect(s.session!.preparingEndsAt).toBe(t + SCHEDULE_CONFIG.preparingMs);
    expect(s.session!.reservationAt).toBe(tp(2026, 11, 13, 9, 0));
    expect(s.session!.safetyNetAt).toBeNull();
  });

  it('確認時預約日期變了（08:58 顯示今天 09:00，09:01 才按）→ 要求再確認，維持休店', () => {
    const shown = nextOccurrence(tp(2026, 11, 13, 8, 58), NINE, TZ);
    const r = confirmOpen(createInitialState(tp(2026, 11, 13, 8, 0)), {
      nowMs: tp(2026, 11, 13, 9, 1),
      timeZone: TZ,
      reservation: { enabled: true, time: NINE },
      shownReservationAt: shown,
    });
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== 'needReconfirm') throw new Error('應要求再確認');
    expect(r.reservationAt).toBe(tp(2026, 11, 14, 9, 0));
    expect(r.state.phase).toBe('REST');
    expect(r.state.session).toBeNull();
  });

  it('營業中不能再開店', () => {
    const t = tp(2026, 11, 12, 23, 30);
    const s = open(createInitialState(t), t, false);
    const r = confirmOpen(s, { nowMs: t + HOUR, timeZone: TZ, reservation: { enabled: false, time: NINE } });
    expect(r.ok).toBe(false);
  });
});

describe('準備動畫與重新整理', () => {
  const t = tp(2026, 11, 12, 23, 30);
  const prepared = () => open(createInitialState(t), t, false);

  it('準備結束時間一到就營業，不看動畫有沒有播完；重複推算結果一樣', () => {
    const s = prepared();
    expect(advance(s, t + SCHEDULE_CONFIG.preparingMs - 1).phase).toBe('PREPARING');
    const a = advance(s, t + SCHEDULE_CONFIG.preparingMs);
    expect(a.phase).toBe('OPEN');
    expect(advance(a, t + SCHEDULE_CONFIG.preparingMs)).toEqual(a);
    expect(a.session!.preparingEndsAt).toBe(s.session!.preparingEndsAt); // 不延後
  });

  it('準備動畫中不能按準備關店', () => {
    const r = requestClose(prepared(), t + 1000);
    expect(r.ok).toBe(false);
    expect(r.state.phase).toBe('PREPARING');
  });

  it('預約落在準備動畫期間 → 動畫一結束就準備關店並結算一次', () => {
    const now = tp(2026, 11, 13, 8, 59, 55);
    const s = open(createInitialState(now), now, true); // 預約 09:00，只差 5 秒
    expect(s.session!.reservationAt).toBe(tp(2026, 11, 13, 9, 0));
    const after = advance(s, now + 60_000);
    expect(after.phase).toBe('SETTLEMENT');
    expect(after.session!.closingStartedAt).toBe(s.session!.preparingEndsAt);
    expect(after.session!.settlement!.closeReason).toBe('reservation');
  });
});

describe('關店與結算', () => {
  const t = tp(2026, 11, 12, 23, 30); // 週四晚上

  it('手動準備關店：營業中可以提前按；空店立刻結算，兩個關店時間一樣', () => {
    const s = advance(open(createInitialState(t), t, true), t + HOUR);
    const r = requestClose(s, tp(2026, 11, 13, 7, 0));
    expect(r.ok).toBe(true);
    const sess = r.state.session!;
    expect(r.state.phase).toBe('SETTLEMENT');
    expect(sess.closingStartedAt).toBe(tp(2026, 11, 13, 7, 0));
    expect(sess.lastCustomerLeftAt).toBe(sess.closingStartedAt);
    expect(sess.settlement!.closeReason).toBe('manual');
    expect(sess.settlement!.businessMinutes).toBe(7 * 60 + 30);
  });

  it('有預約：到時只進入準備關店一次，時間記為預約時刻（頁面沒開著也一樣）', () => {
    const s = open(createInitialState(t), t, true);
    const later = advance(s, tp(2026, 11, 13, 15, 0)); // 中午才打開頁面
    expect(later.phase).toBe('SETTLEMENT');
    expect(later.session!.closingStartedAt).toBe(tp(2026, 11, 13, 9, 0));
    expect(later.session!.settlement!.closingDayType).toBe('weekday');
    // 之後再推算多少次都不會重算
    const again = advance(advance(later, tp(2026, 11, 13, 16, 0)), tp(2026, 11, 14, 0, 0));
    expect(again.session!.settlement).toEqual(later.session!.settlement);
  });

  it('沒勾預約：到了 09:00 不會自動關店', () => {
    const s = open(createInitialState(t), t, false);
    expect(advance(s, tp(2026, 11, 13, 12, 0)).phase).toBe('OPEN');
  });

  it('沒勾預約也沒關店：滿 24 小時才進入準備關店（安全網）', () => {
    const s = open(createInitialState(t), t, false);
    expect(advance(s, t + 24 * HOUR - 1).phase).toBe('OPEN');
    const net = advance(s, t + 30 * HOUR);
    expect(net.session!.closingStartedAt).toBe(t + 24 * HOUR);
    expect(net.session!.settlement!.closeReason).toBe('safetyNet');
  });

  it('週五晚開、週六早關算假日', () => {
    const fri = tp(2026, 11, 13, 23, 30);
    const s = open(createInitialState(fri), fri, true, { hour: 11, minute: 0 });
    const done = advance(s, tp(2026, 11, 14, 12, 0));
    expect(done.session!.settlement!.closingDayType).toBe('weekend');
  });

  it('演出播完（或跳過）才回到休店；重複按不會重算', () => {
    const s = advance(open(createInitialState(t), t, true), tp(2026, 11, 13, 10, 0));
    expect(advance(s, tp(2026, 11, 20, 0, 0)).phase).toBe('SETTLEMENT'); // 不靠時間經過推進
    const cleanup = finishSettlementShow(s);
    expect(cleanup.phase).toBe('CLEANUP');
    expect(canManage(cleanup)).toBe(false);
    const rest = finishCleanupShow(cleanup);
    expect(rest.phase).toBe('REST');
    expect(canManage(rest)).toBe(true);
    expect(rest.lastReport).toEqual(s.session!.settlement);
    expect(finishCleanupShow(rest)).toEqual(rest);
    expect(finishSettlementShow(rest)).toEqual(rest);
  });
});

describe('手機時鐘被調回去（GDD v0.6 暫定）', () => {
  it('狀態不倒退、不解鎖', () => {
    const t = tp(2026, 11, 12, 23, 30);
    const s = advance(open(createInitialState(t), t, true), t + HOUR);
    const back = advance(s, t - 10 * HOUR);
    expect(back.phase).toBe('OPEN');
    expect(back.lastSeenAt).toBe(t + HOUR);
    expect(canManage(back)).toBe(false);
  });

  it('時鐘倒退後再往前走，仍照原本的預約時刻關店', () => {
    const t = tp(2026, 11, 12, 23, 30);
    const s = advance(advance(open(createInitialState(t), t, true), t - HOUR), tp(2026, 11, 13, 9, 30));
    expect(s.session!.closingStartedAt).toBe(tp(2026, 11, 13, 9, 0));
  });
});
