// Silence the services' own console.log/info/warn chatter during tests so the
// Jest reporter stays readable. Real errors (console.error) are kept.
const noop = () => {};
console.log = noop;
console.info = noop;
console.debug = noop;
console.warn = noop;
