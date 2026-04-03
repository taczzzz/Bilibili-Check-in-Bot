import {
  isRunDailyMessage,
  type StepAcceptedMessage,
  type VipClaimResultMessage
} from '../shared/messages';
import {
  formatSignedDate,
  findClaimButton,
  findVipCard,
  getVipClaimStatus,
  isVipPageLoginRequired,
  triggerClaimAction
} from './claim-vip.lib';

let isRunning = false;

const globalScope = globalThis as typeof globalThis & {
  __atlasClaimVipListenerRegistered?: boolean;
};

if (!globalScope.__atlasClaimVipListenerRegistered) {
  globalScope.__atlasClaimVipListenerRegistered = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRunDailyMessage(message) || message.step !== 'claim_vip') {
      return;
    }

    sendResponse({
      accepted: true
    } satisfies StepAcceptedMessage);

    if (isRunning) {
      return;
    }

    isRunning = true;
    void runClaimFlow();
  });
}

async function runClaimFlow(): Promise<void> {
  if (isVipPageLoginRequired(document)) {
    finish({
      type: 'VIP_CLAIM_RESULT',
      ok: false,
      needsLogin: true,
      step: 'claim_vip',
      message: '大会员页需要登录'
    });
    return;
  }

  const card = findVipCard(document);

  if (!card) {
    finish({
      type: 'VIP_CLAIM_RESULT',
      ok: false,
      step: 'claim_vip',
      message: '未找到签到卡片'
    });
    return;
  }

  const initialStatus = getVipClaimStatus(document, card);

  if (initialStatus === 'failed') {
    finish(buildClaimResult(false, '签到失败'));
    return;
  }

  if (initialStatus === 'success' || initialStatus === 'already_signed') {
    finish(buildClaimResult(true, signedMessage()));
    return;
  }

  const button = findClaimButton(card);

  if (!button) {
    finish(buildClaimResult(false, '未找到签到按钮'));
    return;
  }

  triggerClaimAction(button);

  const resolution = await waitForClaimResolution();
  finish(buildClaimResult(resolution.ok, resolution.message));
}

async function waitForClaimResolution(): Promise<{ ok: boolean; message: string }> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(1000);

    const status = getVipClaimStatus(document, findVipCard(document));

    if (status === 'success' || status === 'already_signed') {
      return { ok: true, message: signedMessage() };
    }

    if (status === 'failed') {
      return { ok: false, message: '签到失败' };
    }
  }

  return {
    ok: false,
    message: '签到失败'
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function finish(message: VipClaimResultMessage): void {
  isRunning = false;
  void chrome.runtime.sendMessage({
    ...message,
    finishedAt: new Date().toISOString()
  });
}

function buildClaimResult(ok: boolean, message: string): VipClaimResultMessage {
  return {
    type: 'VIP_CLAIM_RESULT',
    ok,
    step: 'claim_vip',
    message
  };
}

function signedMessage(): string {
  return `已签到 ${formatSignedDate(new Date())}`;
}
