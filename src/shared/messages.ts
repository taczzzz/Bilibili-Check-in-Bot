import type { RunStep, RunTrigger } from './state';
export type { RunTrigger } from './state';

export interface RunDailyMessage {
  type: 'RUN_BILIBILI_DAILY';
  step?: RunStep;
  trigger?: RunTrigger;
}

export interface RunDailyResponse {
  accepted: true;
  started: boolean;
  reason?: 'already_completed_today' | 'active_run' | 'before_schedule' | 'automation_disabled';
  message: string;
}

interface StepResultBase {
  ok: boolean;
  needsLogin?: boolean;
  step: RunStep;
  message: string;
  finishedAt?: string;
}

export interface StepAcceptedMessage {
  accepted: true;
}

export interface VideoWatchProgressMessage {
  type: 'VIDEO_WATCH_PROGRESS';
  step: 'watch_video';
  message: string;
  watchedSeconds?: number;
  targetSeconds?: number;
}

export interface VideoWatchResultMessage extends StepResultBase {
  type: 'VIDEO_WATCH_RESULT';
  watchedSeconds?: number;
}

export interface VipClaimResultMessage extends StepResultBase {
  type: 'VIP_CLAIM_RESULT';
}

export type ExtensionMessage =
  | RunDailyMessage
  | VideoWatchProgressMessage
  | VideoWatchResultMessage
  | VipClaimResultMessage;

export function isRunDailyMessage(message: unknown): message is RunDailyMessage {
  return typeof message === 'object' && message !== null && (message as RunDailyMessage).type === 'RUN_BILIBILI_DAILY';
}

export function isVideoWatchResultMessage(message: unknown): message is VideoWatchResultMessage {
  return typeof message === 'object' && message !== null && (message as VideoWatchResultMessage).type === 'VIDEO_WATCH_RESULT';
}

export function isVideoWatchProgressMessage(message: unknown): message is VideoWatchProgressMessage {
  return typeof message === 'object' && message !== null && (message as VideoWatchProgressMessage).type === 'VIDEO_WATCH_PROGRESS';
}

export function isVipClaimResultMessage(message: unknown): message is VipClaimResultMessage {
  return typeof message === 'object' && message !== null && (message as VipClaimResultMessage).type === 'VIP_CLAIM_RESULT';
}
