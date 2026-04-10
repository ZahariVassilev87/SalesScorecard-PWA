/**
 * Evaluation UI toggles (build-time via .env).
 * For companies that do not use low/mid/high share tiers: hide the selector and fix the default.
 */

export const hideEvaluationCustomerTypeSelector =
  process.env.REACT_APP_HIDE_EVALUATION_CUSTOMER_TYPE === 'true';

/** EvaluationForm → /scoring/categories?customerType= */
export type ApiCustomerTypeParam = 'low-share' | 'mid-share' | 'high-share';

export function getDefaultApiCustomerType(): ApiCustomerTypeParam {
  const v = (process.env.REACT_APP_DEFAULT_CUSTOMER_TYPE || 'low-share').toLowerCase();
  if (v === 'mid-share' || v === 'high-share') return v;
  return 'low-share';
}

/** SalespersonEvaluationForm internal + submission payload */
export type SalespersonCustomerType = 'LOW_SHARE' | 'MID_SHARE' | 'HIGH_SHARE';

export function getDefaultSalespersonCustomerType(): SalespersonCustomerType {
  const v = (process.env.REACT_APP_DEFAULT_CUSTOMER_TYPE_SALESPERSON || 'LOW_SHARE').toUpperCase();
  if (v === 'MID_SHARE' || v === 'HIGH_SHARE') return v as SalespersonCustomerType;
  return 'LOW_SHARE';
}
