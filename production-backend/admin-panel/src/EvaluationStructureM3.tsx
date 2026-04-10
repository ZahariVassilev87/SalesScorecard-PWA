import React, { useEffect, useMemo, useState } from 'react';

type Company = { id: string; name: string; isActive?: boolean };
type SectionSourceView = 'all' | 'salesperson' | 'sales_lead';

type Props = {
  selectedCompanyId: string;
  api: {
    getCompanies: () => Promise<Company[]>;
    getEvaluationStructureConfig: (companyId: string) => Promise<any>;
    getEvaluationStructureHistory: (companyId: string, limit?: number, offset?: number) => Promise<any>;
    getEvaluationStructureDraft: (companyId: string) => Promise<any>;
    saveEvaluationStructureDraft: (companyId: string, evaluationStructure: any) => Promise<any>;
    cloneEvaluationStructureToDraft: (companyId: string, sourceCompanyId: string) => Promise<any>;
    rollbackEvaluationStructureToDraft: (companyId: string, sourceVersionId: string) => Promise<any>;
    batchCloneEvaluationStructureToDraft: (sourceCompanyId: string, targetCompanyIds: string[]) => Promise<any>;
    getEvaluationStructurePreview: (companyId: string) => Promise<any>;
    publishEvaluationStructure: (companyId: string, evaluationStructure: any, confirmReplace?: boolean) => Promise<any>;
  };
};

function safePretty(value: any) {
  return JSON.stringify(value ?? { sections: [] }, null, 2);
}

function normalizePolicyDefaults(section: any) {
  return {
    ...section,
    isScorable: section?.isScorable !== false,
    naAllowed: section?.naAllowed !== false,
  };
}

const EvaluationStructureM3: React.FC<Props> = ({ selectedCompanyId, api }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [config, setConfig] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [draftText, setDraftText] = useState<string>(safePretty({ sections: [] }));

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sourceCompanyId, setSourceCompanyId] = useState('');
  const [batchSourceCompanyId, setBatchSourceCompanyId] = useState('');
  const [batchTargets, setBatchTargets] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [sectionSourceView, setSectionSourceView] = useState<SectionSourceView>('salesperson');

  const loadAll = async () => {
    if (!selectedCompanyId || selectedCompanyId === 'all') return;
    setLoading(true);
    setError('');
    try {
      const [cfg, hist, dr, prev, comps] = await Promise.all([
        api.getEvaluationStructureConfig(selectedCompanyId),
        api.getEvaluationStructureHistory(selectedCompanyId, 20, 0),
        api.getEvaluationStructureDraft(selectedCompanyId),
        api.getEvaluationStructurePreview(selectedCompanyId),
        api.getCompanies(),
      ]);
      setConfig(cfg);
      setHistory(Array.isArray(hist?.items) ? hist.items : []);
      setDraft(dr?.hasDraft ? dr.draft : null);
      setPreview(prev?.preview ?? null);
      setDraftText(safePretty(dr?.hasDraft ? dr.draft : (cfg?.evaluationStructurePreview || { sections: [] })));
      setCompanies(Array.isArray(comps) ? comps : []);
      setBatchResults([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  const companyOptions = useMemo(
    () => companies.filter((c) => c.id && c.id !== selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const parseDraft = () => {
    const parsed = JSON.parse(draftText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Draft must be a JSON object with sections.');
    }
    return parsed;
  };

  const sectionPolicyRows = useMemo(() => {
    try {
      const parsed = parseDraft();
      const sections = Array.isArray(parsed?.sections) ? [...parsed.sections] : [];
      sections.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
      return sections.map((sec: any) => normalizePolicyDefaults(sec));
    } catch {
      return [];
    }
  }, [draftText]);

  const draftSummary = useMemo(() => {
    try {
      const parsed = parseDraft();
      const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
      const criteriaCount = sections.reduce((acc: number, sec: any) => {
        const criteria = Array.isArray(sec?.criteria) ? sec.criteria : [];
        return acc + criteria.length;
      }, 0);
      return { sections: sections.length, criteria: criteriaCount };
    } catch {
      return { sections: 0, criteria: 0 };
    }
  }, [draftText]);

  const updateSectionPolicy = (sectionId: string, patch: { isScorable?: boolean; naAllowed?: boolean }) => {
    try {
      const parsed = parseDraft();
      const sections = Array.isArray(parsed?.sections) ? [...parsed.sections] : [];
      const nextSections = sections.map((sec: any) => {
        if (String(sec?.id || '') !== sectionId) return sec;
        const normalized = normalizePolicyDefaults(sec);
        return {
          ...normalized,
          ...(patch.isScorable !== undefined ? { isScorable: patch.isScorable } : {}),
          ...(patch.naAllowed !== undefined ? { naAllowed: patch.naAllowed } : {}),
        };
      });
      setDraftText(safePretty({ ...parsed, sections: nextSections }));
    } catch (e) {
      setError((e as Error).message || 'Failed to update section policy');
    }
  };

  const getSectionDecisionText = (section: any) => {
    const alwaysEvaluated = section?.naAllowed === false;
    const affectsScore = section?.isScorable !== false;

    if (alwaysEvaluated && affectsScore) {
      return {
        skip: 'Evaluator cannot skip this section. Ratings are required.',
        block: 'Evaluation submission will be blocked if this section is missing.',
        score: 'This section contributes to the final score.',
      };
    }

    if (alwaysEvaluated && !affectsScore) {
      return {
        skip: 'Evaluator cannot skip this section. Ratings are required.',
        block: 'Evaluation submission will be blocked if this section is missing.',
        score: 'This section does not change the final score.',
      };
    }

    if (!alwaysEvaluated && affectsScore) {
      return {
        skip: 'Evaluator can mark this section as N/A when not relevant.',
        block: 'If skipped as N/A with required comment, evaluation can still be submitted.',
        score: 'When evaluated, this section contributes to score. If N/A, it is excluded.',
      };
    }

    return {
      skip: 'Evaluator can mark this section as N/A when not relevant.',
      block: 'If skipped as N/A with required comment, evaluation can still be submitted.',
      score: 'This section never contributes to the final score.',
    };
  };

  const categoryMatchesCase = (categoryName: string, view: SectionSourceView): boolean => {
    if (view === 'all') return true;
    const n = (categoryName || '').toUpperCase();
    const salespersonCore = [
      'PREPARATION BEFORE THE MEETING',
      'PROBLEM DEFINITION',
      'HANDLING OBJECTIONS',
      'COMMERCIAL PROPOSAL',
    ];
    const salesLeadCore = [
      'BEHAVIOR DURING CLIENT MEETING',
      'QUALITY OF ANALYSIS',
      'TRANSLATING INTO ACTION',
    ];

    if (view === 'salesperson') {
      return salespersonCore.some((token) => n.includes(token));
    }
    if (view === 'sales_lead') {
      // Published/template often uses one parent: "Coaching Skills (SALES_LEAD)" with items inside.
      if (n.includes('COACHING SKILLS') || n.includes('SALES_LEAD')) {
        return true;
      }
      return salesLeadCore.some((token) => n.includes(token));
    }
    return true;
  };

  const handleLoadAllClustersFromFormTemplate = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!selectedCompanyId || selectedCompanyId === 'all') {
        throw new Error('Please select a specific company first.');
      }
      const currentDraft = parseDraft();
      const currentSections = Array.isArray(currentDraft?.sections) ? currentDraft.sections : [];
      const currentPolicyBySectionId = new Map<string, { isScorable: boolean; naAllowed: boolean }>();
      for (const s of currentSections) {
        const id = String(s?.id || '');
        if (!id) continue;
        currentPolicyBySectionId.set(id, {
          isScorable: s?.isScorable !== false,
          naAllowed: s?.naAllowed !== false,
        });
      }

      if (typeof (api as any).getCompanyFormTemplate !== 'function') {
        throw new Error('Form template API is unavailable in this build.');
      }
      const loadTemplateCategories = async (companyId: string) => {
        const t = await (api as any).getCompanyFormTemplate(companyId);
        return Array.isArray(t?.categories) ? t.categories : [];
      };

      let templateCategories = await loadTemplateCategories(selectedCompanyId);
      let categories = templateCategories.filter((cat: any) =>
        categoryMatchesCase(String(cat?.name || ''), sectionSourceView)
      );

      // If this company has no form rows yet, use clone source company template (e.g. Metro).
      if (
        categories.length === 0 &&
        sourceCompanyId &&
        sourceCompanyId !== selectedCompanyId
      ) {
        templateCategories = await loadTemplateCategories(sourceCompanyId);
        categories = templateCategories.filter((cat: any) =>
          categoryMatchesCase(String(cat?.name || ''), sectionSourceView)
        );
      }

      // Fallback: if selected company template has no matching categories,
      // use current draft sections (e.g. just-cloned draft) as source.
      if (categories.length === 0) {
        const draftSections = Array.isArray(currentDraft?.sections) ? currentDraft.sections : [];
        const fallbackSections = draftSections.filter((sec: any) =>
          categoryMatchesCase(String(sec?.title || ''), sectionSourceView)
        );
        if (fallbackSections.length > 0) {
          setDraftText(safePretty({ ...currentDraft, sections: fallbackSections }));
          setSuccess(
            `Loaded ${fallbackSections.length} section(s) from current draft (template had no matching categories for this case).`
          );
          return;
        }
        throw new Error('No categories found for this case in template or draft. Try "All categories".');
      }

      const sections = categories.map((cat: any, idx: number) => {
        const sectionId = String(cat?.id || `section-${idx + 1}`);
        const existingPolicy = currentPolicyBySectionId.get(sectionId);
        const items = Array.isArray(cat?.items) ? cat.items : [];
        const criteria = items.map((item: any, itemIdx: number) => ({
          id: String(item?.id || `${sectionId}-criterion-${itemIdx + 1}`),
          order: Number(item?.order ?? itemIdx),
          behaviorItemId: String(item?.id || `${sectionId}-behavior-${itemIdx + 1}`),
        }));
        return {
          id: sectionId,
          title: String(cat?.name || `Section ${idx + 1}`),
          order: Number(cat?.order ?? idx),
          isScorable: existingPolicy ? existingPolicy.isScorable : true,
          naAllowed: existingPolicy ? existingPolicy.naAllowed : true,
          criteria,
        };
      });

      setDraftText(safePretty({ ...currentDraft, sections }));
      setSuccess(`Loaded ${sections.length} section(s) for this case. Review and click "Save draft".`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const parsed = parseDraft();
      await api.saveEvaluationStructureDraft(selectedCompanyId, parsed);
      setSuccess('Draft saved.');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const parsed = parseDraft();
      try {
        await api.publishEvaluationStructure(selectedCompanyId, parsed, false);
      } catch (e) {
        const msg = (e as Error).message || '';
        if (msg.includes('409') && window.confirm('A published version exists. Replace with a new version?')) {
          await api.publishEvaluationStructure(selectedCompanyId, parsed, true);
        } else {
          throw e;
        }
      }
      setSuccess('Published successfully.');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloneToDraft = async () => {
    if (!sourceCompanyId) {
      setError('Select source company first.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.cloneEvaluationStructureToDraft(selectedCompanyId, sourceCompanyId);
      // Keep full published structure — do not strip by case (that removed Sales Lead / mixed sections).
      setSuccess('Cloned into draft (not published). Full structure from source — use Evaluation case only when loading clusters from template.');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRollbackToDraft = async (versionId: string) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.rollbackEvaluationStructureToDraft(selectedCompanyId, versionId);
      setSuccess('Rollback version copied to draft (not published).');
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchClone = async () => {
    if (!batchSourceCompanyId || batchTargets.length === 0) {
      setError('Select source and at least one target company.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.batchCloneEvaluationStructureToDraft(batchSourceCompanyId, batchTargets);
      setBatchResults(Array.isArray(result?.results) ? result.results : []);
      setSuccess('Batch clone finished. Review per-company results.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-section company-config-card">
      <h4>Evaluation Setup</h4>
      <p className="config-hint">Use this page in 3 simple steps: prepare draft, review, then publish.</p>

      {loading ? <div className="loading">Loading structure lifecycle data...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="config-callout">
        <p><strong>Current live version:</strong> {config?.hasPublishedStructure ? `v${config?.currentVersionSummary?.version || '?'}` : 'none'}</p>
        <p><strong>Draft in progress:</strong> {draft ? 'yes (not live yet)' : 'none'}</p>
        <p><strong>Draft content:</strong> {draftSummary.sections} sections, {draftSummary.criteria} criteria</p>
      </div>

      <div className="config-callout" style={{ marginBottom: '0.75rem' }}>
        <p><strong>Step 1:</strong> Choose what each section allows (scoring and N/A).</p>
        <p><strong>Step 2:</strong> Save draft and review preview.</p>
        <p><strong>Step 3:</strong> Publish when ready (only publish makes it live).</p>
        <button
          className="action-button subtle"
          type="button"
          onClick={handleLoadAllClustersFromFormTemplate}
          disabled={saving || loading}
          style={{ marginTop: '0.5rem' }}
        >
          Load all clusters for selected case
        </button>
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Evaluation case</label>
          <select value={sectionSourceView} onChange={(e) => setSectionSourceView(e.target.value as SectionSourceView)}>
            <option value="salesperson">Salesperson (4 core clusters)</option>
            <option value="sales_lead">Sales Lead coaching</option>
            <option value="all">All categories</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Step 1 - Decide behavior per section</label>
        <p className="config-hint">
          Answer two business questions for each section.
        </p>
        {sectionPolicyRows.length === 0 ? (
          <p className="config-hint">No sections found in draft. Use "Clone from company" below to start from an existing setup.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {sectionPolicyRows.map((sec: any) => (
              <div key={sec.id} className="config-callout">
                <div>
                  <strong>{sec.title || sec.id}</strong>
                </div>
                <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      1) Should this section always be evaluated?
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <label className="checkbox-row inline">
                        <input
                          type="radio"
                          name={`required-${sec.id}`}
                          checked={sec.naAllowed === false}
                          onChange={() => updateSectionPolicy(sec.id, { naAllowed: false })}
                        />
                        Yes (always required)
                      </label>
                      <label className="checkbox-row inline">
                        <input
                          type="radio"
                          name={`required-${sec.id}`}
                          checked={sec.naAllowed !== false}
                          onChange={() => updateSectionPolicy(sec.id, { naAllowed: true })}
                        />
                        No (can be marked N/A)
                      </label>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      2) Does this section affect the final score?
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <label className="checkbox-row inline">
                        <input
                          type="radio"
                          name={`scorable-${sec.id}`}
                          checked={sec.isScorable !== false}
                          onChange={() => updateSectionPolicy(sec.id, { isScorable: true })}
                        />
                        Yes
                      </label>
                      <label className="checkbox-row inline">
                        <input
                          type="radio"
                          name={`scorable-${sec.id}`}
                          checked={sec.isScorable === false}
                          onChange={() => updateSectionPolicy(sec.id, { isScorable: false })}
                        />
                        No
                      </label>
                    </div>
                  </div>

                  <div style={{ background: '#f7f8fa', border: '1px solid #e4e6eb', borderRadius: 8, padding: '0.55rem 0.7rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>What this means in practice</div>
                    <div style={{ fontSize: '0.92rem' }}>- {getSectionDecisionText(sec).skip}</div>
                    <div style={{ fontSize: '0.92rem' }}>- {getSectionDecisionText(sec).block}</div>
                    <div style={{ fontSize: '0.92rem' }}>- {getSectionDecisionText(sec).score}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="header-actions" style={{ marginBottom: '1rem' }}>
        <button className="action-button" onClick={handleSaveDraft} disabled={saving || loading}>Step 2 - Save draft</button>
        <button className="action-button success" onClick={handlePublish} disabled={saving || loading}>Step 3 - Publish (make live)</button>
        <button className="refresh-button" onClick={loadAll} disabled={saving || loading}>Refresh</button>
      </div>

      <details style={{ marginBottom: '1rem' }}>
        <summary>Preview of what users will get (draft first, then published)</summary>
        <pre className="metadata-preview-json" style={{ marginTop: '0.5rem', maxHeight: '260px', overflow: 'auto' }}>
          {safePretty(preview)}
        </pre>
      </details>

      <div className="form-group">
        <label>Quick start - copy setup from another company</label>
        <select value={sourceCompanyId} onChange={(e) => setSourceCompanyId(e.target.value)}>
          <option value="">Select source company</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
          ))}
        </select>
        <button className="action-button" onClick={handleCloneToDraft} disabled={saving || loading}>Clone to draft</button>
      </div>

      <details style={{ marginBottom: '1rem' }}>
        <summary>Advanced tools (history, rollback, batch clone)</summary>

        <div className="form-group" style={{ marginTop: '0.75rem' }}>
          <label>Published version history</label>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {history.map((h: any) => (
              <div key={h.versionId} className="config-callout">
                <div>
                  <strong>v{h.version}</strong> — {h.sectionCount} sections, {h.criterionCount} criteria
                  {h.publishedAt ? ` — ${new Date(h.publishedAt).toLocaleString()}` : ''}
                </div>
                <button className="action-button subtle" onClick={() => handleRollbackToDraft(h.versionId)} disabled={saving || loading}>
                  Copy this version to draft
                </button>
              </div>
            ))}
            {history.length === 0 ? <p className="config-hint">No published versions yet.</p> : null}
          </div>
        </div>

        <div className="form-group">
          <label>Batch copy to multiple company drafts</label>
          <select value={batchSourceCompanyId} onChange={(e) => setBatchSourceCompanyId(e.target.value)}>
            <option value="">Select source company</option>
            {companyOptions.map((c) => (
              <option key={`source-${c.id}`} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px,1fr))', gap: '0.25rem', margin: '0.5rem 0' }}>
            {companyOptions.map((c) => (
              <label key={`target-${c.id}`} className="checkbox-row inline">
                <input
                  type="checkbox"
                  checked={batchTargets.includes(c.id)}
                  onChange={() =>
                    setBatchTargets((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                    )
                  }
                />
                {c.name} ({c.id})
              </label>
            ))}
          </div>
          <button className="action-button" onClick={handleBatchClone} disabled={saving || loading}>Run batch clone</button>
          {batchResults.length > 0 ? (
            <pre className="metadata-preview-json" style={{ marginTop: '0.5rem', maxHeight: '220px', overflow: 'auto' }}>
              {safePretty(batchResults)}
            </pre>
          ) : null}
        </div>

      </details>
    </div>
  );
};

export default EvaluationStructureM3;
