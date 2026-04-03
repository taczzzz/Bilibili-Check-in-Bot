import { WATCH_TARGET_SECONDS, WATCH_TIMEOUT_MS } from '../shared/config';
import {
  isRunDailyMessage,
  type StepAcceptedMessage,
  type VideoWatchProgressMessage,
  type VideoWatchResultMessage
} from '../shared/messages';
import { createWatchTracker, findWatchTargets, resolveWatchTargetSeconds } from './watch-video.lib';

let activeInterval: number | null = null;
let isRunning = false;

const globalScope = globalThis as typeof globalThis & {
  __atlasWatchVideoListenerRegistered?: boolean;
};

if (!globalScope.__atlasWatchVideoListenerRegistered) {
  globalScope.__atlasWatchVideoListenerRegistered = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRunDailyMessage(message) || message.step !== 'watch_video') {
      return;
    }

    sendResponse({
      accepted: true
    } satisfies StepAcceptedMessage);

    if (isRunning) {
      return;
    }

    isRunning = true;
    void runWatchFlow();
  });
}

async function runWatchFlow(): Promise<void> {
  const targets = findWatchTargets(document);

  if (!targets.video) {
    finish({
      type: 'VIDEO_WATCH_RESULT',
      ok: false,
      step: 'watch_video',
      message: '未找到视频元素'
    });
    return;
  }

  try {
    await ensurePlayback(targets.video, targets.playerArea);
  } catch (error) {
    finish({
      type: 'VIDEO_WATCH_RESULT',
      ok: false,
      step: 'watch_video',
      message: error instanceof Error ? error.message : '无法开始播放视频'
    });
    return;
  }

  const tracker = createWatchTracker(
    resolveWatchTargetSeconds(WATCH_TARGET_SECONDS, targets.video.duration)
  );
  let lastCurrentTime = targets.video.currentTime;
  const deadline = Date.now() + WATCH_TIMEOUT_MS;
  reportProgress(0, tracker.getTarget());

  activeInterval = window.setInterval(() => {
    if (!targets.video) {
      finish({
        type: 'VIDEO_WATCH_RESULT',
        ok: false,
        step: 'watch_video',
        message: '视频元素已消失'
      });
      return;
    }

    const delta = Math.max(0, targets.video.currentTime - lastCurrentTime);
    lastCurrentTime = targets.video.currentTime;
    tracker.setTarget(
      resolveWatchTargetSeconds(WATCH_TARGET_SECONDS, targets.video.duration, tracker.getTarget())
    );

    tracker.recordTick(delta);
    reportProgress(Math.round(tracker.getAccumulated()), tracker.getTarget());

    if (
      tracker.isComplete({
        currentTime: targets.video.currentTime,
        ended: targets.video.ended
      })
    ) {
      const targetSeconds = tracker.getTarget();
      finish({
        type: 'VIDEO_WATCH_RESULT',
        ok: true,
        step: 'watch_video',
        message: `已完成视频观看（${targetSeconds}秒）`,
        watchedSeconds: Math.round(tracker.getAccumulated())
      });
      return;
    }

    if (Date.now() >= deadline) {
      const targetSeconds = tracker.getTarget();
      finish({
        type: 'VIDEO_WATCH_RESULT',
        ok: false,
        step: 'watch_video',
        message: `视频观看超时（目标${targetSeconds}秒）`
      });
      return;
    }

    if (targets.video.paused) {
      void ensurePlayback(targets.video, targets.playerArea).catch(() => undefined);
    }
  }, 1000);
}

async function ensurePlayback(
  video: HTMLVideoElement,
  playerArea: HTMLElement | null
): Promise<void> {
  video.muted = true;

  if (!video.paused) {
    return;
  }

  try {
    await video.play();
  } catch {
    playerArea?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    playerArea?.click();
    await video.play();
  }

  if (video.paused) {
    throw new Error('视频未开始播放');
  }
}

function finish(message: VideoWatchResultMessage): void {
  if (activeInterval !== null) {
    window.clearInterval(activeInterval);
    activeInterval = null;
  }

  isRunning = false;
  void chrome.runtime.sendMessage({
    ...message,
    finishedAt: new Date().toISOString()
  });
}

function reportProgress(watchedSeconds: number, targetSeconds: number): void {
  const payload: VideoWatchProgressMessage = {
    type: 'VIDEO_WATCH_PROGRESS',
    step: 'watch_video',
    message: `已观看 ${Math.min(watchedSeconds, targetSeconds)} / ${targetSeconds} 秒`,
    watchedSeconds,
    targetSeconds
  };

  void chrome.runtime.sendMessage(payload);
}
