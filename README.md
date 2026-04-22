# High-Throughput Flash Sale System

A single-product flash sale API with **inventory**, **per-user limits**, and a React UI.

---

## Table of Contents

- [Overview](#-overview)
- [How It Works](#-how-it-works)
- [System Architecture](#-system-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Running Tests](#-running-tests)
- [Stress Testing](#-stress-testing)

---

## Overview

The app demonstrates a **concurrency-safe flash sale backend** with React frontend. It handles the classic problem of high-traffic purchase spikes without overselling or double-booking users.

---

## How It Works

When a user clicks **Buy**, this happens:

```
Browser
    ↓
Rate Limiter
    ↓
Express Route
    ↓  
Redis Lua Script
    ↓
1. Check time window
2. Check user already bought?
3. Stock > 0? → Decrement
    ↓
201 Created OR 409 Conflict
```

The **Lua script** runs all at once in Redis, so other requests can’t interrupt it. This prevents race conditions completely.

---

## System Architecture

```
┌─────────────┐          ┌──────────────────────────┐        ┌────────────────────────┐
│   Clients   │          │        API Layer         │        │   Inventory & State    │
│             │          │                          │        │                        │
│  React UI   │ - HTTP ─▶│  Rate Limiter (per-IP)   │ -----▶ │   Redis + Lua Script   │
|   (Web)     |  Request |                          │        |                        |
└─────────────┘          └──────────────────────────┘        └────────────────────────┘
                                                           
```

| Layer | Responsibility |
|---|---|
| **Clients** | React UI (Vite) or load scripts sending HTTP requests |
| **Rate Limiter** | Absorbs abusive traffic per IP |
| **Express Routes** | Exposes sale status, purchase, and reservation endpoints |
| **Redis + Lua** | Atomically checks window + user + stock in one round-trip |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** | Required |
| **Docker** | Required (for Redis) |

## Configuration

1.) Make a copy of `api/.env.example` to `api/.env` from api folder and adjust the values:

```env
PORT=3001
REDIS_URL=redis://localhost:6379

SALE_START=2026-04-01T00:00:00.000Z
SALE_END=2026-07-01T00:00:00.000Z
TOTAL_STOCK=100
PRODUCT_NAME=Nike Airforce 1 Shoes

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10000
```

2.) Make a copy of `web/.env.example` to `web/.env` from the web folder
```env
API_BASE_URL=http://127.0.0.1:3001
TIMEZONE=Asia/Manila
```

---

## Quick Start

### Step 1 - Start Redis 

```bash
docker compose up -d
```

### Step 2 - Start the API (Terminal 1)

```bash
cd api
npm install
npm run dev
```

### Step 3 - Start the Web UI (Terminal 2)

```bash
cd web
npm install
npm run dev
```

Open the URL printed by Vite — default is **http://localhost:5173**

> The dev server automatically proxies `/api` to `http://127.0.0.1:3001`.

| Variable | Description |
|---|---|
| `SALE_START` | ISO-8601 datetime when the sale opens |
| `SALE_END` | ISO-8601 datetime when the sale closes |
| `TOTAL_STOCK` | Number of units available |
| `REDIS_URL` | Redis connection string |

---

## API Reference

### `GET /api/sale/status`

Returns the current sale phase and schedule.

**Response:**
```json
{
  "phase": "active",
  "start": "2026-01-01T10:00:00.000Z",
  "end": "2026-01-02T11:00:00.000Z",
  "remainingStock": 100
}
```

Possible phases: `upcoming` | `active` | `ended`

---

### `GET /api/purchase/status?userId=<string>`

Check whether a specific user has already secured a unit.

**Response:**
```json
{ "purchased": true }
```

---

### `POST /api/purchase`

Atomically reserve one unit for a user.

**Request body:**
```json
{ "userId": "user-abc-123" }
```

**Responses:**

| Status | Meaning |
|---|---|
| `201 Created` | Purchase successful |
| `409 Conflict` | `sold_out` — no stock remaining |
| `409 Conflict` | `already_purchased` — user already bought |
| `409 Conflict` | `not_active` — sale hasn't started or has ended |

---

### `POST /api/stock/fill`

Add existing stocks.

**Request body:**
```json
{ "amount": 2 }
```

**Responses:**

| Status | Meaning |
|---|---|
| `success` | `boolean` Status of the request |
| `remainingStock` | `number` — available stock remaining |

---

## Running Tests

```bash
cd api
npm test
```

The test suite includes:

- **Unit tests** — repository serialization, service phase logic
- **Integration tests** — HTTP status codes, one-per-user enforcement, sold-out behavior

---

## Stress Testing

Use this to verify that stock never oversells under concurrent load.

**Terminal 1 — Start API with small stock:**

```bash
cd api
  TOTAL_STOCK=50 \
  SALE_START=2000-01-01T00:00:00.000Z \
  SALE_END=2099-12-31T23:59:59.999Z \
  npm run dev
```

**Terminal 2 — Run the stress generator:**

```bash
cd api
npm run test:stress -- http://127.0.0.1:3001 300 25
```
| Args | Default | Meaning |
|---|---|---|
| `baseUrl` | http://127.0.0.1:3001 | Server to hit |
| `total` | 300 | Total number of requests to send |
| `concurrency` | 25 | How many requests run simultaneously |

### Output
 
A completed run prints a JSON summary followed by a throughput line:
 
```json
{
  "ms": 4200,
  "created": 498,
  "conflict": 0,
  "forbidden": 0,
  "clientErr": 0,
  "serverErr": 2
}
Throughput: 119.0 req/s
```
### Key Definitions
 
| Key | HTTP Status | Meaning |
|---|---|---|
| `ms` | — | Total wall-clock duration of the entire run, in milliseconds |
| `created` | 201 | Purchase succeeded — a new record was created |
| `conflict` | 409 | Server detected a duplicate purchase |
| `forbidden` | 403 | Auth or permission check rejected the request |
| `clientErr` | 4xx (other) | Bad request shape, missing fields, or validation error |
| `serverErr` | 5xx | Crash, unhandled exception, or DB connection failure |
| `Throughput` | — | `(total / ms) × 1000` — sustained requests per second |


### Ideal Output
 
Since every `userId` is unique (`stress-{id}-{randomSuffix}`), a clean run should look like:
 
```json
{
  "ms": 3000–8000,
  "created": 500,
  "conflict": 0,
  "forbidden": 0,
  "clientErr": 0,
  "serverErr": 0
}
Throughput: 60–150 req/s
```
 
- **`created` should equal `total`** — every request succeeded
- **Everything else should be `0`** — no errors of any kind
