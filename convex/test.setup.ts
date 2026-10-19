/// <reference types="vite/client" />
// Every Convex module, for convex-test. Modules load lazily, so test files
// matched here are never imported.
export const modules = import.meta.glob("./**/*.*s");
