/**
 * Ambient declarations for the client build's CSS Modules imports.
 *
 * The DSH client bundle preset inlines `*.module.css` at build time: it
 * compiles the stylesheet with Lightning CSS, injects it as a tagged
 * `<style>` element when the bundle factory runs, and substitutes the import
 * with the hashed class map. TypeScript still needs the import typed, so this
 * declaration mirrors the shape the build produces.
 */
declare module '*.module.css' {
  /** Hashed class names, keyed by the local name written in the source. */
  const classes: Readonly<Record<string, string>>
  export default classes
}
