import { describe, expect, it } from 'vitest';

import {
  applyWatchProgressSnapshot,
  assignActiveRunStep,
  buildStepFailureResult,
  createActiveRunContext,
  createStepStartSnapshot,
  createRunStartSnapshot,
  getActiveRunTabId,
  getTodayKey,
  isRunStale,
  matchesActiveRunStep,
  resolveRunRequest,
  reduceRunState,
  shouldCloseStepTab,
  shouldFocusStepTab,
  shouldStartDailyRun,
  type DailyRunSnapshot
} from '../../src/background/orchestrator';

describe('shouldStartDailyRun', () => {
  it('does not start again when today already succeeded', () => {
    const today = new Date('2026-03-30T09:30:00+08:00');

    const result = shouldStartDailyRun({
      now: today,
      scheduleTime: '09:00',
      snapshot: {
        dailyRunDate: getTodayKey(today),
        dailyRunState: 'success'
      }
    });

    expect(result).toBe(false);
  });

  it('starts on scheduled trigger after 09:00 when today has not run', () => {
    const today = new Date('2026-03-30T09:30:00+08:00');

    const result = shouldStartDailyRun({
      now: today,
      scheduleTime: '09:00',
      snapshot: {
        dailyRunDate: '2026-03-29',
        dailyRunState: 'success'
      }
    });

    expect(result).toBe(true);
  });

  it('supports startup catch-up after the scheduled time', () => {
    const today = new Date('2026-03-30T10:15:00+08:00');

    const result = shouldStartDailyRun({
      now: today,
      scheduleTime: '09:00',
      snapshot: {
        dailyRunDate: undefined,
        dailyRunState: 'idle'
      }
    });

    expect(result).toBe(true);
  });

  it('does not start before the scheduled time on a fresh day', () => {
    const today = new Date('2026-03-30T08:30:00+08:00');

    const result = shouldStartDailyRun({
      now: today,
      scheduleTime: '09:00',
      snapshot: {
        dailyRunDate: undefined,
        dailyRunState: 'idle'
      }
    });

    expect(result).toBe(false);
  });
});

describe('resolveRunRequest', () => {
  it('blocks a manual run when today already succeeded', () => {
    const now = new Date('2026-03-30T09:30:00+08:00');

    expect(
      resolveRunRequest({
        now,
        scheduleTime: '09:00',
        trigger: 'manual',
        snapshot: {
          dailyRunDate: getTodayKey(now),
          dailyRunState: 'success'
        },
        automationEnabled: true,
        hasActiveRun: false,
        ignoreSchedule: true
      })
    ).toEqual({
      accepted: true,
      started: false,
      reason: 'already_completed_today',
      message: '今日已签到，无需重复执行'
    });
  });

  it('blocks a run when another run is already active', () => {
    expect(
      resolveRunRequest({
        now: new Date('2026-03-30T09:30:00+08:00'),
        scheduleTime: '09:00',
        trigger: 'manual',
        snapshot: {
          dailyRunDate: undefined,
          dailyRunState: 'idle'
        },
        automationEnabled: true,
        hasActiveRun: true,
        ignoreSchedule: true
      })
    ).toEqual({
      accepted: true,
      started: false,
      reason: 'active_run',
      message: '已有任务执行中'
    });
  });

  it('blocks a scheduled run before the configured time', () => {
    expect(
      resolveRunRequest({
        now: new Date('2026-03-30T08:30:00+08:00'),
        scheduleTime: '09:00',
        trigger: 'alarm',
        snapshot: {
          dailyRunDate: undefined,
          dailyRunState: 'idle'
        },
        automationEnabled: true,
        hasActiveRun: false,
        ignoreSchedule: false
      })
    ).toEqual({
      accepted: true,
      started: false,
      reason: 'before_schedule',
      message: '未到自动执行时间'
    });
  });

  it('starts a run when all conditions are met', () => {
    expect(
      resolveRunRequest({
        now: new Date('2026-03-30T09:30:00+08:00'),
        scheduleTime: '09:00',
        trigger: 'manual',
        snapshot: {
          dailyRunDate: undefined,
          dailyRunState: 'idle'
        },
        automationEnabled: true,
        hasActiveRun: false,
        ignoreSchedule: true
      })
    ).toEqual({
      accepted: true,
      started: true,
      message: '开始执行今日任务'
    });
  });

  it('blocks automatic runs when task automation is disabled', () => {
    expect(
      resolveRunRequest({
        now: new Date('2026-03-30T09:30:00+08:00'),
        scheduleTime: '09:00',
        trigger: 'startup',
        snapshot: {
          dailyRunDate: undefined,
          dailyRunState: 'idle'
        },
        automationEnabled: false,
        hasActiveRun: false
      })
    ).toEqual({
      accepted: true,
      started: false,
      reason: 'automation_disabled',
      message: '自动签到已关闭'
    });
  });

  it('still allows manual runs when task automation is disabled', () => {
    expect(
      resolveRunRequest({
        now: new Date('2026-03-30T09:30:00+08:00'),
        scheduleTime: '09:00',
        trigger: 'manual',
        snapshot: {
          dailyRunDate: undefined,
          dailyRunState: 'idle'
        },
        automationEnabled: false,
        hasActiveRun: false,
        ignoreSchedule: true
      })
    ).toEqual({
      accepted: true,
      started: true,
      message: '开始执行今日任务'
    });
  });
});

describe('reduceRunState', () => {
  const baseSnapshot: DailyRunSnapshot = {
    dailyRunDate: '2026-03-30',
    dailyRunState: 'idle'
  };

  it('moves from watching to claiming when video watch succeeds', () => {
    const next = reduceRunState(
      {
        ...baseSnapshot,
        dailyRunState: 'watching'
      },
      {
        type: 'VIDEO_WATCH_RESULT',
        ok: true,
        step: 'watch_video',
        message: 'watched for 60 seconds'
      }
    );

    expect(next.dailyRunState).toBe('claiming');
    expect(next.lastResult?.step).toBe('watch_video');
  });

  it('moves to success when claim succeeds', () => {
    const next = reduceRunState(
      {
        ...baseSnapshot,
        dailyRunState: 'claiming'
      },
      {
        type: 'VIP_CLAIM_RESULT',
        ok: true,
        step: 'claim_vip',
        message: 'claim completed'
      }
    );

    expect(next.dailyRunState).toBe('success');
    expect(next.lastResult?.step).toBe('claim_vip');
  });

  it('moves to needs_login when content script reports login missing', () => {
    const next = reduceRunState(baseSnapshot, {
      type: 'VIDEO_WATCH_RESULT',
      ok: false,
      needsLogin: true,
      step: 'watch_video',
      message: 'login required'
    });

    expect(next.dailyRunState).toBe('needs_login');
    expect(next.lastResult?.message).toContain('login required');
  });

  it('moves to failed on non-login failures', () => {
    const next = reduceRunState(baseSnapshot, {
      type: 'VIP_CLAIM_RESULT',
      ok: false,
      step: 'claim_vip',
      message: 'button not found'
    });

    expect(next.dailyRunState).toBe('failed');
    expect(next.lastResult?.message).toContain('button not found');
  });
});

describe('createRunStartSnapshot', () => {
  it('resets startedAt for a new day run and records the trigger', () => {
    const now = new Date('2026-04-02T09:00:00+08:00');

    const next = createRunStartSnapshot(
      now,
      {
        dailyRunDate: '2026-03-30',
        dailyRunState: 'success',
        lastResult: {
          startedAt: '2026-03-30T02:02:19.354Z',
          finishedAt: '2026-03-30T02:37:38.713Z',
          step: 'claim_vip',
          message: '已签到 3月30日',
          trigger: 'manual'
        }
      },
      'alarm'
    );

    expect(next.dailyRunDate).toBe('2026-04-02');
    expect(next.dailyRunState).toBe('watching');
    expect(next.lastResult?.startedAt).toBe('2026-04-02T01:00:00.000Z');
    expect(next.lastResult?.trigger).toBe('alarm');
    expect(next.lastResult?.step).toBe('watch_video');
  });
});

describe('createStepStartSnapshot', () => {
  it('refreshes the last result when entering the claim step', () => {
    const next = createStepStartSnapshot(
      {
        dailyRunDate: '2026-03-30',
        dailyRunState: 'watching',
        lastResult: {
          startedAt: '2026-03-30T01:00:00.000Z',
          step: 'watch_video',
          message: '开始执行今日任务',
          trigger: 'startup'
        }
      },
      'claim_vip',
      new Date('2026-03-30T09:00:00+08:00')
    );

    expect(next.dailyRunState).toBe('claiming');
    expect(next.lastResult?.step).toBe('claim_vip');
    expect(next.lastResult?.message).toBe('检查签到状态中');
    expect(next.lastResult?.startedAt).toBe('2026-03-30T01:00:00.000Z');
    expect(next.lastResult?.trigger).toBe('startup');
  });
});

describe('applyWatchProgressSnapshot', () => {
  it('refreshes the last result while keeping the run in watching state', () => {
    const next = applyWatchProgressSnapshot(
      {
        dailyRunDate: '2026-03-30',
        dailyRunState: 'watching',
        lastResult: {
          startedAt: '2026-03-30T02:00:00.000Z',
          step: 'watch_video',
          message: '开始执行今日任务',
          trigger: 'alarm'
        }
      },
      {
        type: 'VIDEO_WATCH_PROGRESS',
        step: 'watch_video',
        message: '已观看 12 / 33 秒'
      }
    );

    expect(next.dailyRunState).toBe('watching');
    expect(next.lastResult?.message).toBe('已观看 12 / 33 秒');
    expect(next.lastResult?.step).toBe('watch_video');
    expect(next.lastResult?.startedAt).toBe('2026-03-30T02:00:00.000Z');
    expect(next.lastResult?.trigger).toBe('alarm');
  });
});

describe('shouldFocusStepTab', () => {
  it('focuses the video step tab so bilibili playback can actually start', () => {
    expect(shouldFocusStepTab('watch_video')).toBe(true);
  });

  it('focuses the claim step tab so the user can see the sign-in page transition', () => {
    expect(shouldFocusStepTab('claim_vip')).toBe(true);
  });
});

describe('shouldCloseStepTab', () => {
  it('closes the watch tab after video step completes', () => {
    expect(shouldCloseStepTab('watch_video')).toBe(true);
  });

  it('keeps the claim tab open so the user can inspect the sign-in page result', () => {
    expect(shouldCloseStepTab('claim_vip')).toBe(false);
  });
});

describe('buildStepFailureResult', () => {
  it('creates a watch step failure payload', () => {
    expect(buildStepFailureResult('watch_video', 'timeout')).toEqual({
      type: 'VIDEO_WATCH_RESULT',
      ok: false,
      step: 'watch_video',
      message: 'timeout'
    });
  });

  it('creates a claim step failure payload', () => {
    expect(buildStepFailureResult('claim_vip', 'button missing')).toEqual({
      type: 'VIP_CLAIM_RESULT',
      ok: false,
      step: 'claim_vip',
      message: 'button missing'
    });
  });
});

describe('isRunStale', () => {
  it('treats an old watching run as stale', () => {
    expect(
      isRunStale(
        {
          dailyRunState: 'watching',
          lastResult: {
            startedAt: '2026-03-30T02:00:00.000Z',
            step: 'watch_video',
            message: '开始执行今日任务'
          }
        },
        new Date('2026-03-30T02:10:01.000Z'),
        10 * 60 * 1000
      )
    ).toBe(true);
  });

  it('does not treat a fresh run as stale', () => {
    expect(
      isRunStale(
        {
          dailyRunState: 'watching',
          lastResult: {
            startedAt: '2026-03-30T02:00:00.000Z',
            step: 'watch_video',
            message: '开始执行今日任务'
          }
        },
        new Date('2026-03-30T02:02:00.000Z'),
        10 * 60 * 1000
      )
    ).toBe(false);
  });
});

describe('active run context helpers', () => {
  it('creates an active run context from the trigger', () => {
    expect(createActiveRunContext('startup')).toEqual({
      trigger: 'startup',
      step: 'watch_video',
      tabIds: {}
    });
  });

  it('assigns the active step and remembers the tab id', () => {
    const next = assignActiveRunStep(createActiveRunContext('alarm'), 'claim_vip', 42);

    expect(next).toEqual({
      trigger: 'alarm',
      step: 'claim_vip',
      tabIds: {
        claim_vip: 42
      }
    });
  });

  it('matches a recovered active step by step and tab id', () => {
    const activeRun = assignActiveRunStep(createActiveRunContext('manual'), 'watch_video', 7);

    expect(matchesActiveRunStep(activeRun, 'watch_video', 7)).toBe(true);
    expect(matchesActiveRunStep(activeRun, 'watch_video', 8)).toBe(false);
    expect(matchesActiveRunStep(activeRun, 'claim_vip', 7)).toBe(false);
    expect(getActiveRunTabId(activeRun, 'watch_video')).toBe(7);
  });
});
