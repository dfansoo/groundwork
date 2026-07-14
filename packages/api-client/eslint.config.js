import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  // Generated from the OpenAPI contract — never hand-edited, so never linted.
  { ignores: ["src/schema.d.ts"] },
]
