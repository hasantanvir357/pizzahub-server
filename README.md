# ⚙️ PizzaHub — Backend REST API Server

The backend REST API service powering **PizzaHub**, built with **Node.js**, **Express.js**, and **MongoDB**. It handles secure JWT authentication, Google OAuth user synchronization, Role-Based Access Control (`customer`, `vendor`, `admin`), freemium menu limits, order processing, reviews, wishlists, and Stripe subscription billing.

---

## 🌐 Live API Endpoint
- **Production Base URL:** `https://your-pizzahub-server.onrender.com` *(Replace after deployment)*

---

## 🛠️ Tech Stack
- **Runtime & Framework:** Node.js, Express.js
- **Database:** MongoDB Atlas (Native MongoDB Driver / Mongoose)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Role-Based Middleware (`verifyToken`, `verifyAdmin`, `verifyVendor`)
- **Payments:** Stripe Node SDK (`stripe`)

---

## 📡 Core API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new Customer or Vendor account
- `POST /api/auth/login` — Authenticate with email & password and issue a 30-day JWT
- `POST /api/auth/google` — Sync Google OAuth sessions with deduplication & role persistence

### 🍕 Menu & Reviews (`/api/menus`)
- `GET /api/menus` — Fetch approved public pizza listings (supports search & category filters)
- `GET /api/menus/:id` — Get full details and customer reviews for a specific pizza
- `POST /api/menus` — Create a new pizza item (Vendor only; enforces 3-item limit on `free` plan)
- `PATCH /api/menus/:id/status` — Approve or reject menu items (Admin only)
- `POST /api/menus/:id/reviews` — Submit a rating and review (Customer only)

### 🛒 Orders & Wishlist (`/api/orders`, `/api/wishlist`)
- `POST /api/orders` — Place a new pizza order (`customer` role enforced)
- `GET /api/orders` — Fetch orders scoped by user role (Customer, Vendor kitchen, or Admin)
- `PATCH /api/orders/:id/status` — Update order fulfillment status
- `POST /api/wishlist/toggle` — Add or remove a pizza from the user's wishlist

### 💳 Users, Subscriptions & Transactions (`/api/users`)
- `GET /api/users` — List deduplicated platform users (Admin only)
- `PATCH /api/users/:id/role` — Promote or demote user roles (Admin only)
- `PATCH /api/users/:id/block` — Block or unblock user accounts (Admin only)
- `POST /api/users/create-checkout-session` — Create a Stripe Checkout session for Vendor Premium upgrade
- `POST /api/users/verify-subscription` — Verify Stripe session and upgrade vendor plan to `premium`
- `GET /api/users/transactions` — Retrieve read-only payment transaction history (Admin only)

---

## 🚀 Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/pizzahub-server.git](https://github.com/your-username/pizzahub-server.git)
   cd pizzahub-server
