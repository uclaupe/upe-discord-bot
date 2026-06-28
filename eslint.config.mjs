import node from "eslint-plugin-node";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: [
    "**/*.ts",
  ],
  languageOptions: {
    parser: tseslint.parser,
  },
  plugins: {
    node,
  },
  rules: {
    // Disallow direct access to `process.env`. All environment variables should
    // go through the validated env object exported on startup.
    "node/no-process-env": "error",
    // Disallow non-relative imports that start with `src/`. These resolve at
    // runtime only when a path alias or bundler is configured, and silently
    // break in plain Node / Jest / tsc without one, producing MODULE_NOT_FOUND.
    "no-restricted-imports": ["error", {
      patterns: [{
        regex: "^src/",
        message: "Use a relative import (e.g. '../../foo') instead of a src/-rooted path.",
      }],
    }],
  },
});
