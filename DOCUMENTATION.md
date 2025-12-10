# Chai Bun Tokens - Complete System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [API Documentation](#api-documentation)
7. [Database Structure](#database-structure)
8. [Frontend Pages](#frontend-pages)
9. [Configuration](#configuration)
10. [Development Guide](#development-guide)
11. [Deployment](#deployment)
12. [Firebase Monitoring](#firebase-monitoring)

---

## System Overview

**Chai Bun Tokens** is a real-time queue management system for a cafe/restaurant specializing in Irani chai, bun maska, premium milk bun, and tiramisu. The system allows customers to join a digital queue, track their order status in real-time, and enables staff to manage orders, inventory, and pricing through an admin dashboard.

### Key Capabilities

- **Customer Queue Management**: Customers can join a queue, select items, and track their position in real-time
- **Real-time Updates**: Server-Sent Events (SSE) for live queue and inventory updates
- **Inventory Management**: Track and manage stock levels for chai, bun maska, premium milk bun, and tiramisu
- **Order Processing**: Staff can mark orders as ready, edit orders, and track payments
- **Service Window Control**: Configure service hours and availability
- **Pricing Management**: Dynamic pricing configuration for menu items
- **Payment Tracking**: Mark orders as paid/unpaid
- **Analytics Dashboard**: View served items and revenue by date

---

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (Frontend +    │
│   API Routes)   │
└────────┬────────┘
         │
         │ Firebase SDK
         │
┌────────▼────────┐
│  Firebase       │
│  - Firestore    │
│  - Auth         │
└─────────────────┘
```

### Data Flow

1. **Customer Flow**:
   - Customer visits `/queue` → Selects items → Creates ticket via `/api/join`
   - Redirected to `/status/[id]` → Real-time updates via `/api/queue/stream`
   - When ready → Redirected to `/served/[id]`

2. **Admin Flow**:
   - Admin logs in at `/admin` → Firebase Authentication
   - Views live queue → Real-time updates via `/api/queue/stream`
   - Manages orders → Updates via `/api/ready`, `/api/ticket`, `/api/payment`
   - Configures settings → Updates via `/api/settings`, `/api/pricing`

### Real-time Communication

The system uses **Server-Sent Events (SSE)** for real-time updates:
- Single listener per date key (shared across all clients)
- Broadcasts ticket and settings updates to all connected clients
- Automatic cleanup when no clients are connected

---

## Features

### Customer Features

1. **Queue Joining**
   - Enter name and select items (chai, bun maska, premium milk bun, tiramisu)
   - Real-time inventory validation
   - Automatic inventory decrement on order creation
   - Service window validation

2. **Status Tracking**
   - Real-time queue position updates
   - Token number display
   - Order summary with pricing
   - Connection status indicator
   - Automatic redirect when order is ready

3. **Order Management**
   - Exit queue (deletes ticket and restores inventory)
   - Refresh status
   - View order details

### Admin Features

1. **Queue Management**
   - Live queue view with real-time updates
   - Mark orders as ready
   - Edit order quantities (with inventory validation)
   - Delete orders (with inventory restoration)
   - Clear all waiting tickets for today
   - View order details in modal

2. **Inventory Management**
   - Set inventory levels for each item
   - Configure buffer thresholds (low stock warnings)
   - Real-time inventory tracking
   - Automatic inventory restoration on order deletion/cancellation

3. **Settings Management**
   - Configure service hours (start/end time)
   - Set closed message
   - Update pricing for all items

4. **Dashboard & Analytics**
   - View served orders by date
   - Track revenue (only paid orders)
   - Summary statistics (served chai, buns, tiramisu)
   - Payment status management

5. **Authentication**
   - Firebase Authentication (email/password)
   - Protected admin routes

---

## Technology Stack

### Frontend
- **Next.js 16.0.3** - React framework with App Router
- **React 19.2.0** - UI library
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icons
- **Recharts** - Charts (for analytics)

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Firebase Firestore** - NoSQL database
- **Firebase Authentication** - User authentication
- **Server-Sent Events (SSE)** - Real-time updates

### Development Tools
- **ESLint** - Code linting
- **Autocannon** - Load testing
- **Artillery** - Performance testing

---

## Project Structure

```
chai-bun-tokens/
├── src/
│   ├── app/
│   │   ├── api/                    # API routes
│   │   │   ├── join/               # Create new ticket
│   │   │   ├── queue/               # Get/delete queue
│   │   │   │   └── stream/         # SSE real-time updates
│   │   │   ├── ticket/             # Update/delete ticket
│   │   │   ├── ready/              # Mark ticket as ready
│   │   │   ├── payment/            # Update payment status
│   │   │   ├── pricing/           # Get/set pricing
│   │   │   ├── settings/           # Get/set app settings
│   │   │   └── monitor/           # Firebase monitoring
│   │   ├── admin/                  # Admin dashboard
│   │   ├── queue/                  # Customer queue page
│   │   ├── status/[id]/           # Customer status page
│   │   ├── served/                # Order complete page
│   │   ├── layout.js              # Root layout
│   │   └── page.js                # Home page
│   ├── components/
│   │   └── ui/                    # Reusable UI components
│   └── lib/
│       ├── firebase.js            # Firebase initialization
│       ├── firebase-monitor.js    # Firestore operation monitoring
│       ├── item-names.js         # Item name constants
│       ├── pricing-cache.js      # Client-side pricing cache
│       └── utils.js              # Utility functions
├── public/                        # Static assets
├── package.json
├── next.config.mjs
├── tailwind.config.js
└── env.example
```

---

## API Documentation

### Base URL
All API routes are prefixed with `/api`

### Authentication
- Admin routes require Firebase Authentication
- Customer routes are public

---

### `/api/join` - Create New Ticket

**Method**: `POST`

**Description**: Creates a new ticket in the queue and decrements inventory atomically.

**Request Body**:
```json
{
  "name": "John Doe",
  "items": [
    { "name": "Special Chai", "qty": 2 },
    { "name": "Bun Maska", "qty": 1 }
  ]
}
```

**Response** (201):
```json
{
  "id": "ticket-id",
  "position": 5,
  "dateKey": "2024-01-15",
  "items": [...]
}
```

**Error Responses**:
- `400`: Missing name or items
- `500`: Failed to join queue

**Firestore Operations**:
- 2 reads (queue day doc, settings)
- 3 writes (queue day doc, ticket, settings inventory update)

---

### `/api/queue` - Get/Delete Queue

#### GET

**Description**: Retrieves all tickets for a specific date.

**Query Parameters**:
- `date` (optional): Date in YYYY-MM-DD format (defaults to today)

**Response** (200):
```json
{
  "dateKey": "2024-01-15",
  "tickets": [
    {
      "id": "ticket-id",
      "name": "John Doe",
      "items": [...],
      "status": "waiting",
      "basePosition": 5,
      "createdAt": {...},
      "updatedAt": {...}
    }
  ]
}
```

**Firestore Operations**:
- N reads (one per ticket document)

#### DELETE

**Description**: Clears all waiting tickets for today and restores inventory.

**Response** (200):
```json
{
  "dateKey": "2024-01-15",
  "cleared": true,
  "ticketsDeleted": 10,
  "restored": {
    "chai": 5,
    "bun": 3,
    "tiramisu": 0
  }
}
```

**Firestore Operations**:
- N reads (tickets + settings)
- N deletes (one per ticket)
- 1 write (settings inventory update)

---

### `/api/queue/stream` - Real-time Queue Updates

**Method**: `GET`

**Description**: Server-Sent Events (SSE) stream for real-time queue and settings updates.

**Query Parameters**:
- `date` (optional): Date in YYYY-MM-DD format (defaults to today)

**Response**: SSE stream with `text/event-stream` content type

**Event Format**:
```
data: {"dateKey":"2024-01-15","tickets":[...],"settings":{...}}\n\n
```

**Settings Object**:
```json
{
  "serviceStart": "06:00",
  "serviceEnd": "23:00",
  "closedMessage": "...",
  "inventory": {
    "chai": 50,
    "bun": 30,
    "tiramisu": 10
  },
  "buffer": {
    "chai": 10,
    "bun": 10,
    "tiramisu": 10
  }
}
```

**Features**:
- Singleton listener per date (shared across clients)
- Automatic cleanup when no clients connected
- Initial data sent immediately on connection

**Firestore Operations**:
- 1 listen (tickets collection)
- 1 listen (settings document)
- N reads on each update (one per ticket document)

---

### `/api/ticket` - Update/Delete Ticket

#### PATCH

**Description**: Updates ticket items (only for waiting tickets). Atomically restores old inventory and decrements new inventory.

**Request Body**:
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "items": [
    { "name": "Special Chai", "qty": 3 },
    { "name": "Bun Maska", "qty": 2 }
  ]
}
```

**Response** (200):
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "items": [...]
}
```

**Error Responses**:
- `400`: Invalid request or stock exceeded
- `404`: Ticket or settings not found

**Firestore Operations**:
- 2 reads (ticket, settings)
- 2 writes (ticket update, settings inventory update)

#### DELETE

**Description**: Deletes a ticket and restores inventory (only if status is "waiting").

**Query Parameters**:
- `id`: Ticket ID
- `date`: Date key (YYYY-MM-DD)

**Response** (200):
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "deleted": true
}
```

**Firestore Operations**:
- 2 reads (ticket, settings)
- 1 delete (ticket)
- 1 write (settings inventory update)

---

### `/api/ready` - Mark Ticket as Ready

**Method**: `PATCH`

**Description**: Marks a ticket as ready and calculates total price.

**Request Body**:
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "status": "ready"
}
```

**Response** (200):
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "status": "ready"
}
```

**Note**: Total price is calculated and stored in the ticket document.

**Firestore Operations**:
- 2 reads (ticket, pricing)
- 1 write (ticket update)

---

### `/api/payment` - Update Payment Status

**Method**: `PATCH`

**Description**: Updates the payment status of a ticket.

**Request Body**:
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "paid": true
}
```

**Response** (200):
```json
{
  "id": "ticket-id",
  "dateKey": "2024-01-15",
  "paid": true
}
```

**Firestore Operations**:
- 1 read (ticket)
- 1 write (ticket update)

---

### `/api/pricing` - Get/Set Pricing

#### GET

**Description**: Retrieves current pricing for all items.

**Response** (200):
```json
{
  "chaiPrice": 10,
  "bunPrice": 10,
  "tiramisuPrice": 50
}
```

**Firestore Operations**:
- 1 read (pricing document)

#### POST

**Description**: Updates pricing for all items.

**Request Body**:
```json
{
  "chaiPrice": 10,
  "bunPrice": 10,
  "tiramisuPrice": 50
}
```

**Response** (200):
```json
{
  "chaiPrice": 10,
  "bunPrice": 10,
  "tiramisuPrice": 50
}
```

**Firestore Operations**:
- 1 write (pricing document)

---

### `/api/settings` - Get/Set App Settings

#### GET

**Description**: Retrieves application settings including service hours, inventory, and buffers.

**Response** (200):
```json
{
  "serviceStart": "06:00",
  "serviceEnd": "23:00",
  "closedMessage": "Queue is currently closed...",
  "inventory": {
    "chai": 50,
    "bun": 30,
    "tiramisu": 10
  },
  "buffer": {
    "chai": 10,
    "bun": 10,
    "tiramisu": 10
  }
}
```

**Firestore Operations**:
- 1 read (settings document)

#### POST

**Description**: Updates application settings. Partial updates are supported (only provided fields are updated).

**Request Body** (all fields optional):
```json
{
  "serviceStart": "06:00",
  "serviceEnd": "23:00",
  "closedMessage": "...",
  "inventory": {
    "chai": 50,
    "bun": 30,
    "tiramisu": 10
  },
  "buffer": {
    "chai": 10,
    "bun": 10,
    "tiramisu": 10
  }
}
```

**Response** (200):
```json
{
  "serviceStart": "06:00",
  "serviceEnd": "23:00",
  "closedMessage": "...",
  "inventory": {...},
  "buffer": {...}
}
```

**Firestore Operations**:
- 1 read (existing settings - for merge)
- 1 write (settings document)

---

### `/api/monitor` - Firebase Monitoring

**Method**: `GET`

**Description**: Returns Firestore operation statistics (development only).

**Response** (200):
```json
{
  "summary": {
    "reads": 150,
    "writes": 45,
    "deletes": 10,
    "listens": 2,
    "total": 207,
    "estimatedCost": {
      "reads": 0.00009,
      "writes": 0.000081,
      "deletes": 0.000002,
      "total": 0.000172
    }
  },
  "recentOperations": [...],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Note**: Only available in development mode or when `ENABLE_FIREBASE_MONITORING=true`

---

## Database Structure

### Firestore Collections

#### `queues/{dateKey}`
Daily queue documents. Date key format: `YYYY-MM-DD`

**Document Structure**:
```json
{
  "nextPosition": 15,
  "updatedAt": "Timestamp"
}
```

#### `queues/{dateKey}/tickets/{ticketId}`
Individual ticket documents.

**Document Structure**:
```json
{
  "name": "John Doe",
  "items": [
    { "name": "Special Chai", "qty": 2 },
    { "name": "Bun Maska", "qty": 1 }
  ],
  "status": "waiting" | "ready",
  "basePosition": 5,
  "dateKey": "2024-01-15",
  "total": 30,
  "paid": false,
  "paidAt": "Timestamp" | null,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

**Indexes Required**:
- `basePosition` (ascending) - for queue ordering

#### `config/app-settings`
Application settings document.

**Document Structure**:
```json
{
  "serviceStart": "06:00",
  "serviceEnd": "23:00",
  "closedMessage": "Queue is currently closed...",
  "inventory": {
    "chai": 50,
    "bun": 30,
    "tiramisu": 10
  },
  "buffer": {
    "chai": 10,
    "bun": 10,
    "tiramisu": 10
  },
  "updatedAt": "Timestamp"
}
```

#### `config/pricing`
Pricing configuration document.

**Document Structure**:
```json
{
  "chaiPrice": 10,
  "bunPrice": 10,
  "tiramisuPrice": 50
}
```

### Data Relationships

```
config/
├── app-settings (singleton)
└── pricing (singleton)

queues/
└── {dateKey}/
    └── tickets/
        └── {ticketId}
```

### Item Names

The system uses consistent item names:
- `"Special Chai"` (legacy: `"Irani Chai"`)
- `"Bun Maska"` (legacy: `"Bun"`)
- `"Premium Milk Bun"` (legacy: `"Milk Bun"`)
- `"Tiramisu"`

Helper functions in `src/lib/item-names.js` handle name matching.

---

## Frontend Pages

### `/` - Home Page

**Purpose**: Landing page with menu information and branding.

**Features**:
- Brand image and description
- Menu item cards (chai, bun maska)
- Call-to-action to join queue

**Components Used**:
- Card, Badge, Button

---

### `/queue` - Queue Page

**Purpose**: Customer interface for joining the queue.

**Features**:
- Name input
- Item selection with quantity controls
- Real-time inventory validation
- Service window validation
- Order summary with pricing
- Real-time settings updates via SSE

**State Management**:
- Local state for form inputs
- SSE connection for settings updates
- Pricing cache (sessionStorage, 5min TTL)

**Validation**:
- Name required
- At least one item with quantity > 0
- Inventory availability check
- Service window check

**Redirects**:
- If ticket exists in localStorage → `/status/[id]`

---

### `/status/[id]` - Status Page

**Purpose**: Real-time order status tracking for customers.

**Features**:
- Token number display
- Queue position (real-time)
- Order summary with pricing
- Status badge (waiting/ready)
- Connection status indicator
- Exit queue functionality
- Automatic redirect to `/served/[id]` when ready

**Real-time Updates**:
- SSE connection to `/api/queue/stream`
- Auto-reconnect on disconnect
- Ticket validation (redirects if ticket not found)

**State Management**:
- SSE connection for queue updates
- Pricing cache
- LocalStorage for ticket persistence

---

### `/served/[id]` - Served Page

**Purpose**: Order completion confirmation page.

**Features**:
- Success message
- Sound effect (bell)
- Links to rejoin queue or return home

**Audio**:
- Plays `/Order-up-bell-sound-effect.mp3` on page load

---

### `/admin` - Admin Dashboard

**Purpose**: Staff interface for managing the queue and orders.

**Authentication**:
- Firebase Authentication required
- Login form for email/password

**Tabs**:

1. **Queue Tab**
   - Live queue view (real-time)
   - Connection status indicator
   - Inventory badges (with low stock warnings)
   - Actions: Edit, Delete, Mark as Ready
   - Order details modal
   - Clear today's queue

2. **Dashboard Tab**
   - Date selector
   - Summary cards (served items, revenue)
   - Ready tickets table
   - Payment status toggle
   - Total calculation

3. **Settings Tab**
   - Service window configuration
   - Inventory management
   - Buffer thresholds
   - Pricing configuration

**Real-time Features**:
- Live queue updates via SSE
- Real-time inventory tracking
- Auto-adjust edit quantities based on inventory

---

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Optional: Enable Firebase monitoring in production
ENABLE_FIREBASE_MONITORING=false
```

### Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project

2. **Enable Firestore**
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)

3. **Enable Authentication**
   - Go to Authentication
   - Enable Email/Password provider
   - Create admin user accounts

4. **Security Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access to queues
    match /queues/{dateKey} {
      allow read: if true;
      match /tickets/{ticketId} {
        allow read: if true;
        allow write: if false; // Only via API routes
      }
    }
    
    // Public read access to config
    match /config/{document=**} {
      allow read: if true;
      allow write: if request.auth != null; // Only authenticated users
    }
  }
}
```

5. **Indexes**
   - Create composite index on `queues/{dateKey}/tickets`:
     - Field: `basePosition`, Order: Ascending

---

## Development Guide

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example .env.local

# Edit .env.local with your Firebase credentials
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

### Code Structure

#### API Routes
- Located in `src/app/api/`
- Each route exports HTTP method handlers (GET, POST, PATCH, DELETE)
- Use Firebase Firestore for data persistence
- Atomic operations using Firestore transactions

#### Components
- UI components in `src/components/ui/`
- Built with Radix UI primitives
- Styled with Tailwind CSS

#### Utilities
- `firebase.js`: Firebase initialization and helpers
- `item-names.js`: Item name constants and helpers
- `pricing-cache.js`: Client-side pricing cache
- `firebase-monitor.js`: Firestore operation monitoring

### Best Practices

1. **Inventory Management**
   - Always use transactions for inventory updates
   - Restore inventory when deleting waiting tickets
   - Validate inventory before decrementing

2. **Real-time Updates**
   - Use SSE for real-time features
   - Implement singleton listeners to reduce Firestore reads
   - Clean up listeners when no clients connected

3. **Error Handling**
   - Provide user-friendly error messages
   - Log errors to console for debugging
   - Handle network failures gracefully

4. **Performance**
   - Cache pricing data client-side
   - Use Firestore indexes for queries
   - Monitor Firestore operations in development

---

## Deployment

### Vercel (Recommended)

1. **Connect Repository**
   - Import project to Vercel
   - Connect GitHub/GitLab repository

2. **Environment Variables**
   - Add all `NEXT_PUBLIC_FIREBASE_*` variables
   - Add `ENABLE_FIREBASE_MONITORING` if needed

3. **Deploy**
   - Vercel automatically builds and deploys
   - Custom domain can be configured

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

### Build Configuration

No special build configuration required. Next.js handles:
- Static page generation
- API route optimization
- Image optimization

---

## Firebase Monitoring

The system includes built-in Firestore operation monitoring for cost analysis.

### Features

- Tracks reads, writes, deletes, and listens
- Estimates costs based on Firebase pricing
- Logs operations with context
- Provides summary statistics

### Usage

**Development Mode**: Automatically enabled

**Production Mode**: Set `ENABLE_FIREBASE_MONITORING=true`

**Access Monitoring Data**:
```bash
GET /api/monitor
```

### Cost Estimation

Based on Firebase pricing (2024):
- Reads: $0.06 per 100,000
- Writes: $0.18 per 100,000
- Deletes: $0.02 per 100,000
- Listens: Counted as reads

### Monitoring Best Practices

1. Monitor in development to optimize queries
2. Review operation logs regularly
3. Use transactions to reduce operation counts
4. Implement caching where appropriate

---

## Troubleshooting

### Common Issues

1. **Firestore Permission Denied**
   - Check security rules
   - Verify authentication status
   - Check Firebase project configuration

2. **Real-time Updates Not Working**
   - Check SSE connection status
   - Verify Firestore listeners are active
   - Check browser console for errors

3. **Inventory Not Updating**
   - Verify transactions are completing
   - Check for concurrent modification errors
   - Review Firestore operation logs

4. **Authentication Issues**
   - Verify Firebase Auth is enabled
   - Check email/password provider is active
   - Verify admin user exists

### Debug Mode

Enable detailed logging:
```javascript
// In firebase-monitor.js
this.isEnabled = true; // Force enable
```

---

## License

This project is proprietary software developed for The Chai Couple.

---

## Support

For issues or questions:
- Check Firebase Console for errors
- Review browser console logs
- Check server logs in deployment platform
- Contact development team

---

**Last Updated**: January 2024
**Version**: 0.1.0

