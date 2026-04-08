/**
 * Phase 1A — company scoping helpers (parity with previous server.js).
 */

function createCompanyContextHelpers(defaultCompanyId) {
  /**
   * Resolve company context for a request.
   * - Non super-admins are always scoped to their own company.
   * - Super-admins can pass ?companyId=<id> (or "all") on the query string,
   *   or provide companyId in the request body / header.
   */
  function resolveCompanyContext(req) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    const queryCompanyId =
      typeof req.query?.companyId === 'string' ? req.query.companyId.trim() : undefined;
    const bodyCompanyId =
      typeof req.body === 'object' && req.body !== null && typeof req.body.companyId === 'string'
        ? req.body.companyId.trim()
        : undefined;
    const headerCompanyId =
      typeof req.headers['x-company-id'] === 'string' ? req.headers['x-company-id'].trim() : undefined;

    const explicitCompanyId = queryCompanyId || bodyCompanyId || headerCompanyId;

    if (isSuperAdmin) {
      if (explicitCompanyId && explicitCompanyId.toLowerCase() === 'all') {
        return { companyId: null, includeAllCompanies: true };
      }
      if (explicitCompanyId) {
        return { companyId: explicitCompanyId, includeAllCompanies: false };
      }
      return { companyId: null, includeAllCompanies: true };
    }

    return {
      companyId: req.user?.companyId || defaultCompanyId,
      includeAllCompanies: false,
    };
  }

  function normalizeCompanyId(rawId) {
    if (typeof rawId !== 'string') {
      return null;
    }
    const trimmed = rawId.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_-]+$/.test(normalized)) {
      return null;
    }
    return normalized;
  }

  function slugifyCompanyName(rawName) {
    if (typeof rawName !== 'string') {
      return null;
    }
    const slug = rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    return slug || null;
  }

  return { resolveCompanyContext, normalizeCompanyId, slugifyCompanyName };
}

module.exports = { createCompanyContextHelpers };
