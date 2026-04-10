/**
 * Voice debrief wizard — pilot only. Questions are built from GET /scoring/categories (same as EvaluationForm).
 * Optional link from standard eval flow later.
 */

export function isVoiceDebriefPilotEnabled(): boolean {
  return process.env.REACT_APP_ENABLE_VOICE_DEBRIEF_PILOT === 'true';
}

/** Comma-separated roles that see the nav tab when pilot is on. Default: customer-facing reps. */
export function getVoiceDebriefPilotRoles(): string[] {
  const raw =
    process.env.REACT_APP_VOICE_DEBRIEF_PILOT_ROLES || 'SALESPERSON,SALES_LEAD';
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

export function canUseVoiceDebriefPilot(userRole: string | undefined): boolean {
  if (!isVoiceDebriefPilotEnabled() || !userRole) return false;
  return getVoiceDebriefPilotRoles().includes(userRole);
}
