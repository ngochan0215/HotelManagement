// Central home for all third-party / singleton MODULE mocks used by the suite.
// (App fixtures — fake models, docs, event bus — live in helpers/mocks.js.)
//
// Two kinds of module are mocked here, both wired up in ../jest.config.cjs:
//   - Named-export modules (cache, google-auth-library, jimp, shared pdf/excel
//     config, paymentHelpers) are mapped straight to THIS file — a named import
//     just picks the matching export below.
//   - Default-export libs (bcrypt, jsonwebtoken, jsqr, exceljs, pdfkit) can't all
//     share one module (only one `default` per file), so each has a 1-line shim in
//     __mocks__/ that re-exports the relevant value from here.

// ---------------------------------------------------------------------------
// default-export libs (re-exported as default by the __mocks__/ shims)
// ---------------------------------------------------------------------------

// bcrypt — hash() is deterministic; compare() defaults to true, override per-test
// with bcrypt.compare.mockResolvedValueOnce(false).
export const bcrypt = {
  hash: jest.fn(async (plain) => `hashed:${plain}`),
  compare: jest.fn(async () => true),
};

// jsonwebtoken — sign() returns a fixed token; verify/decode are stubs.
export const jwt = {
  sign: jest.fn(() => "mocked.jwt.token"),
  verify: jest.fn(() => ({ userId: "mock-user", role: "employee" })),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
};

// jsQR — default: no QR code found. Override with jsQR.mockReturnValueOnce({ data }).
export const jsQR = jest.fn(() => null);

// exceljs Workbook — records worksheets/rows so export tests can assert structure
// without writing a real .xlsx file.
export class ExcelWorkbook {
  constructor() {
    this.worksheets = [];
    this.xlsx = { write: jest.fn(async () => {}) };
  }
  addWorksheet(name) {
    const ws = {
      name,
      columns: [],
      rows: [],
      addRow(row) { this.rows.push(row); return row; },
      addRows(rows = []) { rows.forEach((r) => this.rows.push(r)); },
      getRow() { return { font: {} }; },
    };
    this.worksheets.push(ws);
    return ws;
  }
}

// pdfkit PDFDocument — every drawing method is chainable and does nothing.
export class PDFDocumentMock {
  constructor() {
    this.on = jest.fn();
    this.pipe = jest.fn();
    this.end = jest.fn();
    const chain = () => this;
    this.registerFont = chain;
    this.font = chain;
    this.fontSize = chain;
    this.fillColor = chain;
    this.text = chain;
    this.moveDown = chain;
    this.addPage = chain;
  }
}

// ---------------------------------------------------------------------------
// shared/utils/cache.js — no Redis. get() always misses; writes are no-ops.
// ---------------------------------------------------------------------------
export const cache = {
  get: jest.fn(async () => null),
  set: jest.fn(async () => {}),
  del: jest.fn(async () => {}),
  delByPattern: jest.fn(async () => {}),
};
export const makeCacheKey = jest.fn((prefix, params) => `${prefix}:${JSON.stringify(params ?? {})}`);

// ---------------------------------------------------------------------------
// google-auth-library — tests drive behaviour through __verifyIdToken, e.g.
// __verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({...}) }).
// ---------------------------------------------------------------------------
export const __verifyIdToken = jest.fn();
export class OAuth2Client {
  constructor() {}
  verifyIdToken(...args) {
    return __verifyIdToken(...args);
  }
}

// ---------------------------------------------------------------------------
// jimp — minimal stand-in for the QR-scan path.
// ---------------------------------------------------------------------------
export const Jimp = {
  read: jest.fn(async () => ({
    bitmap: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
  })),
};

// ---------------------------------------------------------------------------
// shared/config/excel.js
// ---------------------------------------------------------------------------
export const safeForEach = jest.fn((data = [], cb) => (data || []).forEach(cb));
export const parseRange = jest.fn((from, to) => ({ start: new Date(from), end: new Date(to) }));
export const getWeekRange = jest.fn((date) => ({ start: new Date(date), end: new Date(date) }));
export const getMonthRange = jest.fn((date) => ({ start: new Date(date), end: new Date(date) }));
export const getRange = jest.fn(() => ({ start: new Date(), end: new Date() }));

// ---------------------------------------------------------------------------
// shared/config/pdf.js (avoids reading the Roboto .ttf font files on import)
// ---------------------------------------------------------------------------
export const ROBOTO_REGULAR = "Roboto-Regular.ttf";
export const ROBOTO_BOLD = "Roboto-Bold.ttf";
export const formatCurrency = jest.fn((amount) => `${amount}d`);
export const formatDate = jest.fn((date) => String(date));
export const addHeader = jest.fn();
export const addFooter = jest.fn();
export const addTable = jest.fn();

// ---------------------------------------------------------------------------
// payment-service/services/paymentHelpers.js — keeps transaction tests focused on
// TransactionService's own logic (receipt/booking joins are out of scope).
// ---------------------------------------------------------------------------
export const enrichReceipts = jest.fn(async (_bus, receipt) => receipt);
export const populateBookingPeople = jest.fn(async (_bus, booking) => booking);
export const findPendingCompensationTickets = jest.fn(async () => []);
