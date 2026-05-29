// Shared helpers for building mocked Mongoose-style models, documents and the
// inter-service event bus. Everything the services need is injected through their
// constructors, so these fakes are all the "database" the unit tests ever see.

/**
 * Build a fake Mongoose model. Pass the method names the service uses; each
 * becomes a jest.fn() you can configure per-test
 * (e.g. Model.findOne.mockResolvedValue(doc)).
 */
export const makeModel = (methods = []) => {
  const model = {};
  for (const name of methods) model[name] = jest.fn();
  return model;
};

// Common Mongoose model method set used across the services under test.
export const COMMON_MODEL_METHODS = [
  "find",
  "findOne",
  "findById",
  "findByIdAndUpdate",
  "findByIdAndDelete",
  "findOneAndUpdate",
  "create",
  "insertMany",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "aggregate",
  "exists",
];

/** Build a fake model with every common method pre-stubbed. */
export const makeFullModel = () => makeModel(COMMON_MODEL_METHODS);

/**
 * Build a fake Mongoose document: the given data plus a save() spy that
 * resolves to the document itself (so `await doc.save()` works).
 */
export const makeDoc = (data = {}) => {
  const doc = { ...data };
  doc.save = jest.fn(async () => doc);
  doc.toObject = jest.fn(() => ({ ...data }));
  return doc;
};

/**
 * Build a chainable Mongoose-query stand-in that resolves to `value`. Supports the
 * fluent methods the services use (select/populate/sort/skip/limit/lean) and is
 * awaitable, so both `await Model.findById(id)` and
 * `await Model.findById(id).select(...).lean()` work.
 */
export const makeQuery = (value) => {
  const q = {
    select: jest.fn(() => q),
    populate: jest.fn(() => q),
    sort: jest.fn(() => q),
    skip: jest.fn(() => q),
    limit: jest.fn(() => q),
    lean: jest.fn(() => q),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    catch: (cb) => Promise.resolve(value).catch(cb),
    finally: (cb) => Promise.resolve(value).finally(cb),
  };
  return q;
};

/**
 * Mock of shared/messaging/eventBus.js EventBus instance. safeRequest is the only
 * method the services call; configure replies per-test with
 * bus.safeRequest.mockResolvedValueOnce({ success: true, ... }).
 */
export const makeEventBus = () => ({
  safeRequest: jest.fn(async () => ({ success: true })),
  publish: jest.fn(async () => {}),
  connect: jest.fn(async () => {}),
});

/** No-op notification senders (booking/payment services accept these). */
export const makeNotifiers = () => ({
  sendNotification: jest.fn(async () => {}),
  sendNotificationsToUsers: jest.fn(async () => {}),
});

/** A valid 24-char hex ObjectId string (passes mongoose ObjectId.isValid). */
export const oid = (seed = "1") => {
  const hex = seed.toString().replace(/[^0-9a-f]/gi, "").toLowerCase();
  return (hex || "1").padStart(24, "0").slice(-24);
};
