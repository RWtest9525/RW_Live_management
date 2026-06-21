// Emoji & Symbol Detection
const EMOJI_OR_SYMBOL_REGEX = /[\p{S}\p{P}]/u;
const ALPHANUMERIC_REGEX = /[\p{L}\p{N}]/u;

const getSegmenter = () => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return new Intl.Segmenter('en', { granularity: 'grapheme' })
  }
  return null
}

const segmenter = getSegmenter()

const splitGraphemes = (value) => {
  const normalized = String(value ?? '')
  if (!segmenter) return Array.from(normalized)
  return [...segmenter.segment(normalized)].map((entry) => entry.segment)
}

export const normalizeReviewText = (value) => String(value ?? '').trimEnd()

/**
 * Check if the content ends with EXACTLY the hint symbol(s).
 * - Must match length exactly at the end.
 * - If hint is ".", it matches only a single dot. ".." should not match ".".
 * - Supports prefix dots like "." before hint (e.g. hint is " and content ends with .")
 */
export const matchesStrictTrailingHint = (text, hintValue) => {
  const normalized = normalizeReviewText(text)
  const hint = String(hintValue ?? '').trim()
  if (!normalized || !hint) return false

  // Special case for dots
  if (hint === '.') {
    return normalized.endsWith('.') && !normalized.endsWith('..');
  }
  if (hint === '..') {
    return normalized.endsWith('..') && !normalized.endsWith('...');
  }
  // And so on for repeats...

  // General hint match
  if (!normalized.endsWith(hint)) return false

  // Check for exact repeat (e.g. if hint is "," and text ends with ",,", it's not a single hint match)
  const escapedHint = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const repeatRegex = new RegExp(`${escapedHint}{2,}$`);
  if (repeatRegex.test(normalized)) return false

  return true
}

/**
 * NO HINT Logic:
 * - Content ends with alphanumeric character (no symbol/emoji)
 * - OR content ends with EXACTLY one single dot "." (even if there are spaces before it)
 * - Multiple dots ".." or "..." are NOT No Hint.
 */
export const matchesNoHintRule = (text) => {
  const normalized = normalizeReviewText(text)
  if (!normalized) return false

  // If ends with multiple dots, it's a hint, not "No Hint"
  if (normalized.endsWith('..')) return false

  const graphemes = splitGraphemes(normalized)
  const lastUnit = graphemes.at(-1) ?? ''

  // Single dot case
  if (lastUnit === '.') return true

  // Alphanumeric case (no symbol/emoji)
  return ALPHANUMERIC_REGEX.test(lastUnit)
}

/**
 * Main Filtering Logic
 */
export const matchesReviewByHintMode = ({
  text,
  hintMode = 'strict-hint',
  selectedHint = '',
}) => {
  const normalized = normalizeReviewText(text)
  if (!normalized) return false

  if (hintMode === 'show-all') return true
  if (hintMode === 'no-hint') return matchesNoHintRule(normalized)
  
  // Custom Hint Logic
  const hints = String(selectedHint ?? '').split(',').map(h => h.trim()).filter(Boolean)
  if (!hints.length) return false
  
  return hints.some(hint => {
    // Exact match for the hint at the end
    if (matchesStrictTrailingHint(normalized, hint)) return true

    // Special case: Accept dot + hint (e.g. hint is " and content ends with .")
    if (normalized.endsWith('.' + hint)) {
        // Ensure it's not multiple dots before the hint (e.g. .." should not match ")
        if (!normalized.endsWith('..' + hint)) return true
    }

    return false
  })
}

export const getHintCategoryLabel = ({ hintMode = 'strict-hint', selectedHint = '' }) => {
  if (hintMode === 'show-all') return 'SHOW_ALL'
  if (hintMode === 'no-hint') return 'NO_HINT'
  const hints = String(selectedHint ?? '').split(',').map(h => h.trim()).filter(Boolean)
  return `HINT:${hints.join('|')}`
}
