import { describe, expect, it } from 'vitest';

import {
  getRunDispatchDelayMs,
  pickStepTabId,
  pickStepWindowId
} from '../../src/background/step-runtime';

describe('pickStepTabId', () => {
  it('recovers the created tab id from matching tabs when Atlas returns a tab without id', () => {
    const tabId = pickStepTabId(
      {
        windowId: 3
      },
      [
        {
          id: 11,
          windowId: 3,
          url: 'https://space.bilibili.com/26240675/lists/408?type=season'
        },
        {
          id: 12,
          windowId: 3,
          pendingUrl:
            'https://www.bilibili.com/video/BV1fZiYBEEcm/?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=8ee4d31310b3fe96d6c5902ed191cddc'
        }
      ],
      'https://www.bilibili.com/video/BV1fZiYBEEcm/?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=8ee4d31310b3fe96d6c5902ed191cddc'
    );

    expect(tabId).toBe(12);
  });

  it('keeps the original id when tabs.create already returned one', () => {
    const tabId = pickStepTabId(
      {
        id: 42,
        windowId: 3
      },
      [],
      'https://www.bilibili.com/video/BV1fZiYBEEcm/'
    );

    expect(tabId).toBe(42);
  });
});

describe('pickStepWindowId', () => {
  it('prefers a normal web window over an atlas internal page window', () => {
    const windowId = pickStepWindowId([
      {
        windowId: 1,
        active: true,
        url: 'atlas://extensions'
      },
      {
        windowId: 2,
        active: true,
        url: 'https://space.bilibili.com/26240675/lists/408?type=season'
      }
    ]);

    expect(windowId).toBe(2);
  });
});

describe('getRunDispatchDelayMs', () => {
  it('waits briefly for startup-triggered runs so Atlas can finish restoring windows', () => {
    expect(getRunDispatchDelayMs('startup')).toBeGreaterThan(0);
  });

  it('does not delay manual runs', () => {
    expect(getRunDispatchDelayMs('manual')).toBe(0);
  });
});
