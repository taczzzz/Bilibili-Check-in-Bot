import { VIDEO_URL, VIP_URL } from '../shared/config';
import type { DailyRunState, RunStep } from '../shared/state';

interface StepConfig {
  url: string;
  scriptFile: string;
  focus: boolean;
  closeOnComplete: boolean;
  startState: Extract<DailyRunState, 'watching' | 'claiming'>;
  startMessage: string;
  dispatchFailureMessage: string;
  nextStep?: RunStep;
}

const STEP_CONFIG: Record<RunStep, StepConfig> = {
  watch_video: {
    url: VIDEO_URL,
    scriptFile: 'content/watch-video.js',
    focus: true,
    closeOnComplete: true,
    startState: 'watching',
    startMessage: '开始执行今日任务',
    dispatchFailureMessage: '观看步骤在内容脚本响应前失败',
    nextStep: 'claim_vip'
  },
  claim_vip: {
    url: VIP_URL,
    scriptFile: 'content/claim-vip.js',
    focus: true,
    closeOnComplete: false,
    startState: 'claiming',
    startMessage: '检查签到状态中',
    dispatchFailureMessage: '签到步骤在内容脚本响应前失败'
  }
};

export function getStepConfig(step: RunStep): StepConfig {
  return STEP_CONFIG[step];
}
