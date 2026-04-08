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

/**
 * @param evalRow — row from evaluations list query (with joined salesperson/manager aliases)
 * @param itemRows — rows from evaluation_items query for this evaluation
 * @param user — req.user (for manager role fallback when manager is current user)
 */
function mapMyEvaluationDto(evalRow, itemRows, user) {
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
    items: itemRows.map(mapItemRowToMyEvaluationItem)
  };
}

module.exports = { mapMyEvaluationDto };
