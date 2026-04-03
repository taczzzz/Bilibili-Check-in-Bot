import {
  DEFAULT_SNAPSHOT,
  DEFAULT_TASK_AUTOMATION_SETTINGS,
  type ActiveRunContext,
  type DailyRunSnapshot,
  type TaskAutomationSettings
} from './state';

const STORAGE_KEYS = ['dailyRunDate', 'dailyRunState', 'lastResult'] as const;
const TASK_SETTINGS_KEY = 'taskAutomationSettings' as const;
const ACTIVE_RUN_KEY = 'activeRunContext' as const;

export async function readSnapshot(): Promise<DailyRunSnapshot> {
  const stored = await chrome.storage.local.get([...STORAGE_KEYS]);

  return {
    ...DEFAULT_SNAPSHOT,
    ...(stored as Partial<DailyRunSnapshot>)
  };
}

export async function writeSnapshot(snapshot: DailyRunSnapshot): Promise<void> {
  await chrome.storage.local.set(snapshot);
}

export async function readTaskAutomationSettings(): Promise<TaskAutomationSettings> {
  const stored = await chrome.storage.local.get([TASK_SETTINGS_KEY]);
  const settings = stored[TASK_SETTINGS_KEY] as Partial<TaskAutomationSettings> | undefined;

  return {
    ...DEFAULT_TASK_AUTOMATION_SETTINGS,
    ...settings
  };
}

export async function writeTaskAutomationSettings(
  settings: TaskAutomationSettings
): Promise<void> {
  await chrome.storage.local.set({
    [TASK_SETTINGS_KEY]: settings
  });
}

export async function readActiveRunContext(): Promise<ActiveRunContext | null> {
  const stored = await chrome.storage.local.get([ACTIVE_RUN_KEY]);

  return (stored[ACTIVE_RUN_KEY] as ActiveRunContext | undefined) ?? null;
}

export async function writeActiveRunContext(activeRun: ActiveRunContext): Promise<void> {
  await chrome.storage.local.set({
    [ACTIVE_RUN_KEY]: activeRun
  });
}

export async function clearActiveRunContext(): Promise<void> {
  await chrome.storage.local.remove(ACTIVE_RUN_KEY);
}
