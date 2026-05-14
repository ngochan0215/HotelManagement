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
