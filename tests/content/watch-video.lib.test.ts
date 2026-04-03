import { describe, expect, it } from 'vitest';

import {
  createWatchTracker,
  findWatchTargets,
  resolveWatchTargetSeconds
} from '../../src/content/watch-video.lib';

describe('findWatchTargets', () => {
  it('finds the bilibili video element and player container', () => {
    document.body.innerHTML = `
      <main>
        <div class="bpx-player-container">
          <div class="bpx-player-video-area"></div>
          <video id="main-video"></video>
        </div>
      </main>
    `;

    const targets = findWatchTargets(document);

    expect(targets.video?.id).toBe('main-video');
    expect(targets.playerArea?.className).toContain('bpx-player-video-area');
  });
});

describe('createWatchTracker', () => {
  it('reports completion once accumulated watch time reaches 60 seconds', () => {
    const tracker = createWatchTracker(60);

    expect(tracker.recordTick(15)).toBe(false);
    expect(tracker.recordTick(20)).toBe(false);
    expect(tracker.recordTick(25)).toBe(true);
  });

  it('treats an ended short video as complete even when the last fraction was not sampled', () => {
    const tracker = createWatchTracker(33);

    tracker.recordTick(31.4);

    expect(
      tracker.isComplete({
        currentTime: 32.4,
        ended: true
      })
    ).toBe(true);
  });

  it('does not mark incomplete playback as done before the video ends', () => {
    const tracker = createWatchTracker(33);

    tracker.recordTick(31.4);

    expect(
      tracker.isComplete({
        currentTime: 32.4,
        ended: false
      })
    ).toBe(false);
  });

  it('supports shrinking the target after metadata becomes available', () => {
    const tracker = createWatchTracker(60);

    tracker.recordTick(31.4);
    tracker.setTarget(33);

    expect(
      tracker.isComplete({
        currentTime: 32.4,
        ended: true
      })
    ).toBe(true);
  });
});

describe('resolveWatchTargetSeconds', () => {
  it('uses the full duration when the video is shorter than the default threshold', () => {
    expect(resolveWatchTargetSeconds(60, 33)).toBe(33);
  });

  it('keeps the default threshold for longer videos', () => {
    expect(resolveWatchTargetSeconds(60, 300)).toBe(60);
  });

  it('falls back to the default threshold when duration is missing', () => {
    expect(resolveWatchTargetSeconds(60, Number.NaN)).toBe(60);
  });

  it('shrinks the existing target when a shorter duration appears later', () => {
    expect(resolveWatchTargetSeconds(60, 33, 60)).toBe(33);
  });

  it('keeps the already-shrunk target when duration temporarily becomes unavailable again', () => {
    expect(resolveWatchTargetSeconds(60, Number.NaN, 33)).toBe(33);
  });
});
