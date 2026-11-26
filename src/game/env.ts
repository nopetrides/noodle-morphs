/**
 * Build-time feature flag for developer debug tools.
 * Using direct `import.meta.env.*` accesses lets Vite statically fold this to `false`
 * in production `npm run build` output so dev panels are dead-code-eliminated.
 */
export const DEV_TOOLS_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
