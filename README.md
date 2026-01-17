# FCC Transport Board

A real-time patient transport tracking web application for a hospital mother-baby unit. This application manages transport requests, tracks transporter status, and provides performance metrics.

## Features

- **Role-based access**: Transporter, Dispatcher, Supervisor, Manager
- **Real-time updates**: Socket.io for instant synchronization across all clients
- **Mobile-first transporter view**: Large touch targets for easy operation
- **Dispatcher board**: Three-panel layout for efficient dispatch management
- **Performance metrics**: Charts and reports for managers
- **Alert system**: Automatic alerts for stale requests

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase)
- **Real-time**: Socket.io
- **Authentication**: JWT with httpOnly cookies
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (or Supabase account)

### Installation

1. Clone the repository and navigate to the project:

```bash
cd fcc-transport-board
```

2. Install server dependencies:

```bash
cd server
npm install
```

3. Install client dependencies:

```bash
cd ../client
npm install
```

### Configuration

1. Create a `.env` file in the server directory:

```bash
cp server/.env.example server/.env
```

2. Update the `.env` file with your database credentials:

```env
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.amiebucoazkmmmvoqfyx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=12h
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Database Setup

1. Run the database migrations:

```bash
cd server
npm run migrate
```

2. Seed the database with sample data:

```bash
npm run seed
```

### Running the Application

1. Start the backend server:

```bash
cd server
npm run dev
```

2. In a new terminal, start the frontend:

```bash
cd client
npm run dev
```

3. Open your browser to http://localhost:5173

### Test Accounts

All test accounts use password: `password123`

| Role | Email |
|------|-------|
| Manager | manager@fcc.test |
| Supervisor | supervisor1@fcc.test |
| Dispatcher | dispatcher1@fcc.test |
| Transporter | transporter1@fcc.test |

## Project Structure

```
/fcc-transport-board
├── /client                 # React frontend
│   ├── /src
│   │   ├── /components    # Reusable UI components
│   │   ├── /context       # React contexts (Auth, Socket)
│   │   ├── /hooks         # Custom hooks
│   │   ├── /pages         # Page components
│   │   ├── /types         # TypeScript types
│   │   └── /utils         # Utility functions
│   └── package.json
├── /server                 # Express backend
│   ├── /src
│   │   ├── /config        # Database & app config
│   │   ├── /controllers   # Route handlers
│   │   ├── /middleware    # Express middleware
│   │   ├── /routes        # API routes
│   │   ├── /services      # Business logic
│   │   ├── /socket        # Socket.io setup
│   │   ├── /types         # TypeScript types
│   │   └── /utils         # Utility functions
│   └── package.json
├── /database
│   ├── /migrations        # SQL migration files
│   └── /seeds             # Seed data scripts
└── /shared                # Shared TypeScript types
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users (Manager only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/reset-password` - Reset password

### Transporter Status
- `GET /api/status` - Get all transporter statuses
- `PUT /api/status` - Update own status

### Transport Requests
- `GET /api/requests` - List requests (with filters)
- `POST /api/requests` - Create request
- `PUT /api/requests/:id` - Update request
- `PUT /api/requests/:id/cancel` - Cancel request
- `PUT /api/requests/:id/claim` - Claim request

### Reports (Supervisor, Manager)
- `GET /api/reports/summary` - Get metrics summary
- `GET /api/reports/by-transporter` - Get per-transporter stats
- `GET /api/reports/by-hour` - Get jobs by hour
- `GET /api/reports/by-floor` - Get jobs by floor
- `GET /api/reports/export` - Export CSV

## Socket.io Events

- `transporter_status_changed` - Transporter status updated
- `request_created` - New transport request
- `request_assigned` - Request assigned
- `request_status_changed` - Request status changed
- `request_cancelled` - Request cancelled
- `alert_triggered` - Alert for stale request

## User Roles

| Role | Permissions |
|------|-------------|
| Transporter | Update own status, view/claim jobs, progress job through statuses |
| Dispatcher | All transporter + create requests, assign/reassign jobs, view board |
| Supervisor | All dispatcher + view shift reports |
| Manager | All supervisor + historical reports, export, user management |

## License

MIT
