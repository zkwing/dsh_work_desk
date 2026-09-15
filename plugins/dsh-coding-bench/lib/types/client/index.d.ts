/**
 * Client half of `dsh-coding-bench`. Bundled by tsdown using the checkout's
 * DSH client preset and shipped as `lib/client.js`. The browser module
 * system loads it from `/plugins/dsh-coding-bench/client.js` once the
 * profile's `cordis.patch.yml` registers the plugin's Host row.
 *
 * Both halves are deliberately empty. The contract a DSH plugin must honour
 * is the `apply` function + the `inject` list on each half; everything else
 * is opt-in.
 */
/** The client half depends on no services — replace with the list your
 *  plugin actually needs (e.g. `['slots', 'locale', 'theme']`). */
export declare const inject: readonly string[];
/** The factory the DSH client module system calls. The returned function is
 *  the registered module. This empty factory is enough to ship a loadable
 *  bundle; replace it with the real one once you start writing a panel. */
export default function moduleFactory(): void;
/** Cordis apply: this function runs once per profile that loads the plugin
 *  in the browser. Drop your real startup here. */
export declare function apply(): void;
//# sourceMappingURL=index.d.ts.map