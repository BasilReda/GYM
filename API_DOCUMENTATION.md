# GYMAWY — API Documentation

**Base URL:** `http://localhost:3000/api`  
**Auth:** Bearer token in `Authorization` header  
**Content-Type:** `application/json` for all requests with a body

---

## Authentication

All endpoints (except `/api/auth/login` and `/api/stripe/config`) require a valid JWT token.

Include the token in every request:
```
Authorization: Bearer <token>
```

Tokens expire after **24 hours**. On expiry the server returns `401` and the app redirects to login.

---

## Error Format

All errors follow this shape:

```json
{ "error": "Human-readable error message" }
```

Common status codes:

| Code | Meaning |
|---|---|
| `400` | Bad request / missing fields |
| `401` | Missing or expired token |
| `403` | Role not permitted |
| `404` | Resource not found |
| `409` | Conflict (duplicate, already checked in) |
| `500` | Server error |

---

## Roles

`owner` › `manager` › `reception` › `trainer` › `member`

Each endpoint lists the minimum roles allowed. Owner always has access to everything.

---

---

## Auth — `/api/auth`

### POST `/api/auth/login`
No token required.

**Request:**
```json
{
  "email": "owner@gymdesk.com",
  "password": "Owner@123"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Owner",
    "email": "owner@gymdesk.com",
    "role": "owner",
    "language": "en"
  }
}
```

---

### GET `/api/auth/me`
Returns the currently logged-in user's profile.

**Response `200`:**
```json
{
  "id": 1,
  "name": "Owner",
  "email": "owner@gymdesk.com",
  "role": "owner",
  "language": "en",
  "is_active": 1
}
```

---

### PUT `/api/auth/language`
Set preferred language (`en` or `ar`).

**Request:**
```json
{ "language": "ar" }
```

**Response `200`:** `{ "success": true }`

---

### PUT `/api/auth/password`
Change the logged-in user's own password.

**Request:**
```json
{
  "current_password": "OldPass@123",
  "new_password": "NewPass@456"
}
```

**Response `200`:** `{ "success": true }`

---

---

## Members — `/api/members`

Roles: `owner`, `manager`, `reception` (read: also `trainer`)

### GET `/api/members`
Returns all active members. Supports query filters.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Name, phone, or member code (partial match) |
| `status` | string | `active`, `expiring_soon`, `expired`, `suspended` |
| `plan_id` | number | Filter by plan |

**Response `200`:** Array of member objects.

```json
[
  {
    "id": 5,
    "member_code": "GDM-2026-0001",
    "name": "Ahmed Ali",
    "phone": "01012345678",
    "email": "ahmed@example.com",
    "dob": "1995-03-15",
    "plan_id": 2,
    "plan_name": "Monthly",
    "start_date": "2026-05-01",
    "end_date": "2026-06-01",
    "status": "expired",
    "qr_hash": "a1b2c3d4e5f6a7b8"
  }
]
```

---

### GET `/api/members/:id`
Returns a single member.

---

### POST `/api/members`
Create a new member.

**Request:**
```json
{
  "name": "Sara Hassan",
  "phone": "01098765432",
  "email": "sara@example.com",
  "dob": "2000-07-20",
  "emergency_contact": "01011112222",
  "notes": "Prefers morning sessions",
  "plan_id": 1,
  "start_date": "2026-06-01",
  "create_login": true,
  "login_password": "Sara@12345"
}
```

> Set `create_login: true` + `email` + `login_password` to also create a member portal account.

**Response `201`:** Created member object with `login_created: true/false`.

---

### PUT `/api/members/:id`
Update member details. Send only the fields you want to change.

**Request:**
```json
{
  "plan_id": 3,
  "start_date": "2026-06-10",
  "notes": "Updated notes"
}
```

**Response `200`:** Updated member object.

---

### DELETE `/api/members/:id`
Soft-deletes the member (sets `is_active = 0`). Data is preserved.

**Response `200`:** `{ "success": true }`

---

### GET `/api/members/:id/qr`
Returns a Base64 QR code image for the member's attendance card.

**Response `200`:**
```json
{
  "qr": "data:image/png;base64,...",
  "member_code": "GDM-2026-0001"
}
```

---

### POST `/api/members/:id/suspend`
Suspends a member. Roles: `owner`, `manager`.

**Response `200`:** `{ "success": true }`

---

### POST `/api/members/:id/reactivate`
Reactivates a suspended member. Roles: `owner`, `manager`.

**Response `200`:** `{ "success": true }`

---

---

## Subscription Plans — `/api/subscriptions`

### GET `/api/subscriptions`
Returns all plans (active and inactive).

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "Monthly",
    "duration_days": 30,
    "price": 250.00,
    "description": "Full access",
    "is_active": 1
  }
]
```

---

### POST `/api/subscriptions`
Create a new plan. Role: `owner`.

**Request:**
```json
{
  "name": "Quarterly",
  "duration_days": 90,
  "price": 600.00,
  "description": "3-month access"
}
```

**Response `201`:** Created plan object.

---

### PUT `/api/subscriptions/:id`
Update a plan. Role: `owner`. Send only fields to change.

---

### DELETE `/api/subscriptions/:id`
Deactivates a plan (`is_active = 0`). Role: `owner`.

**Response `200`:** `{ "success": true }`

---

---

## Payments — `/api/payments`

Roles: `owner`, `manager`, `reception`

### GET `/api/payments`
Returns payment history (last 500 records). Supports filters.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `member_id` | number | Filter by member |
| `from` | date `YYYY-MM-DD` | Start date |
| `to` | date `YYYY-MM-DD` | End date |

**Response `200`:**
```json
[
  {
    "id": 12,
    "member_id": 5,
    "member_name": "Ahmed Ali",
    "member_code": "GDM-2026-0001",
    "amount": 250.00,
    "method": "cash",
    "payment_date": "2026-06-01",
    "plan_id": 2,
    "plan_name": "Monthly",
    "notes": null,
    "recorded_by_name": "Reception"
  }
]
```

---

### POST `/api/payments`
Record a new payment (cash / card / bank transfer).

**Request:**
```json
{
  "member_id": 5,
  "amount": 250.00,
  "method": "cash",
  "payment_date": "2026-06-10",
  "plan_id": 2,
  "notes": "Paid at front desk"
}
```

> `method` must be one of: `cash`, `card`, `bank_transfer`  
> If `plan_id` is included, the member's subscription end date is automatically extended.

**Response `201`:** Created payment object.

---

### GET `/api/payments/summary`
Monthly revenue summary. Roles: `owner`, `manager`.

**Response `200`:**
```json
{
  "this_month": 4750.00,
  "last_month": 3900.00,
  "monthly": [
    { "month": "2026-01", "total": 3200.00, "count": 14 },
    { "month": "2026-02", "total": 3500.00, "count": 16 }
  ]
}
```

---

### GET `/api/payments/overdue`
Members expired more than 30 days ago with no recent payment.

**Response `200`:** Array of member objects with `last_payment` field.

---

---

## Stripe — `/api/stripe`

### GET `/api/stripe/config`
Returns the Stripe publishable key. No auth required.

**Response `200`:**
```json
{
  "publishableKey": "pk_test_...",
  "currency": "usd"
}
```

---

### POST `/api/stripe/create-payment-intent`
Creates a Stripe PaymentIntent for a plan purchase. Auth required.

**Request:**
```json
{
  "plan_id": 2,
  "member_id": 5
}
```

> `member_id` is optional when called by a `member` role user (inferred from session).

**Response `200`:**
```json
{
  "clientSecret": "pi_3abc..._secret_xyz",
  "paymentIntentId": "pi_3abc...",
  "amount": 250.00,
  "currency": "usd"
}
```

---

### POST `/api/stripe/record-payment`
Called by the frontend **after** `stripe.confirmCardPayment()` succeeds.  
Verifies the payment with Stripe, records it in the DB, and extends the subscription.

**Request:**
```json
{
  "paymentIntentId": "pi_3abc..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Payment successful! Subscription renewed.",
  "payment_id": 42,
  "new_end_date": "2026-07-10",
  "days_left": 30
}
```

> This endpoint is **idempotent** — calling it twice with the same `paymentIntentId` returns success without double-recording.

---

---

## Attendance — `/api/attendance`

Roles: `owner`, `manager`, `reception` (check-in); `trainer` (read)

### POST `/api/attendance/checkin`
Manual check-in by member code or member ID.

**Request:**
```json
{
  "member_code": "GDM-2026-0001",
  "method": "staff"
}
```

or:

```json
{
  "member_id": 5,
  "method": "staff"
}
```

> `method`: `qr`, `manual`, or `staff`  
> Duplicate check-ins within 2 hours are rejected with `409`.

**Response `200`:**
```json
{
  "success": true,
  "member_name": "Ahmed Ali",
  "member_code": "GDM-2026-0001",
  "attendance_id": 88
}
```

---

### POST `/api/attendance/qr-checkin`
Check-in via QR scan. The QR payload is a signed JSON string.

**Request:**
```json
{
  "qr_data": "{\"code\":\"GDM-2026-0001\",\"hash\":\"a1b2c3d4e5f6a7b8\"}"
}
```

**Response `200`:** Same as `/checkin`.

> The `hash` is an HMAC-SHA256 signature generated server-side. Invalid or forged QR codes are rejected.

---

### GET `/api/attendance`
Attendance records. Supports filters.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `date` | `YYYY-MM-DD` | Filter by specific day |
| `from` | `YYYY-MM-DD` | Start of range |
| `to` | `YYYY-MM-DD` | End of range |
| `member_id` | number | Filter by member |

**Response `200`:** Array of attendance records with `member_name`, `member_code`, `recorded_by_name`.

---

### GET `/api/attendance/today-count`
Quick count of today's check-ins.

**Response `200`:** `{ "count": 14 }`

---

### GET `/api/attendance/member/:id`
Full check-in history for a specific member.

**Response `200`:** Array of `{ check_in_time, method, recorded_by_name }`.

---

---

## Dashboard — `/api/dashboard`

Roles: `owner`, `manager`, `reception` (stats); `owner`, `manager` (user management)

### GET `/api/dashboard/stats`
All home screen statistics in one call.

**Response `200`:**
```json
{
  "total_active": 87,
  "total_members": 102,
  "expired": 12,
  "expiring_soon": 8,
  "today_checkins": 23,
  "month_revenue": 4750.00,
  "expiring_list": [
    {
      "id": 5,
      "name": "Ahmed Ali",
      "member_code": "GDM-2026-0001",
      "phone": "01012345678",
      "end_date": "2026-06-14",
      "days_left": 4
    }
  ],
  "membership_chart": [
    { "month": "2026-01", "new_members": 12 }
  ],
  "revenue_chart": [
    { "month": "2026-01", "revenue": 3200.00 }
  ],
  "recent_checkins": [
    {
      "check_in_time": "2026-06-10T09:15:00",
      "name": "Ahmed Ali",
      "member_code": "GDM-2026-0001",
      "method": "qr"
    }
  ]
}
```

---

### GET `/api/dashboard/users`
All system users (staff accounts). Roles: `owner`, `manager`.

**Response `200`:** Array of user objects (no password hashes).

---

### POST `/api/dashboard/users`
Create a new staff user. Role: `owner`.

**Request:**
```json
{
  "name": "Layla Ahmed",
  "email": "layla@gym.com",
  "password": "Layla@123",
  "role": "reception"
}
```

> `role` must be one of: `owner`, `manager`, `reception`, `trainer`, `member`

**Response `201`:** Created user object.

---

### PATCH `/api/dashboard/users/:id/toggle`
Activate or deactivate a user account. Role: `owner`.

**Response `200`:** `{ "success": true, "is_active": false }`

---

---

## Trainers — `/api/trainers`

### GET `/api/trainers`
All active trainers. Auth required, all roles.

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "Khaled Samir",
    "specialization": "CrossFit",
    "phone": "01055556666",
    "email": "khaled@gym.com",
    "bio": "5 years experience",
    "is_active": 1
  }
]
```

---

### GET `/api/trainers/:id`
Single trainer by ID.

---

### POST `/api/trainers`
Create a trainer. Roles: `owner`, `manager`.

**Request:**
```json
{
  "name": "Mona Farid",
  "specialization": "Yoga",
  "phone": "01077778888",
  "email": "mona@gym.com",
  "bio": "Certified yoga instructor"
}
```

**Response `201`:** Created trainer object.

---

### PUT `/api/trainers/:id`
Update a trainer. Roles: `owner`, `manager`.

---

### DELETE `/api/trainers/:id`
Deactivate a trainer. Roles: `owner`, `manager`.

**Response `200`:** `{ "success": true }`

---

---

## Classes — `/api/classes`

### GET `/api/classes/types`
All active class types with default trainer info.

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "CrossFit",
    "description": "High-intensity workout",
    "capacity": 15,
    "duration_minutes": 60,
    "default_trainer_id": 1,
    "trainer_name": "Khaled Samir"
  }
]
```

---

### POST `/api/classes/types`
Create a class type. Roles: `owner`, `manager`.

**Request:**
```json
{
  "name": "Zumba",
  "description": "Dance fitness",
  "capacity": 20,
  "duration_minutes": 45,
  "default_trainer_id": 2
}
```

**Response `201`:** Created class type object.

---

### GET `/api/classes/sessions`
Class sessions list. Supports filters.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Start date |
| `to` | `YYYY-MM-DD` | End date |
| `trainer_id` | number | Filter by trainer |

> Trainer role users only see their own sessions.

**Response `200`:**
```json
[
  {
    "id": 10,
    "class_name": "CrossFit",
    "trainer_name": "Khaled Samir",
    "room": "Hall A",
    "session_date": "2026-06-12",
    "start_time": "09:00",
    "end_time": "10:00",
    "status": "scheduled",
    "capacity": 15
  }
]
```

---

### POST `/api/classes/sessions`
Schedule a new session. Roles: `owner`, `manager`.

**Request:**
```json
{
  "class_type_id": 1,
  "trainer_id": 1,
  "room": "Hall A",
  "session_date": "2026-06-15",
  "start_time": "09:00",
  "end_time": "10:00"
}
```

> Trainer double-booking is automatically detected and rejected with `409`.

**Response `201`:** Created session object.

---

### GET `/api/classes/sessions/:id/attendance`
Attendance list for a session. Roles: `owner`, `manager`, `reception`, `trainer`.

**Response `200`:** Array of `{ member_name, member_code, status }`.

---

### POST `/api/classes/sessions/:id/attendance`
Mark a member's attendance for a session. Roles: `owner`, `manager`, `reception`, `trainer`.

**Request:**
```json
{
  "member_id": 5,
  "status": "present"
}
```

> `status`: `present`, `absent`, or `late`

**Response `201`:** `{ "success": true }`

---

---

## Member Portal — `/api/portal`

All routes require `member` role.

### GET `/api/portal/me`
Member's own profile and subscription status.

**Response `200`:**
```json
{
  "id": 5,
  "member_code": "GDM-2026-0001",
  "name": "Ahmed Ali",
  "plan_name": "Monthly",
  "plan_price": 250.00,
  "start_date": "2026-06-01",
  "end_date": "2026-07-01",
  "status": "active",
  "days_left": 21
}
```

---

### GET `/api/portal/attendance`
Member's own check-in history and stats.

**Response `200`:**
```json
{
  "records": [
    { "check_in_time": "2026-06-10T09:00:00", "method": "qr" }
  ],
  "this_month": 8,
  "this_year": 42,
  "last_30": {
    "2026-06-10": 1,
    "2026-06-09": 0
  }
}
```

---

### POST `/api/portal/checkin`
Member self check-in (no staff needed).

**Response `200`:** `{ "success": true, "message": "Checked in successfully!" }`

---

### GET `/api/portal/notifications`
Member's unread notifications (last 20).

**Response `200`:** Array of notification objects.

---

---

## Data Models

### Member Status Values
| Value | Description |
|---|---|
| `active` | Subscription valid, more than 7 days remaining |
| `expiring_soon` | Subscription expires within 7 days |
| `expired` | Subscription end date has passed |
| `suspended` | Manually suspended by staff |

### Payment Method Values
`cash` · `card` · `bank_transfer`

### Attendance Method Values
`qr` · `manual` · `staff`

### User Role Values
`owner` · `manager` · `reception` · `trainer` · `member`

---

## Stripe Payment Flow

```
Frontend                          Backend                        Stripe
   |                                 |                              |
   |-- POST /stripe/create-intent -->|                              |
   |                                 |-- stripe.paymentIntents.create -->|
   |<-- { clientSecret } -----------|<-- PaymentIntent -------------|
   |                                 |                              |
   |-- stripe.confirmCardPayment() --------------------------------->|
   |<-- { paymentIntent: { status: 'succeeded' } } ---------------- |
   |                                 |                              |
   |-- POST /stripe/record-payment ->|                              |
   |                                 |-- stripe.paymentIntents.retrieve -->|
   |                                 |   (verify on server side)    |
   |                                 |-- INSERT payment into DB     |
   |                                 |-- UPDATE member end_date     |
   |<-- { success: true } -----------|                              |
```

> The server always re-verifies the PaymentIntent with Stripe before recording. The frontend confirmation alone is not trusted.
