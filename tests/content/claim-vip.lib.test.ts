import { describe, expect, it } from 'vitest';

import {
  findClaimButton,
  findVipCard,
  formatSignedDate,
  getVipClaimStatus,
  isVipPageLoginRequired,
  triggerClaimAction
} from '../../src/content/claim-vip.lib';

describe('findVipCard', () => {
  it('finds the card by reward description text instead of brittle classes', async () => {
    document.body.innerHTML = `
      <section>
        <div class="vip-card">
          <p>别的权益</p>
          <button>去领取</button>
        </div>
        <div class="vip-card target">
          <p>会员观看任意1个视频即可领取，日限1次</p>
          <button>去领取</button>
        </div>
      </section>
    `;

    const card = findVipCard(document);

    expect(card?.className).toContain('target');
  });

  it('climbs to the smallest ancestor that also contains the claim control', () => {
    document.body.innerHTML = `
      <section>
        <div class="vip-card target">
          <div class="copy-only">
            <p>会员观看任意1个视频即可领取，日限1次</p>
          </div>
          <div class="action-wrap">
            <span class="claim-action">去领取</span>
          </div>
        </div>
      </section>
    `;

    const card = findVipCard(document);

    expect(card?.className).toContain('target');
  });
});

describe('findClaimButton', () => {
  it('returns the action button inside the target card', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <button>去领取</button>
      </div>
    `;

    const card = findVipCard(document);
    const button = findClaimButton(card);

    expect(button?.textContent).toContain('去领取');
  });

  it('finds the claim control after the card resolver climbs out of a copy-only subtree', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <div class="copy-only">
          <p>会员观看任意1个视频即可领取，日限1次</p>
        </div>
        <div class="action-wrap">
          <span class="claim-action">去领取</span>
        </div>
      </div>
    `;

    const card = findVipCard(document);
    const button = findClaimButton(card);

    expect(card?.className).toContain('target');
    expect(button?.textContent).toContain('去领取');
  });
});

describe('isVipPageLoginRequired', () => {
  it('detects login-required UI before attempting claim', () => {
    document.body.innerHTML = `
      <div>
        <button>立即登录</button>
        <div>扫码登录</div>
      </div>
    `;

    expect(isVipPageLoginRequired(document)).toBe(true);
  });
});

describe('triggerClaimAction', () => {
  it('fires a single click for the claim control', () => {
    document.body.innerHTML = `<button id="claim">去领取</button>`;

    const button = document.querySelector<HTMLElement>('#claim');
    let clickCount = 0;
    button?.addEventListener('click', () => {
      clickCount += 1;
    });

    if (!button) {
      throw new Error('claim button missing in test');
    }

    triggerClaimAction(button);

    expect(clickCount).toBe(1);
  });
});

describe('getVipClaimStatus', () => {
  it('treats a completed card as already signed', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <span>已签到</span>
      </div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('already_signed');
  });

  it('treats already-claimed copy as already signed', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <span>今天已经领取</span>
      </div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('already_signed');
  });

  it('detects a success toast after clicking the claim button', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <button>去领取</button>
      </div>
      <div class="toast">签到成功</div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('success');
  });

  it('prefers already-signed card state over a generic failure toast', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <span>今日已领取</span>
      </div>
      <div class="toast">签到失败，请稍后再试</div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('already_signed');
  });

  it('treats the already-claimed modal as already signed even when the title says failure', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <button>去领取</button>
      </div>
      <div class="dialog">
        <h3>领取失败</h3>
        <p>已经领取过了哦</p>
        <button>确定</button>
      </div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('already_signed');
  });

  it('detects a failure toast after clicking the claim button', () => {
    document.body.innerHTML = `
      <div class="vip-card target">
        <p>会员观看任意1个视频即可领取，日限1次</p>
        <button>去领取</button>
      </div>
      <div class="toast">签到失败，请稍后再试</div>
    `;

    const card = findVipCard(document);

    expect(getVipClaimStatus(document, card)).toBe('failed');
  });
});

describe('formatSignedDate', () => {
  it('formats the signed date in month-day form', () => {
    expect(formatSignedDate(new Date('2026-03-30T09:00:00+08:00'))).toBe('3月30日');
  });
});
