/**
 * Phase 2A — pure DTO shaping for GET /evaluations/my response rows.
 * No DB, no company scoping, no access-control branching.
 */

const OLD_ID_MAPPINGS = {
  'coaching_communication': { name: 'Effective Communication', category: 'Coaching Skills' },
  'coaching_development': { name: 'Team Development', category: 'Leadership' },
  'coaching_performance': { name: 'Performance Management', category: 'Management' },
  'coaching_strategy': { name: 'Strategic Planning', category: 'Strategy' },

  'sales_prospecting': { name: 'Prospecting Skills', category: 'Sales Process' },
  'sales_presentation': { name: 'Presentation Skills', category: 'Sales Process' },
  'sales_negotiation': { name: 'Negotiation Skills', category: 'Sales Process' },
  'sales_relationship': { name: 'Relationship Building', category: 'Customer Management' },
  'sales_productivity': { name: 'Productivity & Organization', category: 'Performance' },
  'sales_adaptability': { name: 'Adaptability & Learning', category: 'Growth' },

  'obs1': { name: 'Let salesperson lead the conversation', category: 'Observation & Intervention During Client Meeting' },
  'obs2': { name: 'Provided support when needed', category: 'Observation & Intervention During Client Meeting' },
  'obs3': { name: 'Stepped in with added value at right time', category: 'Observation & Intervention During Client Meeting' },
  'obs4': { name: 'Actively listened to client and salesperson', category: 'Observation & Intervention During Client Meeting' },
  'env1': { name: 'Ensured calm and safe atmosphere', category: 'Creating Coaching Environment' },
  'env2': { name: 'Asked salesperson for self-assessment / feelings', category: 'Creating Coaching Environment' },
  'env3': { name: 'Listened attentively without interrupting', category: 'Creating Coaching Environment' },
  'fb1': { name: 'Started with positive practices', category: 'Quality of Analysis & Feedback' },
  'fb2': { name: 'Gave concrete examples from client meeting', category: 'Quality of Analysis & Feedback' },
  'fb3': { name: 'Identified areas for improvement with examples', category: 'Quality of Analysis & Feedback' },
  'act1': { name: 'Set clear tasks for a specific period', category: 'Translating Into Action' },
  'act2': { name: 'Reached agreement on evaluation and next steps', category: 'Translating Into Action' },
  'act3': { name: 'Encouraged salesperson to set a personal goal/commitment', category: 'Translating Into Action' }
};

function mapItemRowToMyEvaluationItem(item) {
  let behaviorItemName = item.behavior_item_name;
  let categoryName = item.category_name;

  if (!behaviorItemName && item.comment) {
    try {
      const metadata = JSON.parse(item.comment);
      if (metadata.itemName) behaviorItemName = metadata.itemName;
      if (metadata.categoryName) categoryName = metadata.categoryName;
    } catch (e) {
      // Comment is not JSON, continue to check mappings
    }
  }

  if (!behaviorItemName || behaviorItemName === item.behaviorItemId || !categoryName) {
    const mapping = OLD_ID_MAPPINGS[item.behaviorItemId];
    if (mapping) {
      if (!behaviorItemName) behaviorItemName = mapping.name;
      if (!categoryName) categoryName = mapping.category;
    }
  }

  return {
    id: item.id,
    behaviorItemId: item.behaviorItemId,
    behaviorItem: {
      id: item.behaviorItemId,
      name: behaviorItemName || item.behaviorItemId,
      category: { name: categoryName || 'Unknown Category' }
    },
    rating: item.rating,
    comment: item.comment
  };
}

function getFallbackLabelForBehaviorItem(item) {
  if (item.behavior_item_name && String(item.behavior_item_name).trim()) {
    return String(item.behavior_item_name).trim();
  }
  const mapping = OLD_ID_MAPPINGS[item.behaviorItemId];
  if (mapping?.name) return mapping.name;
  return item.behaviorItemId;
}

function buildResultView({ evalRow, itemRows, pinnedStructureRow }) {
  const pinnedId = evalRow.evaluationStructureVersionId || null;
  if (!pinnedId) {
    return {
      legacy: true,
      structureVersionId: null,
    };
  }

  if (!pinnedStructureRow || !pinnedStructureRow.evaluationStructure) {
    return {
      legacy: true,
      structureVersionId: pinnedId,
      structureMissing: true,
      unmappedItems: (itemRows || []).map((item) => ({
        behaviorItemId: item.behaviorItemId,
        label: getFallbackLabelForBehaviorItem(item),
        rating: item.rating,
        comment: item.comment || '',
      })),
    };
  }

  const structure = pinnedStructureRow.evaluationStructure;
  const sections = Array.isArray(structure?.sections) ? [...structure.sections] : [];
  sections.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));

  const itemsByBehaviorId = new Map();
  for (const item of itemRows || []) {
    const key = item.behaviorItemId;
    if (!itemsByBehaviorId.has(key)) itemsByBehaviorId.set(key, []);
    itemsByBehaviorId.get(key).push(item);
  }

  const usedItemIds = new Set();
  const renderedSections = sections.map((sec) => {
    const crits = Array.isArray(sec?.criteria) ? [...sec.criteria] : [];
    crits.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));

    const criteria = crits.map((c) => {
      const behaviorItemId = String(c?.behaviorItemId || '');
      const candidates = itemsByBehaviorId.get(behaviorItemId) || [];
      const match = candidates.find((r) => !usedItemIds.has(r.id)) || null;
      if (match) usedItemIds.add(match.id);

      const fallbackLabel = match ? getFallbackLabelForBehaviorItem(match) : behaviorItemId;
      const label = typeof c?.label === 'string' && c.label.trim() ? c.label.trim() : fallbackLabel;

      return {
        id: c?.id || null,
        behaviorItemId,
        label,
        rating: match ? match.rating : null,
        comment: match ? (match.comment || '') : '',
      };
    });

    const rated = criteria.filter((c) => typeof c.rating === 'number');
    const score = rated.length > 0 ? rated.reduce((sum, c) => sum + c.rating, 0) / rated.length : null;

    return {
      id: sec?.id || null,
      title: sec?.title || 'Untitled Section',
      score,
      criteria,
    };
  });

  const unmappedItems = (itemRows || [])
    .filter((item) => !usedItemIds.has(item.id))
    .map((item) => ({
      behaviorItemId: item.behaviorItemId,
      label: getFallbackLabelForBehaviorItem(item),
      rating: item.rating,
      comment: item.comment || '',
    }));

  const result = {
    legacy: false,
    structureVersionId: pinnedId,
    sections: renderedSections,
  };
  if (unmappedItems.length > 0) {
    result.unmappedItems = unmappedItems;
  }
  return result;
}

/**
 * @param evalRow — row from evaluations list query (with joined salesperson/manager aliases)
 * @param itemRows — rows from evaluation_items query for this evaluation
 * @param user — req.user (for manager role fallback when manager is current user)
 */
function mapMyEvaluationDto(evalRow, itemRows, user, options = {}) {
  return {
    id: evalRow.id,
    salespersonId: evalRow.salespersonId,
    salesperson: {
      id: evalRow.salespersonId,
      displayName: evalRow.salesperson_name,
      firstName: evalRow.salesperson_name?.split(' ')[0] || '',
      lastName: evalRow.salesperson_name?.split(' ').slice(1).join(' ') || '',
      email: evalRow.salesperson_email,
      role: evalRow.salesperson_role || 'SALESPERSON',
      isActive: typeof evalRow.salesperson_is_active === 'boolean' ? evalRow.salesperson_is_active : true,
      companyId: evalRow.salesperson_company_id || null
    },
    managerId: evalRow.managerId,
    manager: {
      id: evalRow.managerId,
      displayName: evalRow.manager_name,
      email: evalRow.manager_email,
      role: evalRow.manager_role || (evalRow.managerId === user.id ? user.role : 'SALES_LEAD'),
      isActive: typeof evalRow.manager_is_active === 'boolean' ? evalRow.manager_is_active : true,
      companyId: evalRow.manager_company_id || null
    },
    visitDate: evalRow.visitDate,
    customerName: evalRow.customerName,
    location: evalRow.location,
    overallComment: evalRow.overallComment,
    overallScore: evalRow.overallScore,
    version: evalRow.version,
    createdAt: evalRow.createdAt,
    updatedAt: evalRow.updatedAt,
    companyId: evalRow.companyId,
    evaluationStructureVersionId: evalRow.evaluationStructureVersionId || null,
    resultView:
      options.resultView ||
      buildResultView({
        evalRow,
        itemRows,
        pinnedStructureRow: options.pinnedStructureRow || null,
      }),
    items: itemRows.map(mapItemRowToMyEvaluationItem)
  };
}

module.exports = { mapMyEvaluationDto, buildResultView };
