# Hotel Management — Automated Tests (Jest)

Unit tests that implement the test cases in requirement traceability matrix document.
One folder for the whole backend (services are tested directly via their
constructor dependency-injection), so services not in the RTM don't get in the way.

## Running

These are **pure unit tests** — the database, Redis, RabbitMQ, bcrypt, jwt, PayOS,
ExcelJS/PDFKit are all mocked. **No Docker / running stack required.**

```bash
cd server
npm install              # first time (installs jest + babel devDeps)
npm test                 # run everything
npm run test:watch       # watch mode
npm run test:coverage    # with coverage
npx jest jest-testing/auth        # one folder
npx jest -t "TC008"               # one test case by RTM id
```

Docker is unaffected — it builds/runs each microservice independently and never
touches `server/package.json`'s test script. Run `npm test` on the host while the
containers are up or down; it makes no difference.

## How it works

- **DI over patching.** Each service is `new`-ed with mocked Mongoose models
  (`makeFullModel` / `makeDoc` / `makeQuery`) and a mocked event bus
  (`makeEventBus`, or a per-event router in the booking suites). See
  [`helpers/mocks.js`](helpers/mocks.js).
- **Singletons / native / heavy libs** are redirected to fakes via
  `moduleNameMapper` in [`../jest.config.cjs`](../jest.config.cjs). All mock
  behaviour lives in one file, [`mocks.js`](mocks.js) (cache/Redis,
  google-auth-library, jimp, shared pdf/excel config, paymentHelpers, plus the
  bcrypt/jwt/jsqr/exceljs/pdfkit payloads). Named-export modules map straight to
  `mocks.js`; the default-export libs (bcrypt, jsonwebtoken, jsqr, exceljs,
  pdfkit) each have a one-line shim in [`__mocks__/`](__mocks__) that re-exports
  from `mocks.js` (a module can only have one `default`).
- **ESM** source is transpiled for Jest by `babel-jest` (see `../babel.config.cjs`);
  the app itself still runs as native ESM under Node — Babel is test-only.

## Traceability to the RTM

| Use case | File | RTM rows |
|---|---|---|
| Login | `auth/login.test.js` | TC001–009 |
| Add employee | `employee/add-employee.test.js` | TC010–019 |
| Update employee | `employee/update-employee.test.js` | TC020–027 |
| Ban employee | `employee/ban-employee.test.js` | TC028–032 |
| PayOS payment flow | `payment/payment.test.js` | TC033–044 |
| Add customer | `customer/add-customer.test.js` | TC045–053 |
| Update customer loyalty | `customer/loyalty.test.js` | TC054–061 |
| Add room category | `room/add-room-category.test.js` | TC062–068 |
| Update room category | `room/update-room-category.test.js` | TC069–074 |
| Delete room category | `room/delete-room-category.test.js` | TC075–079 |
| Add room | `room/add-room.test.js` | TC080–085 |
| Update room | `room/update-room.test.js` | TC086–093 |
| View & export statistics | `statistics/statistics.test.js` | TC094–101 |
| Create booking flow | `booking/create-booking.test.js` | TC102–112 |
| Cancel booking flow | `booking/cancel-booking.test.js` | TC113–120 |
| Incident management | `incident/incident.test.js` | TC121–129 |
| Discount management | `discount/discount.test.js` | TC130–137 |
| Compensation ticket | `compensation/compensation.test.js` | TC138–145 |

Each `test(...)` title starts with its RTM id (e.g. `TC007-Login-07`).

### Marked `test.todo` (front-end / manual — not service-level)

These RTM rows are UI rendering or a separate concern, so they are declared as
`test.todo` placeholders rather than faked: TC001/002/003 (login form & client-side
validation), TC010 / TC045 (form rendering), TC096 (dashboard rendering),
TC099 (room-status summary lives in `roomStatisticService`), TC102 (booking form).
