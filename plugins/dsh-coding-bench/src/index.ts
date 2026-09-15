/**
 * Host half of `dsh-coding-bench`. Compiled by tsc and shipped as
 * `lib/index.js`, which `package.json` names in `main`. The browser half
 * lives at `src/client/index.ts` and is bundled separately by tsdown.
 *
 * Both halves are deliberately empty. The contract a DSH plugin must honour
 * is the `apply` function + the `inject` list on each half; everything else
 * is opt-in.
 */
export const name = 'dsh-coding-bench'

/** The Host half depends on no services — replace with the list your plugin
 *  actually needs (e.g. `['webServer', 'connection', 'fs']`). */
export const inject: readonly string[] = []

/** Cordis apply: this function runs once per profile that loads the plugin.
 *  Drop your real work here. */
export function apply(): void {
  // intentionally empty — drop your real startup here
}
