import type { StepAcceptedMessage } from '../shared/messages';
import type { RunStep, RunTrigger } from '../shared/state';
import { getStepConfig } from './step-config';

const TAB_ID_RESOLUTION_ATTEMPTS = 10;
const TAB_ID_RESOLUTION_DELAY_MS = 300;

interface OpenStepTabSuccess {
  ok: true;
  tabId: number;
}

interface StepFailure {
  ok: false;
  message: string;
}

export type OpenStepTabResult = OpenStepTabSuccess | StepFailure;
export type DispatchStepResult = { ok: true } | StepFailure;

export async function openStepTab(step: RunStep): Promise<OpenStepTabResult> {
  const config = getStepConfig(step);
  const existingTabs = await chrome.tabs.query({});
  const preferredWindowId = pickStepWindowId(existingTabs);
  const createdTab = await chrome.tabs.create({
    url: config.url,
    active: config.focus,
    ...(typeof preferredWindowId === 'number' ? { windowId: preferredWindowId } : {})
  });
  const tabId = await resolveCreatedTabId(createdTab, config.url);

  if (typeof tabId !== 'number') {
    return {
      ok: false,
      message: '无法解析新建标签页，步骤未启动'
    };
  }

  return {
    ok: true,
    tabId
  };
}

export async function dispatchStep(
  tabId: number,
  step: RunStep,
  trigger: RunTrigger
): Promise<DispatchStepResult> {
  try {
    const config = getStepConfig(step);

    if (config.focus) {
      await focusStepTab(tabId);
    }

    await waitForTabComplete(tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [config.scriptFile]
    });

    const response = (await chrome.tabs.sendMessage(tabId, {
      type: 'RUN_BILIBILI_DAILY',
      step,
      trigger
    })) as StepAcceptedMessage | undefined;

    if (!response?.accepted) {
      throw new Error(`${step} content script did not acknowledge dispatch`);
    }

    return {
      ok: true
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : getStepConfig(step).dispatchFailureMessage
    };
  }
}

export async function closeStepTab(tabId: number | undefined): Promise<void> {
  if (typeof tabId !== 'number') {
    return;
  }

  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // Ignore already-closed tabs.
  }
}

export function getRunDispatchDelayMs(trigger: RunTrigger): number {
  return trigger === 'startup' ? 3_000 : 0;
}

export function pickStepTabId(
  createdTab: Pick<chrome.tabs.Tab, 'id' | 'pendingUrl' | 'url' | 'windowId'>,
  candidateTabs: Array<Pick<chrome.tabs.Tab, 'id' | 'pendingUrl' | 'url' | 'windowId'>>,
  targetUrl: string
): number | undefined {
  if (typeof createdTab.id === 'number') {
    return createdTab.id;
  }

  return candidateTabs
    .filter((tab) => typeof tab.id === 'number')
    .filter((tab) => {
      if (typeof createdTab.windowId !== 'number') {
        return true;
      }

      return tab.windowId === createdTab.windowId;
    })
    .filter(
      (tab) => matchesStepUrl(tab.pendingUrl, targetUrl) || matchesStepUrl(tab.url, targetUrl)
    )
    .sort((left, right) => (right.id ?? 0) - (left.id ?? 0))[0]?.id;
}

export function pickStepWindowId(
  candidateTabs: Array<Pick<chrome.tabs.Tab, 'active' | 'pendingUrl' | 'url' | 'windowId'>>
): number | undefined {
  const matchingTabs = candidateTabs.filter(
    (tab) =>
      typeof tab.windowId === 'number' &&
      (isBrowsableWindowUrl(tab.pendingUrl) || isBrowsableWindowUrl(tab.url))
  );

  const activeTab = matchingTabs.find((tab) => tab.active);

  return activeTab?.windowId ?? matchingTabs[0]?.windowId;
}

async function resolveCreatedTabId(
  createdTab: chrome.tabs.Tab,
  targetUrl: string
): Promise<number | undefined> {
  const directTabId = pickStepTabId(createdTab, [], targetUrl);

  if (typeof directTabId === 'number') {
    return directTabId;
  }

  for (let attempt = 0; attempt < TAB_ID_RESOLUTION_ATTEMPTS; attempt += 1) {
    const candidateTabs =
      typeof createdTab.windowId === 'number'
        ? await chrome.tabs.query({ windowId: createdTab.windowId })
        : await chrome.tabs.query({});
    const resolvedTabId = pickStepTabId(createdTab, candidateTabs, targetUrl);

    if (typeof resolvedTabId === 'number') {
      return resolvedTabId;
    }

    await delay(TAB_ID_RESOLUTION_DELAY_MS);
  }

  return undefined;
}

async function focusStepTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);

  if (typeof tab.windowId === 'number') {
    await chrome.windows.update(tab.windowId, {
      focused: true
    });
  }

  await chrome.tabs.update(tabId, {
    active: true
  });
}

async function waitForTabComplete(tabId: number, timeoutMs = 30000): Promise<void> {
  const tab = await chrome.tabs.get(tabId);

  if (tab.status === 'complete') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error(`tab ${tabId} did not finish loading in time`));
    }, timeoutMs);

    function handleUpdated(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

function matchesStepUrl(candidateUrl: string | undefined, targetUrl: string): boolean {
  if (!candidateUrl) {
    return false;
  }

  try {
    const candidate = new URL(candidateUrl);
    const target = new URL(targetUrl);

    return candidate.origin === target.origin && candidate.pathname === target.pathname;
  } catch {
    return false;
  }
}

function isBrowsableWindowUrl(candidateUrl: string | undefined): boolean {
  if (!candidateUrl) {
    return false;
  }

  try {
    const { protocol } = new URL(candidateUrl);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
