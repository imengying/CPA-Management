import { normalizePlanType } from './parsers';

/**
 * Codex 套餐档位 → 徽章样式的纯映射。
 *
 * - elite   → 液态铂金（Pro 20x，plan=pro；紧凑卡片使用普通文字）
 * - premium → 金卡徽章（Pro Lite / Business Premium；Antigravity ultra / xAI paid 亦复用金卡类名）
 * - plain   → 普通文字徽章（plus/team/free/未知）
 */
type CodexPlanTier = 'elite' | 'premium' | 'plain';

const PREMIUM_CODEX_PLAN_TYPES = new Set([
  'prolite',
  'pro-lite',
  'pro_lite',
  // Business Premium（自助企业版）享受与 Pro Lite 同档的金卡待遇。
  // 仅精确匹配此枚举值：usage_based 等其它 business 档位不得被顺带升级。
  'self_serve_business_prolite',
]);

// Pro 20x（plan=pro）在金色 premium 之上再进一档：液态铂金。
const ELITE_CODEX_PLAN_TYPE = 'pro';

export function resolvePlanTier(planType: string | null | undefined): CodexPlanTier {
  const normalized = normalizePlanType(planType);
  if (!normalized) return 'plain';
  if (normalized === ELITE_CODEX_PLAN_TYPE) return 'elite';
  if (PREMIUM_CODEX_PLAN_TYPES.has(normalized)) return 'premium';
  return 'plain';
}
