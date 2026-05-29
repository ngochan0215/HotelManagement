// Jest config for the Hotel Management unit-test suite.
//
// These are pure UNIT tests: every service is instantiated with mocked models +
// a mocked event bus (the app's own constructor dependency-injection makes this
// trivial), and the module-level singletons that touch I/O (Redis cache, bcrypt,
// jwt, google-auth, exceljs, pdfkit, jimp, jsqr) are redirected to fakes via
// moduleNameMapper. => No Mongo, no Redis, no RabbitMQ, no Docker required.
//
// Run from the `server/` folder:  npm test
module.exports = {
  testEnvironment: "node",
  rootDir: __dirname,
  // Only discover tests inside the single jest-testing folder.
  roots: ["<rootDir>/jest-testing"],
  testMatch: ["**/*.test.js"],
  // Transpile ESM -> CJS for every source/test file we load (node_modules excluded).
  transform: { "^.+\\.js$": "babel-jest" },
  transformIgnorePatterns: ["/node_modules/"],
  // Redirect singletons / heavy or native libs to manual mocks. Matching is done
  // against the import request string, so these apply no matter which service's
  // node_modules the real module would have resolved from.
  moduleNameMapper: {
    // Named-export modules -> the single consolidated mocks file.
    "shared/utils/cache\\.js$": "<rootDir>/jest-testing/mocks.js",
    "shared/config/pdf\\.js$": "<rootDir>/jest-testing/mocks.js",
    "shared/config/excel\\.js$": "<rootDir>/jest-testing/mocks.js",
    "paymentHelpers\\.js$": "<rootDir>/jest-testing/mocks.js",
    "^google-auth-library$": "<rootDir>/jest-testing/mocks.js",
    "^jimp$": "<rootDir>/jest-testing/mocks.js",
    // Default-export libs -> per-lib shims (each re-exports from mocks.js).
    "^bcrypt$": "<rootDir>/jest-testing/mocks/bcrypt.js",
    "^jsonwebtoken$": "<rootDir>/jest-testing/mocks/jsonwebtoken.js",
    "^jsqr$": "<rootDir>/jest-testing/mocks/jsqr.js",
    "^exceljs$": "<rootDir>/jest-testing/mocks/exceljs.js",
    "^pdfkit$": "<rootDir>/jest-testing/mocks/pdfkit.js",
  },
  setupFiles: ["<rootDir>/jest-testing/setup.js"],
  clearMocks: true,
  verbose: true,
};
