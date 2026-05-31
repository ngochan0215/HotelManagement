# Microservice Resilience Plan
# Kế hoạch tăng cường khả năng chịu lỗi cho Microservice

---

## Table of Contents / Mục lục

1. [Problem Statement / Vấn đề hiện tại](#1-problem-statement--vấn-đề-hiện-tại)
2. [Root Cause Analysis / Phân tích nguyên nhân gốc](#2-root-cause-analysis--phân-tích-nguyên-nhân-gốc)
3. [Solution Overview / Tổng quan giải pháp](#3-solution-overview--tổng-quan-giải-pháp)
4. [Circuit Breaker — How It Works / Cơ chế hoạt động](#4-circuit-breaker--how-it-works--cơ-chế-hoạt-động)
5. [Call Classification / Phân loại các lời gọi](#5-call-classification--phân-loại-các-lời-gọi)
6. [Implementation Phases / Các giai đoạn thực hiện](#6-implementation-phases--các-giai-đoạn-thực-hiện)
7. [Affected Files / Các file bị ảnh hưởng](#7-affected-files--các-file-bị-ảnh-hưởng)
8. [Out of Scope / Ngoài phạm vi](#8-out-of-scope--ngoài-phạm-vi)
9. [Coding Convention / Quy ước viết code](#9-coding-convention--quy-ước-viết-code)

---

## 1. Problem Statement / Vấn đề hiện tại

### English

In the current architecture, when **Service B** crashes or becomes unavailable, **Service A** (which depends on Service B for some of its data) also fails completely — even when the data from Service B is only supplementary (e.g., enriching a list with extra details).

**Concrete example:** `room-service` calls `equipment-service` to get equipment category names when listing room categories. If `equipment-service` is down, the entire room category listing fails, and the UI shows nothing — even though room category data is stored locally in `room-service`'s own database and is perfectly available.

There are two distinct problems:

**Problem 1 — No real circuit breaker:**
`safeRequest` is currently just a `try-catch` wrapper. When a service is down, every single call still waits the full **5-second timeout** before failing. Under load, this means each incoming request holds a connection open for 5 seconds even though the answer is obviously "service is unavailable." This degrades the entire system, not just the failed dependency.

**Problem 2 — Callers treat enrichment as fatal:**
After `safeRequest` returns `{ success: false }`, the calling code immediately does `throw new Error(reply.message)` — even in read/listing endpoints where the core data was already fetched from the local database. There is no distinction between a *critical* failure (the operation genuinely cannot continue) and an *enrichment* failure (some supplementary details are missing, but the core response is still valid).

---

### Tiếng Việt

Trong kiến trúc hiện tại, khi **Service B** bị crash hoặc không phản hồi, **Service A** (phụ thuộc vào Service B để lấy một phần dữ liệu) cũng bị lỗi hoàn toàn — dù dữ liệu từ Service B chỉ là dữ liệu bổ sung (ví dụ: enrich danh sách với thông tin thêm).

**Ví dụ cụ thể:** `room-service` gọi sang `equipment-service` để lấy tên danh mục thiết bị khi hiển thị danh sách loại phòng. Nếu `equipment-service` bị crash, toàn bộ API lấy danh sách loại phòng thất bại và UI không hiển thị gì — dù dữ liệu loại phòng đã có sẵn trong database của chính `room-service`.

Có hai vấn đề riêng biệt:

**Vấn đề 1 — Không có circuit breaker thực sự:**
`safeRequest` hiện tại chỉ là một `try-catch` đơn giản. Khi một service bị down, mỗi lời gọi vẫn phải chờ hết **5 giây timeout** mới trả về lỗi. Điều này khiến mỗi request đến đều bị block 5 giây, làm chậm toàn bộ hệ thống.

**Vấn đề 2 — Caller xử lý enrichment như lỗi nghiêm trọng:**
Sau khi `safeRequest` trả về `{ success: false }`, code lập tức `throw new Error(reply.message)` — kể cả trong các API đọc/liệt kê mà dữ liệu chính đã được lấy từ database nội bộ. Không có sự phân biệt giữa lỗi *nghiêm trọng* (operation thực sự không thể tiếp tục) và lỗi *enrich* (chỉ thiếu một số thông tin bổ sung, nhưng response vẫn có giá trị).

---

## 2. Root Cause Analysis / Phân tích nguyên nhân gốc

### English

The system has two types of cross-service calls that are currently handled identically but should not be:

| Type | Description | Correct behavior on failure |
|---|---|---|
| **Critical** | The operation cannot produce a correct result without this data (e.g., checking if a room is available before booking it) | Throw — surface the error to the caller |
| **Enrichment** | The core data is already available; this call only adds supplementary details (e.g., adding equipment names to a room category list) | Degrade gracefully — return the core data with `null` / `[]` for the missing field |

Currently, **both types are handled identically with `throw`**, which means even enrichment failures cascade into full request failures.

---

### Tiếng Việt

Hệ thống có hai loại lời gọi cross-service đang được xử lý giống nhau nhưng không nên như vậy:

| Loại | Mô tả | Hành vi đúng khi lỗi |
|---|---|---|
| **Critical (nghiêm trọng)** | Operation không thể trả về kết quả đúng nếu thiếu dữ liệu này (VD: kiểm tra phòng có trống không trước khi đặt) | Throw — trả lỗi về cho caller |
| **Enrichment (bổ sung)** | Dữ liệu chính đã có sẵn; lời gọi này chỉ thêm thông tin phụ (VD: thêm tên thiết bị vào danh sách loại phòng) | Graceful degrade — trả dữ liệu chính với `null` / `[]` cho trường bị thiếu |

Hiện tại, **cả hai loại đều được xử lý giống nhau bằng `throw`**, khiến ngay cả lỗi enrichment cũng làm hỏng toàn bộ request.

---

## 3. Solution Overview / Tổng quan giải pháp

### English

The solution has two complementary parts:

**Part A — Real circuit breaker** (infrastructure layer):
Replace the current `try-catch` in `safeRequest` with a proper circuit breaker that tracks the health of each downstream service. When a service is down, subsequent calls fail immediately (no timeout wait). After a recovery window, the circuit automatically probes the service; if it responds, normal operation resumes.

**Part B — Graceful degradation** (business logic layer):
Fix all enrichment-type calls so that a `success: false` reply from a downstream service means "return the core data with an empty/null field" rather than "throw and return nothing."

Together, these ensure:
- Callers get a useful (if partial) response immediately, even when dependencies are down
- The system stops wasting time on 5-second timeouts for known-down services
- Recovery is automatic — no manual intervention needed

---

### Tiếng Việt

Giải pháp gồm hai phần bổ trợ nhau:

**Phần A — Circuit breaker thực sự** (tầng infrastructure):
Thay thế `try-catch` hiện tại trong `safeRequest` bằng một circuit breaker đúng nghĩa, theo dõi trạng thái health của từng downstream service. Khi một service bị down, các lời gọi tiếp theo thất bại ngay lập tức (không chờ timeout). Sau một khoảng thời gian phục hồi, circuit tự động probe service; nếu service đã hoạt động trở lại, mọi thứ phục hồi bình thường.

**Phần B — Graceful degradation** (tầng business logic):
Sửa tất cả các enrichment call để khi nhận `success: false` từ downstream service, hàm trả về dữ liệu chính với trường bị thiếu là `null`/`[]`, thay vì throw và không trả về gì.

Kết hợp lại, hai phần này đảm bảo:
- Caller nhận được response hữu ích (dù có thể thiếu một phần) ngay cả khi dependency bị down
- Hệ thống không lãng phí 5 giây timeout cho các service đã biết là down
- Recovery diễn ra tự động — không cần can thiệp thủ công

---

## 4. Circuit Breaker — How It Works / Cơ chế hoạt động

### English

The circuit breaker has three states:

```
          N consecutive failures
CLOSED ──────────────────────────► OPEN
  ▲                                  │
  │                        recoveryTimeout ms
  │                                  ▼
  └────── probe succeeds ──── HALF_OPEN
               │
               └── probe fails ──► OPEN (reset timer)
```

| State | Meaning | Behavior |
|---|---|---|
| **CLOSED** | Service is healthy | All requests go through normally |
| **OPEN** | Service is down | Requests fail immediately with the fallback — no RabbitMQ call, no waiting |
| **HALF_OPEN** | Recovery window has passed; testing | One probe request is allowed through; if it succeeds → CLOSED; if it fails → OPEN |

**Configuration (defaults):**
- `failureThreshold`: **3** consecutive failures to trip the circuit to OPEN
- `recoveryTimeout`: **30 000 ms** (30 seconds) before transitioning OPEN → HALF_OPEN

**Keying:** The circuit breaker is keyed **per downstream service**, derived from the event prefix before the first dot.

| Event prefix | Service |
|---|---|
| `equipment.*` | equipment-service |
| `booking.*` | booking-service |
| `customer.*` | customer-service |
| `employee.*` | employee-service |
| `incident.*` | incident-service |
| `room.*` | room-service |
| `user.*` | auth/user-service |
| `service.*` | service-service |
| `payment.*` | payment-service |

This means if `equipment-service` is down, ALL equipment events trip the same circuit — as they should, since they all go to the same crashed process.

---

### Tiếng Việt

Circuit breaker có ba trạng thái:

```
          N lần thất bại liên tiếp
CLOSED ──────────────────────────► OPEN
  ▲                                  │
  │                        recoveryTimeout ms
  │                                  ▼
  └────── probe thành công ─── HALF_OPEN
               │
               └── probe thất bại ──► OPEN (reset timer)
```

| Trạng thái | Ý nghĩa | Hành vi |
|---|---|---|
| **CLOSED** | Service đang healthy | Tất cả request đi qua bình thường |
| **OPEN** | Service đang down | Request thất bại ngay lập tức với fallback — không gọi RabbitMQ, không chờ đợi |
| **HALF_OPEN** | Recovery window đã qua; đang kiểm tra | Cho phép một probe request đi qua; nếu thành công → CLOSED; nếu thất bại → OPEN |

**Cấu hình (mặc định):**
- `failureThreshold`: **3** lần thất bại liên tiếp để mở circuit thành OPEN
- `recoveryTimeout`: **30 000 ms** (30 giây) trước khi chuyển OPEN → HALF_OPEN

**Keying:** Circuit breaker được tổ chức theo **từng downstream service**, lấy từ prefix của event (trước dấu chấm đầu tiên).

---

## 5. Call Classification / Phân loại các lời gọi

### English

When writing a cross-service call, ask: **"If this call fails, can the caller still return a meaningful response?"**

- **Yes** → Enrichment call. Handle `success: false` gracefully. Never throw inside populate/enrich functions.
- **No** → Critical call. Keep the `throw`. The operation genuinely cannot produce a correct result without this data.

**Examples of CRITICAL calls (keep throwing):**
- Checking room availability before creating a booking
- Validating a customer exists before processing payment
- Updating room status after check-in/check-out
- Any write operation that depends on data from another service

**Examples of ENRICHMENT calls (degrade gracefully):**
- Adding equipment category names to a room category list response
- Adding customer/employee names to a booking list response
- Adding user info to a receipt or incident report
- Adding room details to a service usage list

---

### Tiếng Việt

Khi viết một cross-service call, hãy tự hỏi: **"Nếu call này thất bại, caller có thể trả về response có ý nghĩa không?"**

- **Có** → Enrichment call. Xử lý `success: false` một cách graceful. Không bao giờ throw bên trong các hàm populate/enrich.
- **Không** → Critical call. Giữ nguyên `throw`. Operation thực sự không thể trả kết quả đúng nếu thiếu dữ liệu này.

**Ví dụ về CRITICAL calls (giữ nguyên throw):**
- Kiểm tra phòng có trống không trước khi tạo booking
- Xác nhận customer tồn tại trước khi xử lý thanh toán
- Cập nhật trạng thái phòng sau check-in/check-out
- Bất kỳ write operation nào phụ thuộc vào dữ liệu từ service khác

**Ví dụ về ENRICHMENT calls (degrade gracefully):**
- Thêm tên danh mục thiết bị vào response danh sách loại phòng
- Thêm tên khách hàng/nhân viên vào response danh sách booking
- Thêm thông tin user vào receipt hoặc incident report
- Thêm thông tin phòng vào danh sách service usage

---

## 6. Implementation Phases / Các giai đoạn thực hiện

### Phase 1 — Circuit Breaker Infrastructure
**Risk: Low | Dependency: None**

**Files changed:**
- `server/shared/messaging/circuitBreaker.js` — NEW file
- `server/shared/messaging/eventBus.js` — Updated `safeRequest`

**What happens:**
- Create the `CircuitBreaker` class with CLOSED/OPEN/HALF_OPEN state machine
- `EventBus` maintains one `CircuitBreaker` instance per service (keyed by event prefix)
- `safeRequest` checks the circuit before making a call: if OPEN, return fallback immediately; otherwise call `request()` and record success/failure
- Public API of `safeRequest(event, data, fallback)` is **unchanged** — no callers need updating just for this phase

**Effect:** After this phase, the 5-second timeout per request on a down service is eliminated. The system fails fast and recovers automatically.

---

### Phase 2 — Fix Pattern A: Direct `!reply.success → throw` (enrichment type)
**Risk: Low | Dependency: Phase 1**

These are places where `safeRequest` is called directly inside a read/listing method, and the code immediately throws on `!reply.success` even though the call was only enriching the response.

**Files and methods to fix:**

| Service | File | Method | Failing call | Graceful behavior |
|---|---|---|---|---|
| room-service | `roomService.js` | `getAllRoomCategoriesService` | `EQUIPMENT_EVENTS.GET_CATEGORIES_INFO` | Keep `equipmentCategoryMap = {}`; each category gets `default_equipments: []` |
| room-service | `roomService.js` | `getRoomCategoryByIdService` | `EQUIPMENT_EVENTS.GET_CATEGORIES_INFO` | Return category with `default_equipments: []` (raw records without enriched names) |
| room-service | `roomService.js` | `getDefaultEquipmentsService` | `EQUIPMENT_EVENTS.GET_CATEGORIES_INFO` | Return raw default equipment rows without category metadata |
| booking-service | `bookingService.js` | `createCustomerBooking` | Auto-discount application | Skip discount silently; proceed with full price |
| customer-service | `customerService.js` | `getAllCustomers` | User info enrichment | Return customers with `user: null` |

All Pattern A entries classified as **CRITICAL** (room conflict checks, booking state transitions, all write operations) are intentionally left unchanged.

---

### Phase 3 — Fix Pattern B: Populate/enrich helpers
**Risk: Medium | Dependency: Phase 1**

These are shared helper/populate functions called inside read/listing methods. They currently throw if any cross-service call inside them fails, poisoning the entire list response.

**Fix pattern (same for all):** Each function wraps its `safeRequest` call(s) so that on failure it returns the input items with `null` / `[]` for the field that could not be populated. The function signature and return shape stay identical — callers do not change.

| Service | File | Functions to fix |
|---|---|---|
| booking-service | `bookingService.js` | `populateCustomerAndEmployee`, `populateRoom` |
| incident-service | `incidentService.js` | `populateReporterAndCauser`, `populateRoom` |
| incident-service | `compensationService.js` | `populateEquipmentDetails`, `populateReporterAndCauser`, `populateRoom` |
| payment-service | `paymentHelpers.js` | `enrichReceipts`, `populateBookingPeople` |
| equipment-service | `equipmentService.js` | `populateRoom` |
| equipment-service | `equipmentInstallService.js` | `populateEmployeeAndHandler`, `populateRoom` |
| service-service | `serviceHelpers.js` | `enrichServiceUsages`, `enrichSingleServiceUsage` |

Phase 2 and Phase 3 can be worked on in **parallel across different services** since each service is isolated. Within the same service, Phase 2 should be completed before Phase 3.

---

### Phase 4 — Convention documentation
**Risk: None | Dependency: Phase 3**

Add a short entry to `CLAUDE.md` (or this file) codifying the critical vs enrichment distinction, so new code written by any team member follows the same pattern going forward.

---

## 7. Affected Files / Các file bị ảnh hưởng

```
server/
  shared/
    messaging/
      circuitBreaker.js         ← NEW (Phase 1)
      eventBus.js               ← UPDATED (Phase 1)

  main-services/
    room-service/
      services/
        roomService.js          ← UPDATED (Phase 2)

    booking-service/
      services/
        bookingService.js       ← UPDATED (Phase 2 + Phase 3)

    customer-service/
      services/
        customerService.js      ← UPDATED (Phase 2)

    incident-service/
      services/
        incidentService.js      ← UPDATED (Phase 3)
        compensationService.js  ← UPDATED (Phase 3)

    payment-service/
      services/
        paymentHelpers.js       ← UPDATED (Phase 3)

    equipment-service/
      services/
        equipmentService.js     ← UPDATED (Phase 3)
        equipmentInstallService.js ← UPDATED (Phase 3)

    service-service/
      services/
        serviceHelpers.js       ← UPDATED (Phase 3)
```

---

## 8. Out of Scope / Ngoài phạm vi

### English

The following are explicitly **not** part of this plan:

- **Automatic UI refresh when a circuit re-closes:** The HALF_OPEN probe re-enables full data on the *next* incoming HTTP request — the already-returned response cannot be updated retroactively. A true push (so the browser automatically shows complete data without a refresh) requires WebSocket or Server-Sent Events, which is a separate feature.

- **Service process restart:** The circuit breaker handles the *caller's* resilience. Whether a crashed service restarts automatically is a process manager concern — PM2 `--restart-delay`, Docker `restart: always`, Kubernetes `restartPolicy` — not an application-code concern.

- **All Pattern A CRITICAL calls:** Intentionally left throwing. If a service is required for the correctness of an operation (not just for enrichment), a degraded answer is wrong, not just incomplete.

---

### Tiếng Việt

Các điều sau đây **không** nằm trong phạm vi kế hoạch này:

- **UI tự động cập nhật khi circuit re-closes:** Probe HALF_OPEN cho phép lấy đủ dữ liệu ở *request HTTP tiếp theo* — response đã trả về không thể cập nhật ngược. Để browser tự động hiển thị dữ liệu đầy đủ mà không cần refresh cần WebSocket hoặc Server-Sent Events — đây là một tính năng riêng biệt.

- **Tự động restart service bị crash:** Circuit breaker xử lý khả năng chịu lỗi của *caller*. Việc service bị crash có tự restart không là vấn đề của process manager — PM2, Docker, Kubernetes — không phải của application code.

- **Tất cả Pattern A CRITICAL calls:** Cố tình giữ nguyên throw. Nếu một service thực sự cần thiết cho tính đúng đắn của một operation (không chỉ để enrich), một kết quả thiếu thông tin là sai, không chỉ là không đầy đủ.

---

## 9. Coding Convention / Quy ước viết code

### English

**When writing any new cross-service call, apply this decision rule:**

```
Is the call result required for the operation to be correct?
│
├─ YES → Critical call
│        Use a helper that throws (e.g., findBookingById, findCustomerById).
│        Let the error propagate.
│
└─ NO  → Enrichment call
         Use safeRequest with a fallback.
         On success: use the data.
         On !success: assign null / [] and continue.
         NEVER throw inside a populate/enrich function.
```

**Wrong (enrichment treated as critical):**
```js
const reply = await this.eventBus.safeRequest(EQUIPMENT_EVENTS.GET_CATEGORIES_INFO, { categoryIds });
if (!reply.success) throw new Error(reply.message); // ← WRONG for enrichment
```

**Correct (enrichment with graceful degradation):**
```js
const reply = await this.eventBus.safeRequest(EQUIPMENT_EVENTS.GET_CATEGORIES_INFO, { categoryIds });
const categoryMap = {};
if (reply.success) {
    for (const cat of reply.categories) {
        categoryMap[cat._id.toString()] = cat;
    }
}
// continue — categoryMap is empty if service was down, enriched fields will be null/[]
```

---

### Tiếng Việt

**Khi viết bất kỳ cross-service call mới nào, áp dụng quy tắc sau:**

```
Kết quả của call có cần thiết để operation trả về kết quả đúng không?
│
├─ CÓ → Critical call
│        Dùng helper có throw (VD: findBookingById, findCustomerById).
│        Để error propagate lên trên.
│
└─ KHÔNG → Enrichment call
            Dùng safeRequest với fallback.
            Thành công: dùng dữ liệu.
            !success: gán null / [] và tiếp tục.
            KHÔNG BAO GIỜ throw bên trong hàm populate/enrich.
```

**Sai (enrichment bị xử lý như critical):**
```js
const reply = await this.eventBus.safeRequest(EQUIPMENT_EVENTS.GET_CATEGORIES_INFO, { categoryIds });
if (!reply.success) throw new Error(reply.message); // ← SAI cho enrichment call
```

**Đúng (enrichment với graceful degradation):**
```js
const reply = await this.eventBus.safeRequest(EQUIPMENT_EVENTS.GET_CATEGORIES_INFO, { categoryIds });
const categoryMap = {};
if (reply.success) {
    for (const cat of reply.categories) {
        categoryMap[cat._id.toString()] = cat;
    }
}
// tiếp tục — categoryMap rỗng nếu service bị down, các enriched field sẽ là null/[]
```

---

*Document maintained by the backend team. Update this file whenever the resilience strategy changes.*
*Tài liệu được duy trì bởi backend team. Cập nhật file này khi chiến lược resilience thay đổi.*
