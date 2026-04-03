import type {
  ActiveRunContext,
  DailyRunSnapshot,
  DailyRunState,
  LastResult,
  RunStep
} from '../shared/state';
import type {
  RunDailyResponse,
  VideoWatchResultMessage,
  VideoWatchProgressMessage,
  VipClaimResultMessage
} from '../shared/messages';
import { getStepConfig } from './step-config';

export type StepResultEvent = VideoWatchResultMessage | VipClaimResultMessage;

interface ShouldStartDailyRunOptions {
  now: Date;
  scheduleTime: string;
  snapshot: Pick<DailyRunSnapshot, 'dailyRunDate' | 'dailyRunState'>;
}

interface ResolveRunRequestOptions extends ShouldStartDailyRunOptions {
  trigger: RunTrigger;
  automationEnabled: boolean;
  hasActiveRun: boolean;
  ignoreSchedule?: boolean;
}

export function getTodayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function hasSuccessfulRunToday(
  snapshot: Pick<DailyRunSnapshot, 'dailyRunDate' | 'dailyRunState'>,
  now: Date
): boolean {
  return snapshot.dailyRunDate === getTodayKey(now) && snapshot.dailyRunState === 'success';
}

export function shouldStartDailyRun({
  now,
  scheduleTime,
  snapshot
}: ShouldStartDailyRunOptions): boolean {
  if (hasSuccessfulRunToday(snapshot, now)) {
    return false;
  }

  const [hourPart, minutePart] = scheduleTime.split(':');
  const scheduleMoment = new Date(now);
  scheduleMoment.setHours(Number(hourPart), Number(minutePart), 0, 0);

  return now.getTime() >= scheduleMoment.getTime();
}

export function resolveRunRequest({
  now,
  scheduleTime,
  trigger,
  snapshot,
  automationEnabled,
  hasActiveRun,
  ignoreSchedule = false
}: ResolveRunRequestOptions): RunDailyResponse {
  if (hasActiveRun) {
    return {
      accepted: true,
      started: false,
      reason: 'active_run',
      message: '已有任务执行中'
    };
  }

  if (trigger !== 'manual' && !automationEnabled) {
    return {
      accepted: true,
      started: false,
      reason: 'automation_disabled',
      message: '自动签到已关闭'
    };
  }

  if (hasSuccessfulRunToday(snapshot, now)) {
    return {
      accepted: true,
      started: false,
      reason: 'already_completed_today',
      message: '今日已签到，无需重复执行'
    };
  }

  if (!ignoreSchedule && !shouldStartDailyRun({ now, scheduleTime, snapshot })) {
    return {
      accepted: true,
      started: false,
      reason: 'before_schedule',
      message: '未到自动执行时间'
    };
  }

  return {
    accepted: true,
    started: true,
    message: '开始执行今日任务'
  };
}

export function createRunStartSnapshot(
  now: Date,
  current: DailyRunSnapshot,
  trigger: RunTrigger
): DailyRunSnapshot {
  const config = getStepConfig('watch_video');

  return {
    ...current,
    dailyRunDate: getTodayKey(now),
    dailyRunState: config.startState,
    lastResult: {
      startedAt: now.toISOString(),
      step: 'watch_video',
      message: config.startMessage,
      trigger
    }
  };
}

export function createStepStartSnapshot(
  current: DailyRunSnapshot,
  step: RunStep,
  now: Date
): DailyRunSnapshot {
  const config = getStepConfig(step);
  const startedAt = current.lastResult?.startedAt ?? now.toISOString();

  return {
    ...current,
    dailyRunState: config.startState,
    lastResult: {
      startedAt,
      step,
      message: config.startMessage,
      trigger: current.lastResult?.trigger
    }
  };
}

export function reduceRunState(
  current: DailyRunSnapshot,
  event: StepResultEvent
): DailyRunSnapshot {
  const nextState = resolveNextState(event);
  const lastResult = buildLastResult(current.lastResult, event);

  return {
    ...current,
    dailyRunState: nextState,
    lastResult
  };
}

export function applyWatchProgressSnapshot(
  current: DailyRunSnapshot,
  event: VideoWatchProgressMessage
): DailyRunSnapshot {
  return {
    ...current,
    dailyRunState: 'watching',
    lastResult: {
      startedAt: current.lastResult?.startedAt ?? new Date().toISOString(),
      step: 'watch_video',
      message: event.message,
      trigger: current.lastResult?.trigger
    }
  };
}

function resolveNextState(event: StepResultEvent): DailyRunState {
  if (!event.ok) {
    return event.needsLogin ? 'needs_login' : 'failed';
  }

  return event.type === 'VIDEO_WATCH_RESULT' ? 'claiming' : 'success';
}

function buildLastResult(
  previous: LastResult | undefined,
  event: StepResultEvent
): LastResult {
  return {
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    finishedAt: event.finishedAt ?? new Date().toISOString(),
    step: event.step,
    message: event.message,
    trigger: previous?.trigger
  };
}

export function shouldFocusStepTab(step: RunStep): boolean {
  return getStepConfig(step).focus;
}

export function shouldCloseStepTab(step: RunStep): boolean {
  return getStepConfig(step).closeOnComplete;
}

export function isRunStale(
  snapshot: Pick<DailyRunSnapshot, 'dailyRunState' | 'lastResult'>,
  now: Date,
  staleAfterMs: number
): boolean {
  if (!['watching', 'claiming'].includes(snapshot.dailyRunState)) {
    return false;
  }

  const startedAt = snapshot.lastResult?.startedAt;

  if (!startedAt) {
    return false;
  }

  const startedAtMs = new Date(startedAt).getTime();

  if (Number.isNaN(startedAtMs)) {
    return false;
  }

  return now.getTime() - startedAtMs >= staleAfterMs;
}

export function buildStepFailureResult(step: RunStep, message: string): StepResultEvent {
  if (step === 'watch_video') {
    return {
      type: 'VIDEO_WATCH_RESULT',
      ok: false,
      step,
      message
    };
  }

  return {
    type: 'VIP_CLAIM_RESULT',
    ok: false,
    step,
    message
  };
}

export function createActiveRunContext(trigger: RunTrigger): ActiveRunContext {
  return {
    trigger,
    step: 'watch_video',
    tabIds: {}
  };
}

export function assignActiveRunStep(
  activeRun: ActiveRunContext,
  step: RunStep,
  tabId?: number
): ActiveRunContext {
  return {
    ...activeRun,
    step,
    tabIds: typeof tabId === 'number'
      ? {
          ...activeRun.tabIds,
          [step]: tabId
        }
      : activeRun.tabIds
  };
}

export function matchesActiveRunStep(
  activeRun: ActiveRunContext | null,
  step: RunStep,
  tabId: number | undefined
): boolean {
  return Boolean(activeRun && activeRun.step === step && tabId === getActiveRunTabId(activeRun, step));
}

export function getActiveRunTabId(
  activeRun: ActiveRunContext | null,
  step: RunStep
): number | undefined {
  return activeRun?.tabIds[step];
}
