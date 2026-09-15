/**
 * Ambient declaration for CSS Modules imports used by the client half. The
 * DSH client preset inlines `*.module.css` at build time, substituting the
 * import with a hashed class map. TypeScript still needs the import typed.
 */
declare module '*.module.css' {
  /** Hashed class names, keyed by the local name written in the source. */
  const classes: Readonly<Record<string, string>>
  export default classes
}
