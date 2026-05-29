// Babel is only used by Jest (babel-jest) to transpile the ESM source + test
// files to CJS so classic jest.mock / moduleNameMapper behave predictably across
// the per-service node_modules trees. It does NOT affect how the app runs (Docker
// runs the services as native ESM via `node`).
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
