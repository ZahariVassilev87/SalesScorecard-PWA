/**
 * Build voice-debrief prompts from the same /scoring/categories payload used by EvaluationForm.
 * Answer keys = behavior item ids so debrief aligns with scorecard rows and AI scoring.
 */

export type VoiceDebriefQuestion = {
  id: string;
  prompt: string;
};

export type VoiceDebriefRubricSnapshot = {
  customerType: string | null;
  categories: Array<{
    id: string;
    name: string;
    weight?: number;
    items: Array<{
      id: string;
      name: string;
      descriptions?: string[];
    }>;
  }>;
};

type CategoryInput = {
  id: string;
  name: string;
  weight?: number;
  items: Array<{
    id: string;
    name: string;
    descriptions?: string[];
  }>;
};

/** One debrief step per behavior item, in category order then item order. */
export function buildVoiceDebriefQuestionsFromCategories(categories: CategoryInput[]): VoiceDebriefQuestion[] {
  const out: VoiceDebriefQuestion[] = [];
  for (const cat of categories) {
    const items = Array.isArray(cat.items) ? cat.items : [];
    for (const item of items) {
      const lines: string[] = [];
      lines.push(`**${cat.name}**`);
      if (cat.weight != null && !Number.isNaN(Number(cat.weight))) {
        lines.push(`(Category weight on scorecard: ${(Number(cat.weight) * 100).toFixed(0)}%)`);
      }
      lines.push('');
      lines.push(`**Behavior:** ${item.name}`);
      lines.push('');
      lines.push(
        'Describe what happened in the customer interaction for this behavior. Include concrete examples (what you asked, said, or agreed) and how the customer responded.'
      );
      if (item.descriptions && item.descriptions.length >= 4) {
        lines.push('');
        lines.push(
          'Scorecard levels (reference only — you are not selecting a number here; scoring is from your text):'
        );
        item.descriptions.forEach((d, i) => {
          lines.push(`${i + 1} — ${d}`);
        });
      } else {
        lines.push('');
        lines.push('The scorecard uses levels 1 (poor) through 4 (excellent) for this behavior.');
      }
      out.push({ id: item.id, prompt: lines.join('\n') });
    }
  }
  return out;
}

export function buildRubricSnapshot(
  categories: CategoryInput[],
  customerType: string | null
): VoiceDebriefRubricSnapshot {
  return {
    customerType,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
      items: (c.items || []).map((i) => ({
        id: i.id,
        name: i.name,
        descriptions: i.descriptions
      }))
    }))
  };
}
