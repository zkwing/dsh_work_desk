/**
 * Preview stand-in for `@deepseek-ai/dsh-client-ui-slots`. The sidebar bundle
 * imports only `resolveSlotLabel` at runtime (its own registration machinery is
 * driven by the real Host in the app, never in this preview).
 */

/** Resolve a possibly-thunked list label. */
export function resolveSlotLabel(label) {
  return typeof label === 'function' ? label() : label
}
