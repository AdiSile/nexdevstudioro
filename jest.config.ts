import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/core/(.*)$": "<rootDir>/src/core/$1",
    "^@/cms/(.*)$": "<rootDir>/src/cms/$1",
    "^@/shop/(.*)$": "<rootDir>/src/shop/$1",
    "^@/ai/(.*)$": "<rootDir>/src/ai/$1",
    "^@/events/(.*)$": "<rootDir>/src/events/$1",
    "^@/blog/(.*)$": "<rootDir>/src/blog/$1",
    "^@/payments/(.*)$": "<rootDir>/src/payments/$1",
    "^@/automation/(.*)$": "<rootDir>/src/automation/$1",
    "^@/communication/(.*)$": "<rootDir>/src/communication/$1",
    "^@/analytics/(.*)$": "<rootDir>/src/analytics/$1",
    "^@/admin/(.*)$": "<rootDir>/src/admin/$1",
    "^@/search/(.*)$": "<rootDir>/src/search/$1",
    "^@/files/(.*)$": "<rootDir>/src/files/$1",
    "^@/seo/(.*)$": "<rootDir>/src/seo/$1",
    "^@/integrations/(.*)$": "<rootDir>/src/integrations/$1",
    "^@/system/(.*)$": "<rootDir>/src/system/$1",
    "^@/design/(.*)$": "<rootDir>/src/design/$1",
    "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@/hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@/providers/(.*)$": "<rootDir>/src/providers/$1",
    "^@/services/(.*)$": "<rootDir>/src/services/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/styles/(.*)$": "<rootDir>/src/styles/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@/config/(.*)$": "<rootDir>/src/config/$1",
    "^@/tests/(.*)$": "<rootDir>/src/__tests__/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  transformIgnorePatterns: [
    "/node_modules/",
    "^.+\\.module\\.(css|sass|scss)$",
  ],
};

export default createJestConfig(config);