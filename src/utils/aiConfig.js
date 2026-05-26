export const DEFAULT_AI_MODEL = 'gemini-3.5-flash';

export const AI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const LEGACY_AI_MODELS = {
  'gemini-3-flash-preview': 'gemini-3.5-flash',
  'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite',
};

export function normalizeAiModel(model) {
  const migratedModel = LEGACY_AI_MODELS[model] || model;
  return AI_MODELS.includes(migratedModel) ? migratedModel : DEFAULT_AI_MODEL;
}
