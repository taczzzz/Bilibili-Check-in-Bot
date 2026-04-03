export interface WatchTargets {
  video: HTMLVideoElement | null;
  playerArea: HTMLElement | null;
}

export function findWatchTargets(doc: Document): WatchTargets {
  const video = doc.querySelector('video');
  const playerArea =
    doc.querySelector<HTMLElement>('.bpx-player-video-area') ??
    doc.querySelector<HTMLElement>('.bpx-player-container') ??
    doc.querySelector<HTMLElement>('#bilibili-player');

  return {
    video,
    playerArea
  };
}

export function createWatchTracker(targetSeconds: number) {
  let accumulated = 0;
  let currentTargetSeconds = targetSeconds;
  const completionToleranceSeconds = 1;

  return {
    recordTick(deltaSeconds: number): boolean {
      if (deltaSeconds > 0) {
        accumulated += deltaSeconds;
      }

      return accumulated >= currentTargetSeconds;
    },
    setTarget(nextTargetSeconds: number): void {
      currentTargetSeconds = Math.min(currentTargetSeconds, nextTargetSeconds);
    },
    isComplete(playback: { currentTime: number; ended: boolean }): boolean {
      if (accumulated >= currentTargetSeconds) {
        return true;
      }

      if (!playback.ended) {
        return false;
      }

      return playback.currentTime >= currentTargetSeconds - completionToleranceSeconds;
    },
    getAccumulated(): number {
      return accumulated;
    },
    getTarget(): number {
      return currentTargetSeconds;
    }
  };
}

export function resolveWatchTargetSeconds(
  defaultTargetSeconds: number,
  durationSeconds: number,
  currentTargetSeconds = defaultTargetSeconds
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return currentTargetSeconds;
  }

  return Math.min(currentTargetSeconds, defaultTargetSeconds, Math.ceil(durationSeconds));
}
