# FoodieExpress

A full MERN food-delivery platform: customers, restaurant owners, delivery partners and admins, with a seeded catalog of **232 dishes in 10 categories** from **15 approved demo restaurants** (plus one pending, to demo approval), cart, coupons, multi-step checkout, Cash on Delivery, Razorpay **test mode**, a clearly labelled **simulated demo payment**, order lifecycle with live Socket.IO updates, and a Leaflet/OpenStreetMap tracking map.

> **Status you should know about.** This code was written in a sandbox with no access to the npm registry or image hosts, so `npm install`, `vite build`, the running server, and image URLs could **not** be executed or verified there. What *was* verified is listed in [Verification status](#verification-status). Run the [first-run checklist](#first-run-checklist) on your machine; expect to fix small issues the first time.

## Tech stack
React 18 + Vite, React Router, Axios, Context API, Lucide, Recharts, Leaflet, Socket.IO client, plain CSS (`client/src/css/`, no Tailwind/Bootstrap) · Node, Express, MongoDB Atlas + Mongoose, JWT in HTTP-only cookies, bcrypt, Helmet, express-rate-limit, express-validator, Socket.IO, Razorpay SDK, Cloudinary (optional).

## Folder structure
```
FoodieExpress/
├── client/src/{components,layouts,pages,context,hooks,services,utils,css}
├── server/{config,controllers,middleware,models,routes,services,validators,sockets,utils,scripts,data,tests}
├── tools/            offline static checks for the client (no install needed)
├── .env.example      all variables, backend + frontend
├── render.yaml       Render blueprint (API)
└── README.md
```

## Prerequisites
Node 18+ (22 recommended), a MongoDB database (Atlas free tier or local `mongodb://127.0.0.1:27017`).

## Setup
```bash
npm run install:all                 # installs root, server and client deps
cp .env.example server/.env         # then edit: MONGODB_URI, JWT_SECRET, ...
cp .env.example client/.env         # keep only the VITE_* lines you need
npm run seed                        # categories, users, restaurants, 232 foods, coupons, reviews
npm run dev:server                  # API on http://localhost:5000
npm run dev:client                  # app on http://localhost:5173
```
Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### Environment variables
See `.env.example`. Only `VITE_*` values reach the browser, and the only payment value there is the **public** Razorpay key id. `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `JWT_SECRET`, and `MONGODB_URI` stay on the server.

### Seeding
- `npm run seed` is idempotent (upserts by slug/email/code, never deletes). Flags: `-- --dry-run` (validate data, no DB), `-- --offline` (no image lookups), `-- --reset-passwords`.
- `npm run seed:admin` creates/updates only the admin. In production it requires `ADMIN_PASSWORD`.
- Admins can never be created through the API; registration always creates customers.

### Food images
Dish photos are **not bundled**. `npm run seed` resolves one per item: `server/data/image-overrides.json` (your own URLs, highest priority) → `image-cache.json` → a live lookup using `PEXELS_API_KEY`, else `UNSPLASH_ACCESS_KEY`, else keyless Wikimedia Commons (credit stored per image). Search results are a best guess for the dish name, so **review them**, then run `npm run images:verify` (checks every URL returns 2xx + `image/*`) and fix misses via `image-overrides.json`. Items with no image show a labelled fallback tile. To host images on Cloudinary, upload them and put the URLs in the overrides file (owner uploads use Cloudinary automatically when its three variables are set, otherwise `server/uploads`, dev only).

## Demo accounts
Password for all: `Demo@1234` (or your `SEED_DEMO_PASSWORD`).

| Role | Email |
|---|---|
| Customer | customer@foodieexpress.demo |
| Restaurant owner (Spice Garden) | owner@foodieexpress.demo |
| Other owners | owner2 … owner16 @foodieexpress.demo |
| Delivery partner | delivery@foodieexpress.demo, delivery2@foodieexpress.demo |
| Admin | admin@foodieexpress.demo |

Development only: `POST /api/dev/reset-demo-accounts` resets demo passwords (not mounted in production).

Coupons: `WELCOME50` (₹50 off ≥₹199, once per user), `FOOD10` (10% off ≥₹299, max ₹100), `FREESHIP` (free delivery ≥₹249), plus `FEAST20`, `SWEET30`.

## Testing payments
1. Sign in as the customer, add dishes from one restaurant, open the cart, go to checkout.
2. **Demo payment (no credentials):** choose *Demo payment*, place the order, then click **Simulate Successful / Failed / Cancelled Payment**. Success → confirmation page; failure/cancel → failure page with *Retry payment*. The endpoint only accepts the signed-in customer's own pending DEMO orders and is disabled in production unless `DEMO_PAYMENTS_ENABLED=true`.
3. **Cash on Delivery:** order is placed immediately; payment is marked paid only when the rider marks it delivered.
4. **Razorpay test mode:** see below.

### Razorpay test-mode setup
1. Create a Razorpay account → Dashboard → toggle **Test Mode** → *Account & Settings → API Keys → Generate Test Key*.
2. Put `RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET=…` in `server/.env` and the key id as `VITE_RAZORPAY_KEY_ID` in `client/.env`. Non-`rzp_test_` keys are refused, so the option stays hidden.
3. Pay with Razorpay's test card/UPI details from their docs. No real money moves.
4. Webhook (optional, for reconciliation): add `https://<api-host>/api/payments/webhook`, a secret, and the `payment.captured`, `order.paid` and `payment.failed` events; set the secret as `RAZORPAY_WEBHOOK_SECRET`. The handler verifies the signature over the raw body and is idempotent by event id.

## Order flow & roles
`PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED`, with `CANCELLED` / `REJECTED`. Transitions are enforced server-side per role (customer cancels early; owner accepts/rejects/prepares; delivery partner picks up/delivers; admin overrides). Online orders cannot be accepted until paid. Owner dashboard: `/owner`, delivery: `/delivery`, admin: `/admin`. Order totals are always recomputed on the server from database prices.

**Tracking map:** unless a partner has shared a recent location, the rider marker is a **simulated** position by order status, and the drop-off point is approximate. The map says so.

## Production build & deployment
```bash
npm run build         # client -> client/dist
npm start             # API
```
- **API → Render:** use `render.yaml` (root dir `server`). Set `MONGODB_URI`, `CLIENT_URL` (your Vercel URL), Razorpay vars; `NODE_ENV=production`. Run `npm run seed -- --force-production` once only if you want demo data on that database, and `npm run seed:admin` with `ADMIN_PASSWORD`.
- **Client → Vercel:** root dir `client`, framework Vite, set `VITE_API_URL=https://<render-host>/api` and `VITE_SOCKET_URL=https://<render-host>`. `client/vercel.json` rewrites all paths to `index.html` so refresh/direct links work.
- Cookies across two domains need `NODE_ENV=production` (secure, SameSite=None) and HTTPS on both.

## What needs external setup
| Works with only MongoDB | Needs configuration |
|---|---|
| Auth, catalog, cart, coupons, checkout, COD, demo payment, orders, all dashboards, Socket.IO | Razorpay (test keys), Cloudinary uploads, dish photos (`images:fetch`/overrides), Leaflet tiles need internet |

## Verification status
**Actually run in the build sandbox**
- `node --test server/tests/*.test.js`: 17 tests pass (pricing/coupon rules, and seed-data integrity: 10 categories, ≥20 unique dishes in each, 232 total, all restaurant/owner references resolve, required coupons and roles present). The data check found and fixed one duplicate dish.
- `node scripts/seed.js --dry-run`: data valid.
- `node --check` on all 71 server files; every relative `require` resolves.
- `tools/check-jsx.js` and `tools/check-client.js` on the 103 client files: 0 syntax errors, 0 missing modules/exports/undefined names.

**NOT run (no registry/network in the sandbox)**: `npm install`, `vite build`, starting the server, any HTTP/database/Socket.IO workflow, Razorpay, image loading/verification, mobile responsiveness in a browser. The features exist in code but are **untested end to end**: registration/login, search/filters, cart, coupons at the API, checkout, the three demo outcomes, Razorpay signature verification, duplicate-payment prevention, order cancel, owner/delivery/admin flows, authorization on the API, tracking, direct-route refresh.

## First-run checklist
- [ ] `npm run install:all` succeeds; `npm run build` succeeds
- [ ] `npm test` passes; `npm run seed` reports ≥200 foods
- [ ] Log in as each demo role; place a COD order and walk it to DELIVERED
- [ ] Demo payment: success, failure + retry, cancel
- [ ] `npm run images:fetch` then `images:verify`; spot-check dish photos
- [ ] (optional) Razorpay test payment + duplicate verify returns `alreadyProcessed`
- [ ] Unauthorized API calls return 401/403; resize to mobile width

## Troubleshooting
- **CORS / cookie not sent:** `CLIENT_URL` must exactly match the browser origin; client uses `withCredentials`.
- **`MongoServerSelectionError`:** Atlas → Network Access must allow your IP; check the URI.
- **Blank images:** run `npm run images:fetch`, or add URLs to `image-overrides.json`.
- **Razorpay option missing at checkout:** keys unset or not `rzp_test_`.
- **403 on mutating requests:** the API requires the `X-Requested-With: FoodieExpress` header the client sends; add it to curl/Postman calls.
- **Demo payment 404 in production:** set `DEMO_PAYMENTS_ENABLED=true` deliberately.
