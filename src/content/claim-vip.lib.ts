const TARGET_TEXTS = ['会员观看任意1个视频即可领取', '会员观看任意1个视频可领取'] as const;
const CLAIM_ACTION_TEXTS = ['去领取', '领取'] as const;
const COMPLETED_TEXTS = [
  '已领取',
  '已签到',
  '已经领取',
  '今日已领取',
  '今日已签到',
  '今日已经领取',
  '今天已领取',
  '今天已经领取',
  '明日再来',
  '已完成',
  '已达上限'
] as const;

const STATUS_SIGNAL_RULES = [
  {
    status: 'already_signed',
    texts: [
      '已经领取过了哦',
      '已经领取过了',
      '已领取过了',
      '领取过了',
      '今日已领取',
      '今天已领取',
      '今天已经领取',
      '今日已经领取'
    ]
  },
  {
    status: 'success',
    texts: ['签到成功', '领取成功']
  },
  {
    status: 'failed',
    texts: ['签到失败', '领取失败', '请稍后再试', '系统繁忙', '网络繁忙', '领取异常']
  }
] as const satisfies ReadonlyArray<{
  status: Exclude<VipClaimStatus, 'claimable' | 'unknown'>;
  texts: readonly string[];
}>;

type KnownVipClaimStatus = (typeof STATUS_SIGNAL_RULES)[number]['status'];

export type VipClaimStatus = 'claimable' | 'success' | 'already_signed' | 'failed' | 'unknown';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '');
}

export function isVipPageLoginRequired(doc: Document): boolean {
  const text = normalizeText(doc.body?.textContent ?? '');

  return text.includes('立即登录') && (text.includes('扫码登录') || text.includes('密码登录'));
}

export function findVipCard(doc: Document): HTMLElement | null {
  const actionAnchoredCards = findClaimActionElements(doc)
    .map((action) => findNearestTargetCardForAction(action))
    .filter((card): card is HTMLElement => card !== null);

  if (actionAnchoredCards.length > 0) {
    return pickMostSpecificCard(actionAnchoredCards);
  }

  const completedCards = findTargetTextContainers(doc)
    .map((container) => findNearestCompletedCardForCopy(container))
    .filter((card): card is HTMLElement => card !== null);

  return pickMostSpecificCard(completedCards);
}

export function findClaimButton(root: ParentNode | null): HTMLElement | null {
  if (!root) {
    return null;
  }

  return findClaimActionElements(root)[0] ?? null;
}

export function triggerClaimAction(button: HTMLElement): void {
  button.click();
}

export function isVipCardCompleted(root: ParentNode | null): boolean {
  if (!root) {
    return false;
  }

  return hasCompletedState(root as HTMLElement) && !findClaimButton(root);
}

export function getVipClaimStatus(doc: Document, root: ParentNode | null): VipClaimStatus {
  if (isVipCardCompleted(root)) {
    return 'already_signed';
  }

  const matchedStatus = resolveStatusSignal({
    page: getNormalizedText(doc.body),
    card: getNormalizedText(root)
  });

  if (matchedStatus) {
    return matchedStatus;
  }

  if (findClaimButton(root)) {
    return 'claimable';
  }

  return 'unknown';
}

export function formatSignedDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function hasCompletedState(root: HTMLElement): boolean {
  return containsAny(getNormalizedText(root), COMPLETED_TEXTS);
}

function findClaimActionElements(root: ParentNode): HTMLElement[] {
  const elements: HTMLElement[] = [];

  if (root instanceof HTMLElement && isClaimActionElement(root)) {
    elements.push(root);
  }

  for (const element of root.querySelectorAll<HTMLElement>('button, a, div, span')) {
    if (isClaimActionElement(element)) {
      elements.push(element);
    }
  }

  return elements;
}

function findTargetTextContainers(root: ParentNode): HTMLElement[] {
  const containers: HTMLElement[] = [];

  for (const element of root.querySelectorAll<HTMLElement>('div, section, article, li, p, span')) {
    if (containsTargetCopy(element)) {
      containers.push(element);
    }
  }

  return containers;
}

function findNearestTargetCardForAction(action: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = action;

  while (current && current !== document.body) {
    if (containsTargetCopy(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findNearestCompletedCardForCopy(container: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = container;

  while (current && current !== document.body) {
    if (hasCompletedState(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function pickMostSpecificCard(cards: HTMLElement[]): HTMLElement | null {
  const unique = Array.from(new Set(cards));

  unique.sort((left, right) => {
    const leftLength = normalizeText(left.textContent ?? '').length;
    const rightLength = normalizeText(right.textContent ?? '').length;

    if (leftLength !== rightLength) {
      return leftLength - rightLength;
    }

    return getElementDepth(right) - getElementDepth(left);
  });

  return unique[0] ?? null;
}

function isClaimActionElement(element: HTMLElement): boolean {
  const text = getNormalizedText(element);

  if (containsTargetCopy(element)) {
    return false;
  }

  return containsAny(text, CLAIM_ACTION_TEXTS) && !containsAny(text, COMPLETED_TEXTS) && text.length <= 8;
}

function containsTargetCopy(element: HTMLElement): boolean {
  return containsAny(getNormalizedText(element), TARGET_TEXTS);
}

function getElementDepth(element: HTMLElement): number {
  let depth = 0;
  let current: HTMLElement | null = element;

  while (current?.parentElement) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function getNormalizedText(node: ParentNode | null): string {
  if (!node) {
    return '';
  }

  const text =
    node instanceof Document
      ? node.body?.textContent ?? ''
      : node instanceof HTMLElement
        ? node.textContent ?? ''
        : node.textContent ?? '';

  return normalizeText(text);
}

function containsAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function resolveStatusSignal(texts: { page: string; card: string }): KnownVipClaimStatus | null {
  for (const rule of STATUS_SIGNAL_RULES) {
    if (containsAny(texts.page, rule.texts) || containsAny(texts.card, rule.texts)) {
      return rule.status;
    }
  }

  return null;
}
