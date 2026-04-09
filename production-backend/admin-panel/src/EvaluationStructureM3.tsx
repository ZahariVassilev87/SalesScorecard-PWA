import React, { useEffect, useMemo, useState } from 'react';

type Company = { id: string; name: string; isActive?: boolean };

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
      setSuccess('Cloned into draft (not published).');
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
      <h4>Evaluation Structure (Milestone 3D)</h4>
      <p className="config-hint">Draft-first lifecycle: clone/rollback write draft only. Publish is always explicit.</p>

      {loading ? <div className="loading">Loading structure lifecycle data...</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      {success ? <div className="success-message">{success}</div> : null}

      <div className="config-callout">
        <p><strong>Published:</strong> {config?.hasPublishedStructure ? `v${config?.currentVersionSummary?.version || '?'}` : 'none'}</p>
        <p><strong>Draft:</strong> {draft ? 'available (unpublished)' : 'none'}</p>
      </div>

      <div className="form-group">
        <label>Draft JSON (single mutable draft)</label>
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={16}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </div>

      <div className="header-actions" style={{ marginBottom: '1rem' }}>
        <button className="action-button" onClick={handleSaveDraft} disabled={saving || loading}>Save draft</button>
        <button className="action-button success" onClick={handlePublish} disabled={saving || loading}>Publish draft payload</button>
        <button className="refresh-button" onClick={loadAll} disabled={saving || loading}>Refresh</button>
      </div>

      <details style={{ marginBottom: '1rem' }}>
        <summary>Preview (draft if present, else published)</summary>
        <pre className="metadata-preview-json" style={{ marginTop: '0.5rem', maxHeight: '260px', overflow: 'auto' }}>
          {safePretty(preview)}
        </pre>
      </details>

      <div className="form-group">
        <label>Clone from company to current draft</label>
        <select value={sourceCompanyId} onChange={(e) => setSourceCompanyId(e.target.value)}>
          <option value="">Select source company</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
          ))}
        </select>
        <button className="action-button" onClick={handleCloneToDraft} disabled={saving || loading}>Clone to draft</button>
      </div>

      <div className="form-group">
        <label>Published version history</label>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {history.map((h: any) => (
            <div key={h.versionId} className="config-callout">
              <div>
                <strong>v{h.version}</strong> — {h.sectionCount} sections, {h.criterionCount} criteria
                {h.publishedAt ? ` — ${new Date(h.publishedAt).toLocaleString()}` : ''}
              </div>
              <button className="action-button subtle" onClick={() => handleRollbackToDraft(h.versionId)} disabled={saving || loading}>
                Rollback to draft
              </button>
            </div>
          ))}
          {history.length === 0 ? <p className="config-hint">No published versions yet.</p> : null}
        </div>
      </div>

      <div className="form-group">
        <label>Batch clone to drafts (partial-success safe)</label>
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
    </div>
  );
};

export default EvaluationStructureM3;
