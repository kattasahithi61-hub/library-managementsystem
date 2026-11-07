# Northstar University Library

React + Vite frontend and Express/Mongoose backend for the library student registration portal.

## Requirements

- Node.js 20.19+ (Node.js 24 recommended)
- npm
- A MongoDB Atlas cluster

## Configure MongoDB Atlas

Edit `backend/.env` and set `MONGODB_URI`.

Create an Atlas database user and allow your current IP address in the Atlas Network Access list. Then copy the Atlas connection string into `backend/.env`, replacing the placeholders with your database username, password, and cluster host:

```env
MONGODB_URI=mongodb+srv://<db-username>:<db-password>@<cluster-host>/college_library?retryWrites=true&w=majority
MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000
```

Keep real credentials in `backend/.env`; `.env` files are ignored by Git. URL-encode special characters in the password (for example, use `%40` for `@`). Add development frontend origins as a comma-separated list in `CLIENT_ORIGINS` if they differ from the provided Vite origins.

## Start the backend

In one terminal, from the project root:

```powershell
npm run dev --prefix backend
```

The API starts at `http://localhost:5055`. Check `http://localhost:5055/api/health` for backend and MongoDB status. It returns HTTP 200 when MongoDB is connected and HTTP 503 with `backend: "running"` and the MongoDB state when the database is unavailable.

On startup, the API adds its 20 default catalogue books if they are missing. Each book includes an Open Library cover-image URL. Existing books are never overwritten. You can also run the seed manually with `npm run seed-books --prefix backend`.

## Start the frontend

In a second terminal, from the project root:

```powershell
npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` requests to the backend.

## Registration API

`POST /api/auth/register` validates the student fields, password, and a 6-digit Recovery PIN on the server, normalizes register numbers to uppercase, and stores the password and Recovery PIN as separate bcrypt hashes. A unique MongoDB index prevents duplicate register numbers, including concurrent registrations. The response never includes either hash.

## Books API

- `GET /api/books` returns `{ "books": [] }`; optional `search` (or `q`) searches title, author, ISBN, and category. Optional `category` combines with search, for example `/api/books?search=python&category=Programming`.
- `GET /api/admin/books` returns the catalogue for the management page and requires administrator authentication.
- `GET /api/books/:id` retrieves one MongoDB book document. Malformed IDs return 400; valid IDs without a record return 404.
- `POST /api/books`, `PUT /api/books/:id`, and `DELETE /api/books/:id` require a valid JWT belonging to an account whose database role is `admin`. New registrations always receive the `student` role. No admin account or sample book is created automatically.

Create a book through the admin-only POST endpoint with JSON fields `title`, `author`, `isbn`, `category`, `publisher`, `description`, `totalCopies`, `availableCopies`, and optional `coverImage`. `availableCopies` defaults to `totalCopies` if omitted. The server validates copy counts and normalizes ISBN whitespace/hyphens and case before the unique index check.

For local development, create a student account first, then promote that existing account through the development-only interactive script. It refuses to run unless `NODE_ENV=development`, asks for the register number, and requires typing an explicit confirmation. It does not create an account or set a password. From PowerShell at the project root:

```powershell
$env:NODE_ENV = 'development'
npm run provision-admin --prefix backend
```

After promotion, log out and sign in again so the JWT includes the admin role. Open `/admin/books` to manage the catalogue. The backend verifies both the JWT role and the current database role; the admin list endpoint and all write endpoints reject non-admin users. No sample books or admin users are inserted automatically. The student Books page reads the real catalogue from `GET /api/books`.

## Student book issues

- `POST /api/issues` accepts `{ "bookId": "<MongoDB book ID>" }`. The student is taken from the verified JWT/cookie, not from request data. The issue period is 14 calendar days.
- `GET /api/issues/my` and `GET /api/issues/:id` are limited to the authenticated student.
- `PUT /api/issues/:id/return` returns that student's active issue. The server calculates the fine at ₹10 per late calendar day; the request cannot set a fine.
- `GET /api/dashboard` returns real available-copy totals, the student's active/returned issue counts, due-soon books, accrued/returned fines, issued books, and recent issue/return activity.

Issue writes use MongoDB transactions when the server supports them. For the existing standalone local MongoDB, the API uses conditional atomic copy updates and compensating writes on request failures. Use a replica set for transaction-level atomicity across process crashes in production. No issue records or books are seeded.

## Login and session

`POST /api/auth/login` accepts `registerNumber` and `password`, checks the password with bcrypt, and returns a JWT and safe student details. The JWT is also set as an HttpOnly cookie for session restoration. The frontend keeps the returned bearer token in memory only; it is not stored in localStorage or sessionStorage. `GET /api/auth/me` restores the current student from the HttpOnly cookie, and `POST /api/auth/logout` clears it.

`PUT /api/auth/change-password` requires a valid signed-in session and accepts `currentPassword` and `newPassword`. The server verifies the current bcrypt hash, enforces the password rules, and stores a new bcrypt hash.

Password recovery uses the following endpoints:

- `POST /api/auth/recovery/verify` accepts `registerNumber` and `recoveryPin`. On success, it returns a random, short-lived, single-use reset token; only a SHA-256 hash of that token is stored.
- `POST /api/auth/recovery/reset` accepts `resetToken` and `newPassword`. It enforces the same password rules, stores the new bcrypt hash, and consumes the token.
- `PUT /api/auth/recovery-pin` requires an authenticated session and `currentPassword` to set or replace the Recovery PIN for an existing account.

Recovery PINs must be exactly six digits. Five unsuccessful attempts lock recovery for that account for 15 minutes. Unknown accounts, accounts without a configured PIN, incorrect PINs, and locked accounts receive the same generic verification response. Users registered before this feature must sign in and set a PIN by calling the authenticated `PUT /api/auth/recovery-pin` endpoint before using `/forgot-password`; no existing account or credential is changed automatically.

Set `JWT_SECRET` in `backend/.env` to a random secret of at least 32 characters. `JWT_EXPIRES_IN` and `AUTH_COOKIE_NAME` are optional; defaults are `1h` and `library_auth`. Never commit the `.env` file.

## Library portal routes

The website uses React Router. Public routes are `/login`, `/register`, `/forgot-password`, and `/change-password`. Dashboard and library sections use protected routes; direct navigation while unauthenticated redirects to `/login`. Login and registration use the backend authentication routes.

The student Dashboard and My Issued Books pages use the authenticated issue data. `GET /api/dashboard` returns:

```json
{
  "stats": {
    "totalBooksAvailable": 0,
    "currentlyIssued": 0,
    "dueSoon": 0,
    "returnedBooks": 0,
    "pendingFine": 0,
    "currency": "₹"
  },
  "issuedBooks": [
    {
      "id": "record-id",
      "title": "Book title",
      "author": "Author name",
      "issueDate": "2026-10-01",
      "dueDate": "2026-10-15",
      "status": "Issued"
    }
  ],
  "recentActivity": [
    {
      "id": "activity-id",
      "type": "issued",
      "title": "Book title",
      "occurredAt": "2026-10-01T10:00:00.000Z"
    }
  ]
}
```

The dashboard endpoint requires a student session and scopes all issue data to that authenticated student. `GET /api/books` remains available for the catalogue.

Run the backend integration tests against the isolated `college_library_test` database with:

```powershell
npm test --prefix backend
```

The test script refuses MongoDB database names that do not end in `_test`; it does not modify the live `college_library` database.

## Verify a registration in MongoDB

After registering through the website, connect to the `college_library` database and inspect the `users` collection:

```javascript
db.users.find(
  { registerNumber: "AB12345678" },
  { name: 1, registerNumber: 1, phone: 1, department: 1, year: 1, createdAt: 1, password: 1 }
)
```

The `password` field contains a bcrypt hash, never the submitted plain-text password. You can also use MongoDB Compass to open `college_library` → `users` and inspect the created document.
