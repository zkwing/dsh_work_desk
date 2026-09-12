/**
 * Preview stand-in for `@deepseek-ai/dsh-client-store`. The sidebar bundle
 * imports only `createSnapshotStore` at runtime, and the workbench never reads
 * that store, so a minimal observable snapshot satisfies the module table
 * without pulling zustand and immer into a design preview.
 */

/**
 * Create a minimal snapshot store.
 * @param initial - the initial snapshot value.
 * @returns the store handle with get/set/subscribe.
 */
export function createSnapshotStore(initial) {
  let value = initial
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    set(next) {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    useSnapshot: selector => selector(value),
  }
}

/** Structural equality over one level, matching the real store's default helper. */
export function shallowEqual(left, right) {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every(key => Object.is(left[key], right[key]))
}
