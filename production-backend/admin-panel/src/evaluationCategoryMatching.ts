/**
 * Single source of truth for matching evaluation form category names to "case"
 * (salesperson clusters vs RM→sales-lead coaching). Keeps admin Company config
 * preview, Metro baseline loader, and Evaluation Setup in sync.
 */

export const SALESPERSON_EVALUATION_CORE_TOKENS = [
  'PREPARATION BEFORE THE MEETING',
  'PROBLEM DEFINITION',
  'HANDLING OBJECTIONS',
  'COMMERCIAL PROPOSAL',
] as const;

/** Used with /scoring/categories HIGH_SHARE naming. */
export function isSalespersonHighShareCategoryName(categoryName: string): boolean {
  const u = (categoryName || '').toUpperCase();
  return u.includes('HIGH_SHARE') || u.includes('HIGH SHARE');
}

export function matchesSalespersonEvaluationCoreCategory(categoryName: string): boolean {
  const u = (categoryName || '').toUpperCase();
  return SALESPERSON_EVALUATION_CORE_TOKENS.some((t) => u.includes(t));
}

/**
 * Sales-lead / RM coaching rows: often titled by English pillars, BG titles,
 * "Coaching Skills (SALES_LEAD)", or SALES_LEAD with space/hyphen variants.
 */
export function matchesSalesLeadEvaluationCategory(categoryName: string): boolean {
  const u = (categoryName || '').toUpperCase();

  const hasSalesLeadSlug =
    u.includes('SALES_LEAD') || u.includes('SALES LEAD') || u.includes('SALES-LEAD');
  const hasCoachingSkills = u.includes('COACHING SKILLS') || u.includes('COACHING SKILL');
  const hasEnglishPillar =
    u.includes('BEHAVIOR DURING CLIENT MEETING') ||
    u.includes('QUALITY OF ANALYSIS') ||
    u.includes('TRANSLATING INTO ACTION') ||
    u.includes('PRE-MEETING COACHING') ||
    u.includes('PRE MEETING COACHING');
  const hasBgPillar =
    u.includes('ПОВЕДЕНИЕ ПО ВРЕМЕ') ||
    u.includes('ПРЕВРЪЩАНЕ В ДЕЙСТВИЕ') ||
    u.includes('АНАЛИЗ И ОБРАТНА') ||
    u.includes('ПРЕДВАРИТЕЛЕН КОУЧИНГ');

  return (
    hasSalesLeadSlug || hasCoachingSkills || hasEnglishPillar || hasBgPillar
  );
}

export type StructureSectionSourceView = 'all' | 'salesperson' | 'sales_lead';

export function categoryMatchesStructureSectionSource(
  categoryName: string,
  view: StructureSectionSourceView
): boolean {
  if (view === 'all') return true;
  if (view === 'sales_lead') {
    return matchesSalesLeadEvaluationCategory(categoryName);
  }
  return matchesSalespersonEvaluationCoreCategory(categoryName);
}
