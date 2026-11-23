/** Unit tests need nothing external. Integration tests run against an
 *  isolated, throwaway PostgreSQL (embedded-postgres) created in global setup. */
const tsJest = { "^.+[.]ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] };
module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      transform: tsJest,
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      transform: tsJest,
      testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
      globalSetup: "<rootDir>/test/global-setup.mjs",
      globalTeardown: "<rootDir>/test/global-teardown.mjs",
    },
  ],
  testTimeout: 30000,
};
