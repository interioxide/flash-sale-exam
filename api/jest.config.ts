import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src/tests"],
    testMatch: ["**/(unit|integration)/**/*.test.ts"],
    collectCoverageFrom: ["src/**/*.ts", "!src/tests/**", "!src/index.ts"],
    coverageDirectory: "coverage",
    verbose: true,
    forceExit: true,
    testTimeout: 15000,
};

export default config;
