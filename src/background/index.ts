import { DEFAULT_RUN_TIME, RUN_ALARM_NAME } from '../shared/config';
import {
  isRunDailyMessage,
  isVideoWatchProgressMessage,
  isVideoWatchResultMessage,
  isVipClaimResultMessage,
  type RunDailyResponse,
  type RunStep,
  type RunTrigger,
  type VideoWatchProgressMessage,
  type VideoWatchResultMessage,
  type VipClaimResultMessage
} from '../shared/messages';
import {
  clearActiveRunContext,
  readActiveRunContext,
  readSnapshot,
  readTaskAutomationSettings,
  writeActiveRunContext,
  writeSnapshot
} from '../shared/storage';
import {
  applyWatchProgressSnapshot,
  assignActiveRunStep,
  buildStepFailureResult,
  createActiveRunContext,
  createStepStartSnapshot,
  createRunStartSnapshot,
  getActiveRunTabId,
  isRunStale,
  matchesActiveRunStep,
  resolveRunRequest,
  reduceRunState
} from './orchestrator';
import {
  closeStepTab,
  dispatchStep,
  getRunDispatchDelayMs,
  openStepTab
} from './step-runtime';
import { getStepConfig } from './step-config';

const RUN_STALE_AFTER_MS = 10 * 60 * 1000;

chrome.runtime.onInstalled.addListener(() => {
  void scheduleNextRun();
});

chrome.runtime.onStartup.addListener(() => {
  void scheduleNextRun();
  void maybeStartRun('startup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== RUN_ALARM_NAME) {
    return;
  }

  void scheduleNextRun();
  void maybeStartRun('alarm');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isRunDailyMessage(message) && !message.step) {
    void (async () => {
      sendResponse(
        await maybeStartRun(message.trigger ?? 'manual', {
          ignoreSchedule: true
        })
      );
    })();
    return true;
  }

  if (isVideoWatchResultMessage(message)) {
    void (async () => {
      await handleVideoResult(message, sender.tab?.id);
      sendResponse({ accepted: true });
    })();
    return true;
  }

  if (isVideoWatchProgressMessage(message)) {
    void (async () => {
      await handleVideoProgress(message, sender.tab?.id);
      sendResponse({ accepted: true });
    })();
    return true;
  }

  if (isVipClaimResultMessage(message)) {
    void (async () => {
      await handleVipResult(message, sender.tab?.id);
      sendResponse({ accepted: true });
    })();
    return true;
  }
});

async function maybeStartRun(
  trigger: RunTrigger,
  options: { ignoreSchedule?: boolean } = {}
): Promise<RunDailyResponse> {
  const now = new Date();
  const [snapshot, taskAutomationSettings, activeRun] = await Promise.all([
    readSnapshot(),
    readTaskAutomationSettings(),
    readActiveRunContext()
  ]);

  if (activeRun && isRunStale(snapshot, now, RUN_STALE_AFTER_MS)) {
    await clearActiveRunContext();
  }

  const decision = resolveRunRequest({
    now,
    scheduleTime: DEFAULT_RUN_TIME,
    trigger,
    snapshot,
    automationEnabled: taskAutomationSettings.bilibiliVipDailyEnabled,
    hasActiveRun: Boolean(activeRun) && !isRunStale(snapshot, now, RUN_STALE_AFTER_MS),
    ignoreSchedule: options.ignoreSchedule
  });

  if (!decision.started) {
    return decision;
  }

  await writeSnapshot(createRunStartSnapshot(now, snapshot, trigger));
  await writeActiveRunContext(createActiveRunContext(trigger));
  const dispatchDelayMs = getRunDispatchDelayMs(trigger);

  if (dispatchDelayMs > 0) {
    await delay(dispatchDelayMs);
  }

  await openStep('watch_video', trigger);

  return decision;
}

async function handleVideoProgress(
  message: VideoWatchProgressMessage,
  tabId: number | undefined
): Promise<void> {
  const activeRun = await readActiveRunContext();

  if (!matchesActiveRunStep(activeRun, 'watch_video', tabId)) {
    return;
  }

  const snapshot = await readSnapshot();
  await writeSnapshot(applyWatchProgressSnapshot(snapshot, message));
}

async function handleVideoResult(
  message: VideoWatchResultMessage,
  tabId: number | undefined
): Promise<void> {
  const activeRun = await readActiveRunContext();

  if (!matchesActiveRunStep(activeRun, 'watch_video', tabId)) {
    return;
  }

  const snapshot = await readSnapshot();
  await writeSnapshot(reduceRunState(snapshot, message));
  if (getStepConfig('watch_video').closeOnComplete) {
    await closeStepTab(getActiveRunTabId(activeRun, 'watch_video'));
  }

  if (!message.ok) {
    await clearActiveRunContext();
    return;
  }

  await openStep('claim_vip', activeRun.trigger);
}

async function handleVipResult(
  message: VipClaimResultMessage,
  tabId: number | undefined
): Promise<void> {
  const activeRun = await readActiveRunContext();

  if (!matchesActiveRunStep(activeRun, 'claim_vip', tabId)) {
    return;
  }

  const snapshot = await readSnapshot();
  await writeSnapshot(reduceRunState(snapshot, message));
  if (getStepConfig('claim_vip').closeOnComplete) {
    await closeStepTab(getActiveRunTabId(activeRun, 'claim_vip'));
  }
  await clearActiveRunContext();
}

async function openStep(step: RunStep, trigger: RunTrigger): Promise<void> {
  const activeRun = await readActiveRunContext();

  if (!activeRun) {
    return;
  }

  const snapshot = await readSnapshot();
  await writeSnapshot(createStepStartSnapshot(snapshot, step, new Date()));
  const openResult = await openStepTab(step);

  if (!openResult.ok) {
    await failStep(step, openResult.message);
    return;
  }

  await writeActiveRunContext(assignActiveRunStep(activeRun, step, openResult.tabId));

  const dispatchResult = await dispatchStep(openResult.tabId, step, trigger);

  if (!dispatchResult.ok) {
    await failStep(step, dispatchResult.message, openResult.tabId);
  }
}

async function scheduleNextRun(): Promise<void> {
  const now = new Date();
  const [hourPart, minutePart] = DEFAULT_RUN_TIME.split(':').map(Number);
  const next = new Date(now);

  next.setHours(hourPart, minutePart, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  await chrome.alarms.clear(RUN_ALARM_NAME);
  await chrome.alarms.create(RUN_ALARM_NAME, {
    when: next.getTime()
  });
}

async function failStep(step: RunStep, message: string, tabId?: number): Promise<void> {
  const next = reduceRunState(await readSnapshot(), buildStepFailureResult(step, message));

  await writeSnapshot(next);
  if (getStepConfig(step).closeOnComplete) {
    await closeStepTab(tabId);
  }
  await clearActiveRunContext();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
