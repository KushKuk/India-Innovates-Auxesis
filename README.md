# Secure Vote Flow

Secure Vote Flow is a comprehensive electoral verification and token management system designed to streamline and secure the voting process at polling booths. It replaces traditional paper-based electoral rolls with a real-time, digitized pipeline.

The system is composed of two main parts:
1. **Frontend**: A React application simulating the different officer terminals (Digital Verification, Manual Verification, Token Verification Officer).
2. **Backend**: A NestJS API powered by PostgreSQL and Prisma that serves the actual verification logic, token generation, and audit logging.

---

## 🏗️ Technology Stack

- **Frontend**: React, Vite, TypeScript, TailwindCSS, shadcn/ui, TanStack Query
- **Backend**: NestJS, TypeScript, PostgreSQL, Prisma ORM, JWT Authentication
- **Infrastructure**: Docker (for standalone database hosting)

---

## 🚀 Key Features

* **Digital Terminal**: Streamlines voter lookup and verification using ID cards and biometrics, generating a secure active token.
* **Manual Terminal**: Provides a robust fallback for exceptions (e.g., biometric mismatch) requiring officer and supervisor approval before token generation.
* **Token Verification (TVO) Terminal**: Allows the final officer to validate a token before authorizing physical entry to the EVM (Electronic Voting Machine).
* **Audit Logging**: Every action across all terminals is logged immutably for electoral integrity.

---

## ⚙️ Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher) or **Docker** to run the provided database container.

---

## 🛠️ Setup & Installation

Follow these steps to get the entire workspace running locally.

### 1. Database Setup

You need a running PostgreSQL instance. An easy way is to use the provided `docker-compose.yml` in the backend:

```bash
cd backend
docker compose up -d
```
*This starts a PostgreSQL database on `localhost:5432` with username `postgres` and password `postgres`.*

### 2. Backend Setup

The backend handles all the database interactions, token logic, and audit trails.

```bash
cd backend

# Install dependencies
npm install

# Apply database schema
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed database with mock voters, officers, and booth data
npm run prisma:seed

# Start the NestJS backend
npm run start:dev
```
*The backend will be running at `http://localhost:3000`.*
*You can view the auto-generated Swagger API docs at [http://localhost:3000/api/docs](http://localhost:3000/api/docs).*

### 3. Frontend Setup

The frontend provides the UI terminals for the electoral officers.

```bash
# Open a new terminal window
cd frontend

# Install dependencies
npm install

# Start the React development server
npm run dev
```
*The frontend will be running at `http://localhost:5173` (or port 8080).*

---

## 📂 Project Structure

```text
secure-vote-flow/
├── backend/                  # NestJS API application
│   ├── prisma/               # Database schema and seed scripts
│   ├── src/                  # API modules (Auth, Voters, Tokens, Verification, Audit)
│   ├── .env                  # Environment variables (Database URL, JWT config)
│   ├── docker-compose.yml    # PostgreSQL container setup
│   └── package.json    
├── frontend/                 # React frontend application
│   ├── src/                  
│   │   ├── components/       # Terminal UIs (Aadhaar, Biometrics, Audit Logs)
│   │   ├── pages/            # Page layouts per officer role
│   │   └── contexts/         # React Contexts (soon to be replaced by backend API)
│   └── package.json
└── README.md                 # This file
```

---

## 🔐 Authentication Defaults

When testing, the system is seeded with the following officer accounts:
- **Default Officer ID**: `EO001` (Password: `password123`)
- **Supervisor ID**: `SUP001` (Password: `password123`)
