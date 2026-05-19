# CodeAlpha Simple E-commerce Store

A starter full-stack project for CodeAlpha Task 1.

## Features

- Product listing with search and sorting
- Animated responsive product cards and interface
- Shopping cart with quantity controls and checkout flow
- User registration and login with persistent session state
- Order history page for logged-in users
- Order submission with order documents stored in MongoDB
- Real-time order notifications via Socket.IO

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start MongoDB locally or set a connection string:
   - Local default: `mongodb://127.0.0.1:27017/codealpha_store`
   - Or set `MONGODB_URI` before running:
     ```bash
     $env:MONGODB_URI = 'your-mongodb-connection-string'
     npm start
     ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open browser:
   ```
   http://localhost:3000
   ```

## Project structure

- `backend/` — Express server and Mongoose models
- `public/` — HTML/CSS/JS frontend pages
- `public/js/app.js` — client-side cart, authentication, and API calls

## Notes

- The app seeds sample products automatically on first start.
- Login/register stores JWT in `localStorage` for protected checkout.
- MongoDB connection string is configured with `MONGODB_URI` or uses a local MongoDB default.
