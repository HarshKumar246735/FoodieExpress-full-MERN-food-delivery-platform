# FoodieExpress 🍔

FoodieExpress is a full-stack food delivery application built using the MERN stack.

## Features

* Customer signup and login
* Browse restaurants and food items
* Search and filter food
* Add items to cart
* Apply discount coupons
* Place orders using Cash on Delivery or demo payment
* Track order status in real time
* Restaurant owner dashboard
* Delivery partner dashboard
* Admin dashboard
* Interactive delivery map

## Technologies Used

**Frontend:** React, Vite, React Router, Axios, CSS

**Backend:** Node.js, Express.js

**Database:** MongoDB Atlas

**Other tools:** Socket.IO, JWT, Razorpay test mode, Leaflet

## Requirements

* Node.js 18 or newer
* MongoDB Atlas account
* npm

## Installation

Open the project folder in your terminal.

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment variables

Copy `.env.example` to:

* `server/.env`
* `client/.env`

Add the required MongoDB connection string, JWT secret, and API settings.

### 3. Add demo data

```bash
npm run seed
```

### 4. Start the backend

```bash
npm run dev:server
```

### 5. Start the frontend

Open another terminal:

```bash
npm run dev:client
```

Open the frontend URL shown in your terminal, usually `http://localhost:5173`.

## Demo Accounts

Password: `Demo@1234` (unless changed in your configuration).

| Role             | Email                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Customer         | [customer@foodieexpress.demo](mailto:customer@foodieexpress.demo) |
| Restaurant Owner | [owner@foodieexpress.demo](mailto:owner@foodieexpress.demo)       |
| Delivery Partner | [delivery@foodieexpress.demo](mailto:delivery@foodieexpress.demo) |
| Admin            | [admin@foodieexpress.demo](mailto:admin@foodieexpress.demo)       |

These are development demo accounts. Make sure they exist in your database before logging in.

## Payment Options

* **Cash on Delivery:** Pay when the order is delivered.
* **Demo Payment:** Simulates successful, failed, or cancelled payments.
* **Razorpay Test Mode:** Test online payments without real transactions.

## Deployment

* **Frontend:** Vercel
* **Backend:** Render
* **Database:** MongoDB Atlas

Configure the environment variables and API URLs before deploying.

## Important Notes

* Food images may need additional configuration.
* Razorpay requires test API keys.
* Never upload secret keys or `.env` files to GitHub.
* The application needs to be tested locally before production deployment.
* The delivery map may display simulated rider locations.

## Project Structure

```text
FoodieExpress/
├── client/       # React frontend
├── server/       # Express backend
├── tools/        # Optional code-checking scripts
├── .env.example
├── render.yaml
└── README.md
```

## License

Add a license if you plan to distribute the project publicly.
