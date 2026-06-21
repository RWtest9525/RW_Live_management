import {
  matchesNoHintRule,
  matchesStrictTrailingHint,
} from '../../shared/reviewHints.js'

export const matchesHintWise = (input, hintSymbol) =>
  matchesStrictTrailingHint(String(input ?? '').trimEnd(), hintSymbol)

export const matchesNoHint = (input) => matchesNoHintRule(String(input ?? '').trimEnd())
