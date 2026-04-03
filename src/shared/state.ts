export type DailyRunState =
  | 'idle'
  | 'watching'
  | 'claiming'
  | 'success'
  | 'failed'
  | 'needs_login';

export type RunStep = 'watch_video' | 'claim_vip';
export type RunTrigger = 'manual' | 'alarm' | 'startup';

export interface LastResult {
  startedAt?: string;
  finishedAt?: string;
  step: RunStep;
  message: string;
  trigger?: RunTrigger;
}

export interface DailyRunSnapshot {
  dailyRunDate?: string;
  dailyRunState: DailyRunState;
  lastResult?: LastResult;
}

export interface TaskAutomationSettings {
  bilibiliVipDailyEnabled: boolean;
}

export interface ActiveRunContext {
  trigger: RunTrigger;
  step: RunStep;
  tabIds: Partial<Record<RunStep, number>>;
}

export const DEFAULT_SNAPSHOT: DailyRunSnapshot = {
  dailyRunState: 'idle'
};

export const DEFAULT_TASK_AUTOMATION_SETTINGS: TaskAutomationSettings = {
  bilibiliVipDailyEnabled: true
};

export const STATUS_LABELS: Record<DailyRunState, string> = {
  idle: '未运行',
  watching: '观看中',
  claiming: '检查签到中',
  success: '已签到',
  failed: '签到失败',
  needs_login: '需要登录'
};

export const TRIGGER_LABELS: Record<RunTrigger, string> = {
  manual: '手动执行',
  alarm: '定时自动执行',
  startup: '启动补跑'
};
