/** Dev-only: AI playground tab in the PWA (calls backend /dev/ai/*). Never enable in production builds for real users. */

export function isDevAiPanelEnabled(): boolean {
  return process.env.REACT_APP_ENABLE_DEV_AI_PANEL === 'true';
}
