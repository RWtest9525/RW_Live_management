const ALPHANUMERIC_REGEX = /^[a-z0-9]$/i

const stripLeadingSpaces = (value) => value.trimStart()

export const matchesHintWise = (input, hintSymbol) => {
  const normalized = stripLeadingSpaces(input)
  if (!normalized || !hintSymbol) return false
  if (!normalized.startsWith(hintSymbol)) return false
  return normalized[hintSymbol.length] !== hintSymbol
}

export const matchesNoHint = (input) => {
  const normalized = stripLeadingSpaces(input)
  if (!normalized) return false
  if (normalized.startsWith('..')) return false
  if (normalized[0] === '.') return normalized[1] !== '.'
  return ALPHANUMERIC_REGEX.test(normalized[0])
}
