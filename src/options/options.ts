import { STATUS_LABELS, TRIGGER_LABELS } from '../shared/state';
import type { RunDailyResponse } from '../shared/messages';
import {
  readSnapshot,
  readTaskAutomationSettings,
  writeTaskAutomationSettings
} from '../shared/storage';

const statusLabel = document.querySelector<HTMLElement>('#status-label');
const lastMessage = document.querySelector<HTMLElement>('#last-message');
const lastTime = document.querySelector<HTMLElement>('#last-time');
const lastTrigger = document.querySelector<HTMLElement>('#last-trigger');
const autoRunLabel = document.querySelector<HTMLElement>('#auto-run-label');
const autoRunToggle = document.querySelector<HTMLInputElement>('#auto-run-toggle');
const runButton = document.querySelector<HTMLButtonElement>('#run-button');
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-button');

void render();

runButton?.addEventListener('click', async () => {
  if (!runButton) {
    return;
  }

  runButton.disabled = true;
  runButton.textContent = '执行中...';

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'RUN_BILIBILI_DAILY',
      trigger: 'manual'
    })) as RunDailyResponse | undefined;

    if (response?.accepted && !response.started) {
      applyLocalFeedback(response.message);
      return;
    }
  } finally {
    runButton.disabled = false;
    runButton.textContent = '立即执行';
    await render();
  }
});

refreshButton?.addEventListener('click', () => {
  void render();
});

autoRunToggle?.addEventListener('change', async () => {
  if (!autoRunToggle) {
    return;
  }

  autoRunToggle.disabled = true;

  try {
    await writeTaskAutomationSettings({
      bilibiliVipDailyEnabled: autoRunToggle.checked
    });
  } finally {
    autoRunToggle.disabled = false;
    await render();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || Object.keys(changes).length === 0) {
    return;
  }

  void render();
});

async function render(): Promise<void> {
  const [snapshot, taskAutomationSettings] = await Promise.all([
    readSnapshot(),
    readTaskAutomationSettings()
  ]);

  if (statusLabel) {
    statusLabel.textContent = STATUS_LABELS[snapshot.dailyRunState];
  }

  if (lastMessage) {
    lastMessage.textContent = snapshot.lastResult?.message ?? '暂无记录';
  }

  if (lastTime) {
    lastTime.textContent = formatTime(snapshot.lastResult?.finishedAt ?? snapshot.lastResult?.startedAt);
  }

  if (lastTrigger) {
    const trigger = snapshot.lastResult?.trigger;
    lastTrigger.textContent = trigger ? TRIGGER_LABELS[trigger] : '-';
  }

  if (autoRunToggle) {
    autoRunToggle.checked = taskAutomationSettings.bilibiliVipDailyEnabled;
  }

  if (autoRunLabel) {
    autoRunLabel.textContent = taskAutomationSettings.bilibiliVipDailyEnabled
      ? '已开启'
      : '已关闭';
  }
}

function formatTime(value: string | undefined): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function applyLocalFeedback(message: string): void {
  if (lastMessage) {
    lastMessage.textContent = message;
  }

  if (lastTime) {
    lastTime.textContent = formatTime(new Date().toISOString());
  }

  if (lastTrigger) {
    lastTrigger.textContent = '手动执行';
  }
}
