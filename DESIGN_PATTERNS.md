# Design Pattern Proposals — SE Hotel Management System

## Overview

This document summarizes recommended design patterns for the codebase, split into two groups:
- **System-wide patterns** that improve consistency and resilience across all microservices
- **Booking-specific patterns** that directly improve the core booking business logic

---

## System-Wide Patterns

### 1. Result / Response Object Pattern

**Problem:** Service methods return inconsistent shapes — some return `{ success, data }`, some return raw objects, some throw errors. Controllers frequently destructure the wrong fields (root cause of several bugs fixed in this session: `install_ticket` vs `data` mismatch, `adminResetPassword` returning `undefined`, etc.).

**Solution:** A shared `Result` class enforced across all service return values.

```js
// server/shared/utils/result.js
class Result {
  static ok(data)                        { return { success: true,  data }; }
  static fail(message, status = 400)     { return { success: false, message, status }; }
}
```

**How it flows:**
```
Controller calls service
  → service returns Result.ok({ employees }) or Result.fail("Not found", 404)
  → controller always destructures { success, data, message, status }
  → no more shape guessing, no more silent undefined crashes
```

---

### 2. Circuit Breaker for eventBus.request()

**Problem:** Every cross-service call (`EMPLOYEE_EVENTS.GET_INFO`, `ROOM_EVENTS.GET_ROOMS_INFO`, `USER_EVENTS.RESET_PASSWORD`, etc.) has zero fallback. If the target service is down or replies `{ success: false }`, the caller either crashes or returns a blank list. Example: `getAllEmployees` crashed entirely when auth-service was unreachable because `user_id.toString()` received null.

**Solution:** Wrap `eventBus.request()` with a circuit breaker that returns a safe fallback.

```js
// server/shared/utils/circuitBreaker.js
class CircuitBreaker {
  async request(eventBus, event, data, fallback = null) {
    try {
      const reply = await eventBus.request(event, data);
      if (!reply?.success) return fallback ?? { success: false, message: reply?.message };
      return reply;
    } catch {
      return fallback ?? { success: false, message: "Service unavailable" };
    }
  }
}
```

**How it flows:**
```
equipmentInstallService.populateRoom(tickets)
  → circuitBreaker.request(eventBus, ROOM_EVENTS.GET_ROOMS_INFO, { roomIds }, { success: true, rooms: [] })
  → if room-service is down → returns empty rooms instead of crashing
  → tickets are returned with room_info: null
  → frontend handles null safely via optional chaining (already fixed)
```

---

### 3. Repository Pattern

**Problem:** Raw Mongoose queries are duplicated and scattered inside every service method. The `limit: 10` default caused silent data truncation across equipment and employee pages. Changing query defaults requires editing every service.

**Solution:** A repository class per model centralizes all DB access.

```js
// server/shared/repositories/baseRepository.js
class BaseRepository {
  constructor(Model) { this.Model = Model; }

  async findAll(filter = {}, { sort = { created_at: -1 }, skip = 0, limit = 9999, populate = [], select = "-__v" } = {}) {
    let query = this.Model.find(filter).select(select).sort(sort).skip(skip).limit(limit);
    for (const p of populate) query = query.populate(p);
    return query.lean();
  }

  async findById(id, options = {}) { ... }
  async create(data)               { ... }
  async updateById(id, data)       { ... }
  async deleteById(id)             { ... }
  async count(filter = {})         { return this.Model.countDocuments(filter); }
}
```

**How it flows:**
```
EquipmentService.getAllEquipments(query)
  → equipmentRepo.findAll(filter, { limit: query.limit, populate: [{ path: "category_id", select: "name unit price" }] })
  → pagination logic lives in one place
  → changing default limit: edit BaseRepository, not 10 service files
```

---

### 4. Custom Hook Pattern (Frontend)

**Problem:** Every page component duplicates the same 15-line loading/error/reload state pattern. Stale closures in `confirmState` handlers (seen in `housekeeperWorkPage`, `earningsPage`).

**Solution:** A `useDataFetch` hook extracts the pattern once.

```js
// client/src/hooks/useDataFetch.js
function useDataFetch(fetchFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try       { setData(await fetchFn()); }
    catch (e) { setError(e.response?.data?.message || e.message); }
    finally   { setLoading(false); }
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
```

**How it flows:**
```
EquipmentListTab mounts
  → const { data, loading, error, reload } = useDataFetch(() => equipmentApi.getAllEquipments({ limit: 9999 }))
  → loading spinner shown automatically
  → on confirm (install/delete) → call reload() to refresh
  → no more manual setLoading / try-catch / finally in every component
```

---

---

## Booking-Specific Patterns

### 5. Cache-Aside Pattern — Room Categories & Availability

**Problem:** `GET /categories` and availability searches hit MongoDB on every request. Room categories change only when an admin edits them. Availability range queries (scan all bookings in a date window) are the heaviest query in the system.

**Solution:** Cache-Aside with Redis. Read from cache first; populate from DB on miss; invalidate on write.
 
```js
// room-service: RoomCategoryService
async getAllRoomCategories() {
  const cacheKey = "room:categories";
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const categories = await this.categoryRepo.findAll();
  await redis.setex(cacheKey, 300, JSON.stringify(categories)); // 5 min TTL
  return categories;
}

async updateRoomCategory(id, data) {
  const result = await this.categoryRepo.updateById(id, data);
  await redis.del("room:categories"); // invalidate on any write
  return result;
}

// For availability: cache per search window
async getAvailableRoomCategories(checkIn, checkOut) {
  const cacheKey = `room:available:${checkIn}:${checkOut}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const available = await this._queryAvailableCategories(checkIn, checkOut);
  await redis.setex(cacheKey, 60, JSON.stringify(available)); // 1 min TTL (availability changes fast)
  return available;
}
```

**Use-case — `findSuitableRoomCategories(checkIn, checkOut)`:**
```
Customer opens booking page
  → client calls GET /categories/available-by?checkIn=...&checkOut=...
  → RoomCategoryService checks Redis for "room:available:2025-06-01:2025-06-05"
  → CACHE HIT  → return immediately, no DB query
  → CACHE MISS → query MongoDB (all bookings in range), compute available categories
               → store in Redis with 60s TTL
               → return to client
  → If admin updates a category → Redis key "room:categories" is deleted
  → Next request rebuilds the cache from fresh DB data
```

---

### 6. State Machine — Booking Lifecycle

**Problem:** Booking status transitions (pending → confirmed → checked_in → checked_out, or → cancelled) are enforced inconsistently across multiple service methods and jobs. The commented-out cron jobs (`startCancelPendingBookingJob`, `startCancelCheckinLateBookingJob`) are risky to enable because they could transition bookings in invalid states.

**Solution:** A state machine that defines all legal transitions and centralizes enforcement.

```js
// booking-service: utils/bookingStateMachine.js
const TRANSITIONS = {
  pending:     ["waiting_confirm", "cancelled"],
  waiting_confirm: ["confirmed", "cancelled"],
  confirmed:   ["checked_in", "cancelled"],
  checked_in:  ["checked_out"],
  checked_out: [],
  cancelled:   []
};

class BookingStateMachine {
  static canTransition(from, to) {
    return (TRANSITIONS[from] || []).includes(to);
  }

  static transition(booking, newStatus, reason = null) {
    if (!this.canTransition(booking.status, newStatus))
      throw new Error(`Invalid transition: ${booking.status} → ${newStatus}`);
    booking.status     = newStatus;
    booking.updated_at = new Date();
    if (reason) booking.cancel_reason = reason;
    return booking;
  }
}
```

**Use-case — `cancelPendingBookingJob` (re-enabling the cron job safely):**
```
Cron fires every 15 minutes
  → fetch all bookings where status = "pending" AND created_at < now - 30min
  → for each booking:
      BookingStateMachine.transition(booking, "cancelled", "Auto-cancelled: deposit not paid")
      → throws if booking somehow already moved to "confirmed" (race condition safe)
      → saves booking
      → eventBus.publish(BOOKING_EVENTS.CANCELLED, { bookingId })
  → room-service receives event → room status back to "available"
  → notification-service sends cancellation email
```

**Use-case — `createBooking`:**
```
POST /bookings with { roomId, checkIn, checkOut, customerId }
  → validate availability (Cache-Aside, pattern 5)
  → create booking with status = "pending"
  → BookingStateMachine confirms "pending" is the valid initial state
  → eventBus.publish(BOOKING_EVENTS.CREATED)
  → deposit deadline reminder job is scheduled
  → customer cannot be checked in until: pending → confirmed → checked_in
    (each step gated by state machine)
```

---

### 7. Strategy Pattern — Pricing

**Problem:** Booking price is currently `room.price × nights`. The system already has a `DiscountPage` with promotion codes, but the discount application logic is likely a single if-block. As pricing rules grow (weekend surcharge, long-stay discount, loyalty tiers, early-bird), the booking service becomes a maze of conditionals.

**Solution:** Each pricing rule is a strategy. Strategies are composed (stacked) at booking creation time.

```js
// booking-service: strategies/pricingStrategy.js
class NightlyPriceStrategy {
  calculate(room, checkIn, checkOut) {
    const nights = differenceInDays(new Date(checkOut), new Date(checkIn));
    return { baseAmount: room.price * nights, nights };
  }
}

class DiscountStrategy {
  constructor(inner, discount) { this.inner = inner; this.discount = discount; }
  calculate(room, checkIn, checkOut) {
    const result  = this.inner.calculate(room, checkIn, checkOut);
    const savings = result.baseAmount * (this.discount.percent / 100);
    return { ...result, discountAmount: savings, finalAmount: result.baseAmount - savings };
  }
}

class WeekendSurchargeStrategy {
  constructor(inner, surchargePercent = 20) { this.inner = inner; this.surcharge = surchargePercent; }
  calculate(room, checkIn, checkOut) {
    const result       = this.inner.calculate(room, checkIn, checkOut);
    const weekendNights = this._countWeekendNights(checkIn, checkOut);
    const surcharge    = room.price * weekendNights * (this.surcharge / 100);
    return { ...result, surchargeAmount: surcharge, finalAmount: (result.finalAmount ?? result.baseAmount) + surcharge };
  }
}
```

**Use-case — `createBooking` with discount code:**
```
POST /bookings { roomId, checkIn, checkOut, discountCode }
  → fetch room, fetch discount by code
  → compose pricing strategy:
      let strategy = new NightlyPriceStrategy();
      if (isWeekend)   strategy = new WeekendSurchargeStrategy(strategy, 20);
      if (discount)    strategy = new DiscountStrategy(strategy, discount);
      if (longStay)    strategy = new LongStayDiscountStrategy(strategy, 10);
  → const pricing = strategy.calculate(room, checkIn, checkOut)
  → booking.base_amount     = pricing.baseAmount
  → booking.discount_amount = pricing.discountAmount ?? 0
  → booking.total_amount    = pricing.finalAmount ?? pricing.baseAmount
  → save booking
```

Adding a new rule (e.g., loyalty tier discount) = add one new strategy class, wrap it in the chain. Zero changes to existing strategies or booking creation logic.

---

### 8. Saga Pattern — Checkout Flow

**Problem:** `checkOutBooking` triggers updates across multiple services: room status → available, cleaning task → created, receipt → generated, notification → sent. If any step fails mid-way, the system is left inconsistent (e.g., room marked available but no cleaning task created, or receipt created but room still shows occupied). There is currently no rollback path.

**Solution:** A Saga coordinates the steps and runs compensating transactions on failure.

```js
// booking-service: sagas/checkoutSaga.js
class CheckoutSaga {
  constructor(bookingService, eventBus) {
    this.bookingService = bookingService;
    this.eventBus       = eventBus;
  }

  async execute(bookingId) {
    const steps = [
      {
        name:       "transition_booking",
        execute:    () => this.bookingService.transitionStatus(bookingId, "checked_out"),
        compensate: () => this.bookingService.transitionStatus(bookingId, "checked_in"),
      },
      {
        name:       "free_room",
        execute:    () => this.eventBus.request(ROOM_EVENTS.UPDATE_STATUS, { bookingId, status: "available" }),
        compensate: () => this.eventBus.request(ROOM_EVENTS.UPDATE_STATUS, { bookingId, status: "occupied" }),
      },
      {
        name:       "create_cleaning_task",
        execute:    () => this.eventBus.publish(CLEANING_EVENTS.SCHEDULE_TASK, { bookingId }),
        compensate: () => this.eventBus.publish(CLEANING_EVENTS.CANCEL_TASK,   { bookingId }),
      },
      {
        name:       "generate_receipt",
        execute:    () => this.eventBus.request(RECEIPT_EVENTS.GENERATE, { bookingId }),
        compensate: () => this.eventBus.request(RECEIPT_EVENTS.VOID,     { bookingId }),
      },
    ];

    const completed = [];
    for (const step of steps) {
      try {
        await step.execute();
        completed.push(step);
      } catch (err) {
        console.error(`Checkout saga failed at step: ${step.name}`, err.message);
        for (const done of [...completed].reverse()) {
          try { await done.compensate(); }
          catch (ce) { console.error(`Compensation failed: ${done.name}`, ce.message); }
        }
        throw new Error(`Checkout failed at '${step.name}': ${err.message}`);
      }
    }
  }
}
```

**Use-case — `checkOutBooking(bookingId)`:**
```
POST /bookings/:id/checkout
  → CheckoutSaga.execute(bookingId)

  Step 1: transition_booking  → booking.status = "checked_out"         ✓
  Step 2: free_room           → room.status = "available"               ✓
  Step 3: create_cleaning_task → cleaning task scheduled for room        ✓
  Step 4: generate_receipt    → receipt-service throws (DB error)        ✗

  → Saga runs compensations in reverse:
      cancel_task             → cleaning task removed
      room back to "occupied" → room.status = "occupied"
      booking back to "checked_in"
  → Returns 500 to client with clear error message
  → System is back to consistent state, no orphaned records
  → Staff retries checkout after fixing the issue
```

---

---

## Implemented Patterns (Active in Codebase)

### 9. Cache-Aside Pattern — Service & Category Lists (service-service)

> **Status: Implemented and active** in `server/main-services/service-service/services/serviceService.js`  
> **Cache utility:** `server/shared/utils/cache.js` (Redis via `node-redis` v5)

---

#### What Problem Does It Solve?

Every time a user opens the service management page, the frontend calls `GET /services` and `GET /services/categories`. Without caching, every single request hits MongoDB — which involves a network call, query planning, disk I/O, and serialization. For a list that changes rarely (categories stay the same for days; service definitions change only when managers update them), this is wasteful.

Redis sits between the application and MongoDB as an in-memory store. Reads from Redis are ~0.1ms. Reads from MongoDB (with network) are typically 5–50ms. For lists that are read hundreds of times per day but written to once or twice, caching dramatically reduces database load and response times.

---

#### The Pattern: Cache-Aside (Lazy Loading)

"Cache-Aside" means **the application code manages the cache manually** — it is not automatic. The database and Redis have no direct connection. The service decides when to read from cache, when to skip it, and when to invalidate it.

There are two flows:

**READ flow (cache-aside read)**
```
Request comes in
  │
  ├─ cache.get(key) ──► HIT?  ──► return cached data immediately (fast path)
  │                               no DB query at all
  │
  └─ MISS ──► query MongoDB
           ──► cache.set(key, data, TTL)   ← store for future reads
           ──► return data to caller
```

**WRITE flow (invalidate on mutation)**
```
Create / Update / Delete triggers
  │
  ├─ write to MongoDB (source of truth)
  │
  └─ cache.del / cache.delByPattern   ← wipe the affected cache keys
                                         next READ will miss → refetch fresh data
```

The key rule: **on write, you delete the cache — you never update it directly.** This is safer than updating: if the write partially fails, you don't risk caching inconsistent data.

---

#### How It Is Implemented Here

**`getAllServiceCategories` — the READ side**

```js
// serviceService.js
async getAllServiceCategories({ page = 1, limit = 50, search } = {}) {
    // 1. Build a deterministic cache key from the query params
    const cacheKey = `svc_cat:all:${JSON.stringify([Number(page), Number(limit), search || null])}`;

    // 2. Try the cache first
    const cached = await cache.get(cacheKey);
    if (cached) return cached;  // ← fast path, MongoDB not touched

    // 3. Cache miss — go to MongoDB
    const [categories, total] = await Promise.all([
        this.ServiceCategory.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        this.ServiceCategory.countDocuments(q),
    ]);

    const result = { categories, total, page: Number(page), limit: Number(limit) };

    // 4. Store in Redis for 600 seconds (10 minutes)
    await cache.set(cacheKey, result, 600);
    return result;
}
```

**`createServiceCategory` — the WRITE side**

```js
async createServiceCategory({ name, description }, files) {
    // ... validation ...

    await category.save();  // write to MongoDB

    // Invalidate ALL cached category lists — any page, any search term
    await cache.delByPattern("svc_cat:all:*");

    return category;
}
```

---

#### Cache Key Design

Cache keys encode all the parameters that make two responses different. If page 1 and page 2 return different results, they must have different cache keys.

```
Key format:  svc_cat:all:[page, limit, search]

Examples:
  svc_cat:all:[1,50,null]          ← default, no search
  svc_cat:all:[2,50,null]          ← page 2
  svc_cat:all:[1,50,"spa"]         ← search for "spa"
  svc_cat:by:64f3a2...             ← category detail by ID
  svc:list:[null,null,null,null,null,null,1,50]   ← all services, no filters
  svc:one:64f3a2...                ← single service by ID
```

**Namespacing with prefixes** (`svc_cat:`, `svc:`) makes it easy to invalidate by group. `delByPattern("svc_cat:all:*")` wipes every page/search combination in one call, without needing to know which exact keys exist.

**Important — type consistency in keys:**  
Express query params are always **strings** (`req.query` returns `{ page: "1", limit: "50" }`), but function default values are **numbers** (`page = 1, limit = 50`). Without normalization, the same logical request could produce two different cache keys:

```
GET /categories              → page=1 (number, default)  → key: svc_cat:all:[1,50,null]
GET /categories?page=1       → page="1" (string)         → key: svc_cat:all:["1",50,null]
```

These are different strings, so they'd be stored as separate cache entries. The fix: always coerce to `Number(page)` before building the key, so both paths produce the same key.

---

#### Cache Invalidation Strategy

Different operations invalidate different scopes:

| Operation | Invalidates |
|---|---|
| `createServiceCategory` | `svc_cat:all:*` — all list caches |
| `updateServiceCategory` | `svc_cat:all:*` + `svc_cat:by:{id}` |
| `deleteServiceCategory` | `svc_cat:all:*` + `svc_cat:by:{id}` + `svc:list:*` |
| `createService` | `svc:list:*` + `svc_cat:by:{category_id}` |
| `updateService` | `svc:one:{id}` + `svc:list:*` + `svc_cat:by:{category_id}` |
| `confirmGoodTicket` | `svc:one:{id}` (per updated service) + `svc:list:*` |

The principle: **invalidate the minimum necessary scope**. Deleting more than needed is safe but wasteful (causes unnecessary DB queries on next read). Deleting less than needed causes stale data bugs.

---

#### The `delByPattern` Implementation and the SCAN vs KEYS Decision

This is the function that enables wildcard invalidation. It had a critical performance bug.

**`cache.js` — the utility**

```js
// server/shared/utils/cache.js
export const cache = {
    async get(key) { ... },
    async set(key, value, ttlSeconds = 300) { ... },
    async del(...keys) { ... },

    async delByPattern(pattern) {
        try {
            const c = await getClient();
            const keys = await c.keys(pattern);   // ← ONE command to Redis
            if (keys.length) await c.del(keys);
        } catch (err) {
            console.warn("[CACHE] delByPattern error:", err.message);
        }
    },
};
```

**Why not use `SCAN`?**

The original implementation used `scanIterator` (the Redis `SCAN` command):

```js
// ❌ OLD — what caused the ~1 minute delay
for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keys.push(key);
}
```

`SCAN` is a cursor-based command. Redis does NOT return all matching keys in one shot — it returns a batch of ~100 keys per call, hands back a cursor, and you call `SCAN` again with that cursor, repeating until the cursor reaches 0.

```
Round-trip 1:  SCAN cursor=0    MATCH svc_cat:all:* COUNT 100
               → scans 100 random keys, finds 0 matches, returns cursor=3841

Round-trip 2:  SCAN cursor=3841 MATCH svc_cat:all:* COUNT 100
               → scans 100 more keys, finds 0 matches, returns cursor=7102

...

Round-trip N:  SCAN cursor=9201 MATCH svc_cat:all:* COUNT 100
               → scans 100 keys, finds 1 match, returns cursor=0 (done!)
```

In a development environment where all microservices share one Redis instance, there can be tens of thousands of keys (bookings, rooms, employees, equipment, cleaning tasks, etc.). With `COUNT: 100`, finding a handful of `svc_cat:all:*` keys could require hundreds of round-trips — each one a network call. With any network latency, this can take seconds or even minutes.

**The fix — use `KEYS`:**

```js
// ✅ NEW — single round-trip
const keys = await c.keys(pattern);
```

`KEYS pattern` is a single Redis command that returns all matching keys at once. Redis scans its keyspace entirely in one go, in C code, and returns the result in a single response. One network round-trip instead of hundreds.

**Trade-off to be aware of:**  
`KEYS` blocks Redis while scanning — no other commands can execute during this. For a very large Redis instance (millions of keys), this blocking could cause latency spikes for other services. `SCAN` was designed specifically to avoid this. However, for a system at this scale (a hotel management system with a few thousand keys), `KEYS` is significantly faster and the blocking duration is negligible (sub-millisecond at this keyspace size).

**When to revisit this:** If the Redis instance grows to hundreds of thousands of keys and you start seeing latency spikes in unrelated services during cache invalidation, switch back to `scanIterator` and investigate why SCAN was slow (likely a very large shared keyspace — at that point, consider separating Redis instances per service).

---

#### TTL (Time-To-Live) as a Safety Net

Every cache entry has a TTL — an expiry time after which Redis automatically deletes it:

```js
await cache.set(cacheKey, result, 600);  // expires after 600 seconds (10 minutes)
```

The TTL serves as a **fallback safety net**, not the primary invalidation mechanism. If `delByPattern` somehow fails silently (errors are caught and only warned), the cache will eventually self-correct when the TTL expires. Without TTL, a failed invalidation would serve stale data forever.

Choose TTL based on how stale data can be tolerated:
- Category/service lists → 600s (10 min): these change rarely, stale data is low risk
- Availability/stock data → 30–60s: this changes frequently, stale data has business impact
- Per-user session data → 300s: balanced

---

#### What This Pattern Does NOT Do

- It does **not** keep Redis and MongoDB in sync automatically — the application code is responsible.
- It does **not** handle concurrent writes gracefully (two simultaneous creates could both miss cache and both write to DB). For this system's scale, this is acceptable.
- It does **not** cache write-heavy data (e.g., `ServiceUsage` records are not cached, since they change constantly).

---

## Integration Order (Recommended)

| Priority | Pattern              | Effort | Impact |
|----------|----------------------|--------|--------|
| 1        | State Machine        | Low    | Prevents status corruption, unblocks cron jobs |
| 2        | Result Object        | Low    | Eliminates the recurring controller/service shape mismatch bugs |
| 3        | Cache-Aside (Redis)  | Medium | Immediate performance on most-read booking queries |
| 4        | Circuit Breaker      | Medium | Prevents cascading failures when any service is down |
| 5        | Custom Hook          | Low    | Removes duplicated loading logic across all frontend pages |
| 6        | Saga (Checkout)      | High   | Correctness guarantee on the most critical operation |
| 7        | Strategy (Pricing)   | Medium | Needed once discount rules grow beyond a single code |
| 8        | Repository           | Medium | Refactor only after test coverage is in place |
