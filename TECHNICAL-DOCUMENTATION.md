# Sales Scorecard Platform - Technical Documentation

**Version:** 1.0  
**Date:** November 2025  
**Purpose:** Complete technical specification for rebuilding the Sales Scorecard PWA and Admin Panel

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Frontend (PWA)](#frontend-pwa)
4. [Backend API](#backend-api)
5. [Database Schema](#database-schema)
6. [Features & Functionality](#features--functionality)
   - [8. Multi-Client Form Customization & Seeding](#8-multi-client-form-customization--seeding)
7. [API Endpoints](#api-endpoints)
8. [Authentication & Authorization](#authentication--authorization)
9. [Deployment](#deployment)
10. [Technical Requirements](#technical-requirements)
11. [Development Setup](#development-setup)

---

## Executive Summary

### Overview
Sales Scorecard is a Progressive Web Application (PWA) designed for sales team management and performance evaluation. The platform enables managers to evaluate salespeople, track performance metrics, manage teams hierarchically, and generate analytics reports.

### Key Capabilities
- **Multi-tenant** system supporting multiple companies/clients
- **Flexible evaluation forms** - customizable per client with multiple versions
- **Form versioning** - clients can maintain multiple evaluation form versions
- **Dynamic form seeding** - evaluation forms can be seeded/configured per client needs
- **Role-based access control** with 7 distinct user roles
- **Evaluation system** with customizable customer types and behavior items
- **Hierarchical team management** (Regions → Teams → Users)
- **Real-time analytics** and performance dashboards
- **Offline-first** PWA with service worker support
- **Bilingual** interface (English/Bulgarian)
- **Admin panel** for user, team, and region management

### Technology Stack
- **Frontend:** React 18 + TypeScript, PWA with Service Workers
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL (AWS RDS)
- **Deployment:** AWS (ECS Fargate + S3/CloudFront)
- **Authentication:** JWT tokens (24h access, 7d refresh)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (PWA)                            │
│  React + TypeScript + PWA                                    │
│  Deployed: AWS S3 + CloudFront                              │
│  URL: https://scorecard.instorm.io                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST API
                       │ JWT Authentication
┌──────────────────────▼──────────────────────────────────────┐
│                  Backend API                                 │
│  Node.js + Express.js                                        │
│  Deployed: AWS ECS Fargate                                  │
│  URL: https://api.instorm.io                                 │
│  Port: 3000                                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ PostgreSQL Connection
┌──────────────────────▼──────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
│  AWS RDS (eu-north-1)                                        │
│  Database: sales_scorecard                                   │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Architecture

The system supports multiple companies through:
- `companyId` field on all relevant tables
- Default company: `company_metro`
- Super Admin role can access all companies
- Regular users are scoped to their company
- Company context resolved via query params, body, or headers

**Why Multi-Tenancy:**
- **Business Model:** Platform serves multiple clients, each with isolated data
- **Data Privacy:** Legal requirement - clients cannot see each other's data
- **Customization:** Each client can have custom evaluation forms and business rules
- **Scalability:** Single codebase serves multiple clients, reducing maintenance overhead
- **Security:** Company isolation prevents data breaches and unauthorized access

**Design Decisions:**
- **Row-Level Security:** `companyId` on every table ensures data isolation at database level
- **Default Company:** Backward compatibility for existing data and simpler single-client deployments
- **Super Admin Access:** Platform administrators need cross-company access for support and analytics
- **Context Resolution:** Multiple input methods (query, body, header) provide flexibility for different API consumers

### Multi-Client Flexibility & Customization

**Core Principle:**
The platform is designed to serve multiple clients, each with their own customized evaluation forms and business requirements. Each client (company) can have:
- **Custom evaluation forms** tailored to their specific needs
- **Multiple form versions** for different use cases or time periods
- **Flexible behavior categories and items** that match their evaluation criteria
- **Custom customer types** beyond the default Low/Mid/High Share

**Form Customization Architecture:**
- Evaluation forms are stored in `behavior_categories` and `behavior_items` tables
- Forms are scoped by `companyId` - each client has their own forms
- Forms can be versioned through naming conventions or version fields
- Forms can be seeded/configured via seeding scripts or admin interface
- Frontend dynamically loads forms based on company and customer type

**Form Versioning Strategy:**
1. **Naming Convention:** Forms can include version identifiers in category/item names
2. **Version Field:** (Future) Add `version` field to behavior_categories for explicit versioning
3. **Active/Inactive:** Use `isActive` flag to switch between form versions
4. **Date-based:** Forms can be time-stamped for historical tracking

**Seeding & Configuration:**
- Each client can have evaluation forms seeded via scripts (e.g., `seed-evaluation-forms.js`)
- Forms can be configured through admin panel (future enhancement)
- Multiple form templates can be maintained and activated as needed
- Forms can be cloned/duplicated for new versions

---

## Frontend (PWA)

### Technology Stack

**Core:**
- React 18.2.0
- TypeScript 4.9.4
- React Scripts 5.0.1 (via CRACO)

**Key Libraries:**
- `react-i18next` - Internationalization (EN/BG)
- `i18next-browser-languagedetector` - Language detection
- `dompurify` - XSS protection

**Build Tools:**
- CRACO (Create React App Configuration Override)
- Webpack (via React Scripts)
- Service Worker (disabled in current config)

### Project Structure

```
src/
├── components/              # React components
│   ├── SalesApp.tsx        # Main app container with navigation
│   ├── LoginForm.tsx       # Authentication form
│   ├── Dashboard.tsx      # User dashboard
│   ├── DirectorDashboard.tsx  # Sales Director analytics
│   ├── SalespersonEvaluationForm.tsx  # Salesperson evaluation
│   ├── CoachingEvaluationForm.tsx    # Sales Lead coaching evaluation
│   ├── EvaluationHistory.tsx        # Evaluation list/history
│   ├── AnalyticsView.tsx   # Analytics dashboard
│   ├── MyTeam.tsx          # Team member view
│   ├── TeamManagementView.tsx  # Team CRUD operations
│   ├── ExportView.tsx      # Data export functionality
│   ├── LanguageSwitcher.tsx  # Language toggle
│   └── ErrorBoundary.tsx   # Error handling
├── contexts/
│   └── AuthContext.tsx     # Authentication state management
├── services/
│   ├── api.ts              # API service layer
│   └── performanceAnalytics.ts  # Analytics calculations
├── hooks/
│   ├── useAutoSave.ts      # Auto-save functionality
│   └── useDashboardTranslations.ts  # Dashboard i18n
├── utils/
│   ├── errorHandler.ts     # Error handling utilities
│   ├── logger.ts           # Logging utilities
│   ├── notificationService.ts  # Push notifications
│   ├── offlineService.ts   # Offline data management
│   ├── performanceMonitor.ts  # Performance tracking
│   ├── sanitize.ts         # Input sanitization
│   └── secureStorage.ts    # Secure token storage
├── locales/
│   ├── en/                 # English translations
│   │   ├── common.json
│   │   ├── evaluation.json
│   │   ├── coaching.json
│   │   └── salesperson.json
│   └── bg/                 # Bulgarian translations
│       ├── common.json
│       ├── evaluation.json
│       ├── coaching.json
│       └── salesperson.json
├── i18n/
│   └── index.ts            # i18n configuration
├── App.tsx                 # Root component
├── App.css                 # Global styles
└── index.tsx               # Entry point

public/
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (disabled)
├── index.html              # HTML template
└── icons/                   # PWA icons (192x192, 512x512)
```

### Key Components

#### 1. SalesApp.tsx
**Purpose:** Main application container with role-based navigation

**Features:**
- Role-based menu rendering
- Tab-based navigation system
- Mobile-responsive hamburger menu
- Conditional component rendering based on user role

**Navigation Structure:**
- **Sales Directors:** Analytics Dashboard → Dashboard → Export
- **Other Roles:** Evaluation → History → Analytics → Export → Dashboard → Team → Teams (if manager)

#### 2. SalespersonEvaluationForm.tsx
**Purpose:** Form for evaluating salespeople

**Features:**
- Customer type selection (LOW_SHARE, MID_SHARE, HIGH_SHARE)
- Dynamic category loading:
  - HIGH_SHARE: Loads from backend database
  - LOW_SHARE/MID_SHARE: Uses hardcoded default categories
- Score input (1-4 scale) for each behavior item
- Example/comment fields per item
- Real-time overall score calculation (weighted average)
- Validation: All items must be scored before submission
- Offline support with auto-sync

**Form Structure:**
- Customer Type dropdown
- Salesperson selection
- Visit date, customer name, location
- Category sections with behavior items
- Overall comment field
- Submit button

#### 3. CoachingEvaluationForm.tsx
**Purpose:** Form for Regional Managers to evaluate Sales Leads

**Features:**
- Similar structure to SalespersonEvaluationForm
- Different categories focused on coaching skills
- Loads categories from backend based on user role

#### 4. Dashboard.tsx
**Purpose:** User's personal dashboard

**Features:**
- Recent evaluations
- Performance statistics
- Team overview
- Quick actions

#### 5. DirectorDashboard.tsx
**Purpose:** Sales Director analytics dashboard

**Features:**
- Company-wide metrics
- Region performance comparison
- Team statistics
- Evaluation trends
- Export capabilities

### State Management

**Authentication:**
- `AuthContext` provides global auth state
- Token stored in localStorage (fallback to sessionStorage)
- User data persisted in storage

**Form State:**
- Local component state (useState)
- Auto-save functionality (useAutoSave hook)
- Offline queue for pending submissions

### Frontend Key Functions

#### 1. Score Calculation Functions

**`calculateClusterScore(categoryId: string)`**

**Purpose & Why It Exists:**
Calculates the score for a single category (cluster) by averaging all item scores within that category. This provides category-level performance metrics that are then weighted and combined into the overall score.

**Business Logic:**
- **Category Performance:** Shows how well the salesperson performed in each evaluation category
- **Visual Feedback:** Displays category scores in the UI (color-coded, percentage-based)
- **Weighted Contribution:** Category scores are multiplied by category weights for overall score
- **Zero Handling:** Returns 0 if no items are scored (prevents division by zero)

**Why This Matters:**
- **Granular Analysis:** Managers can see which areas (Preparation, Problem Definition, etc.) need improvement
- **Fair Assessment:** Averages all items in a category, preventing one bad item from skewing the category score
- **User Experience:** Real-time category scores help users understand their progress as they fill out the form

**Calculation:**
```
clusterScore = (average of item scores / 4) * 100
Example: Items scored [3, 4, 3] → average 3.33 → (3.33/4) * 100 = 83.25%
```

---

**`calculateOverallScore()`**

**Purpose & Why It Exists:**
Calculates the final overall evaluation score by combining all category scores using their weights. This single number represents the salesperson's overall performance and is used for analytics, reporting, and performance tracking.

**Business Logic:**
- **Weighted Average:** Categories with higher weights contribute more to the overall score
- **Selective Inclusion:** Only includes categories that have at least one scored item (handles partial evaluations gracefully)
- **Real-Time Updates:** Recalculates as user scores items, providing immediate feedback
- **Zero Handling:** Returns 0 if no categories have scored items (distinguishes from "not started")

**Why Weighted:**
- **Business Priorities:** Some categories are more important than others (e.g., Preparation is 30% vs Problem Definition at 25%)
- **Client Customization:** Different clients can assign different weights based on their evaluation criteria
- **Fairness:** Prevents less important categories from having equal impact

**Calculation:**
```
overallScore = Σ(clusterScore × categoryWeight) / Σ(categoryWeights)
Only includes categories with at least one scored item
```

**Example:**
- Category 1 (weight 0.30): cluster score 83.25% → contribution: 83.25 × 0.30 = 24.975
- Category 2 (weight 0.25): cluster score 100% → contribution: 100 × 0.25 = 25.0
- Overall = (24.975 + 25.0) / (0.30 + 0.25) = 49.975 / 0.55 = 90.86%

---

#### 2. Form Category Resolution

**`getActiveCategories()`**

**Purpose & Why It Exists:**
Determines which evaluation form categories to use - either the company-specific form loaded from the database, or a hardcoded fallback. This enables multi-client customization while ensuring the system always has a working form.

**Business Logic:**
- **Client Customization:** Each client can have custom evaluation forms in the database
- **Fallback Safety:** If database forms aren't available, uses hardcoded defaults (ensures system always works)
- **Dynamic Loading:** Forms change based on customer type (HIGH_SHARE loads from DB, LOW/MID_SHARE may use fallback)
- **Version Support:** Can switch between form versions by managing the `categories` state

**Why This Design:**
- **Flexibility:** New clients can have completely custom forms without code changes
- **Reliability:** Fallback ensures system works even if database isn't configured
- **Migration Path:** Clients can gradually migrate from hardcoded to database forms
- **Backward Compatibility:** Existing functionality continues to work during transitions

**Decision Logic:**
```typescript
if (categories.length > 0) {
  // Use database-loaded form (client-specific)
  return categories;
} else {
  // Use hardcoded fallback (default form)
  return defaultCategories;
}
```

---

#### 3. Evaluation Submission Handler

**`handleSubmit(e: React.FormEvent)`**

**Purpose & Why It Exists:**
Validates and submits the evaluation form to the backend. This is the critical function that ensures data quality and creates the evaluation record in the database.

**Business Logic:**
- **Validation:** Ensures all required fields are filled and all items are scored (1-4)
- **Data Transformation:** Converts frontend form state into backend API format
- **Error Handling:** Displays user-friendly error messages for validation failures
- **Success Handling:** Redirects to evaluation history on successful submission

**Why Strict Validation:**
- **Data Quality:** Prevents incomplete evaluations from being saved
- **Analytics Accuracy:** Complete evaluations are required for accurate performance metrics
- **Business Rules:** All behavior items must be evaluated for fair assessment
- **User Experience:** Clear error messages guide users to complete the form correctly

**Validation Rules:**
1. Selected user must be chosen
2. Customer name must be provided
3. Location must be provided
4. All behavior items must have a score between 1 and 4
5. Visit date must be valid

**Submission Flow:**
1. Validate all fields
2. Transform form data to API format
3. Map behavior items (handle both database IDs and hardcoded IDs)
4. Calculate overall score
5. Send POST request to `/evaluations`
6. Handle success/error responses
7. Redirect or show error message

---

#### 4. API Service Request Handler

**`ApiService.request<T>(endpoint, options)`**

**Purpose & Why It Exists:**
Centralized API communication that handles authentication, error handling, and response parsing. This eliminates code duplication and ensures consistent API interaction patterns.

**Business Logic:**
- **Token Management:** Automatically includes JWT token in Authorization header
- **Error Standardization:** Converts HTTP errors into JavaScript Error objects with consistent format
- **Type Safety:** TypeScript generics ensure type-safe responses
- **Base URL:** Centralizes API endpoint configuration

**Why Centralized:**
- **DRY Principle:** Authentication and error handling logic in one place
- **Consistency:** All API calls behave the same way
- **Maintainability:** Change API base URL or auth logic in one place
- **Testing:** Easier to mock and test

**Error Handling:**
- Catches network errors (offline, timeout)
- Parses error responses from server
- Throws descriptive errors that components can display
- Logs errors for debugging

**Token Management:**
- Reads token from localStorage or sessionStorage
- Automatically includes in `Authorization: Bearer <token>` header
- Handles token expiration gracefully (returns 401/403 errors)

---

#### 5. Category Loading Logic

**`useEffect` for `customerType` changes**

**Purpose & Why It Exists:**
Dynamically loads evaluation form categories when the user selects a customer type. This enables different evaluation forms for different customer types (Low/Mid/High Share).

**Business Logic:**
- **HIGH_SHARE:** Loads custom form from database via API (`/scoring/categories?customerType=high-share`)
- **LOW_SHARE/MID_SHARE:** Uses hardcoded default categories (fallback for backward compatibility)
- **State Reset:** Clears scores and examples when switching customer types (prevents data confusion)
- **Loading States:** Shows loading indicator while fetching categories

**Why Dynamic Loading:**
- **Client Customization:** Each client can have different HIGH_SHARE forms
- **Performance:** Only loads forms when needed (not on initial page load)
- **Flexibility:** Easy to add new customer types without code changes
- **User Experience:** Form updates immediately when customer type changes

**Loading Flow:**
1. User selects customer type from dropdown
2. `useEffect` detects change
3. If HIGH_SHARE: Fetch categories from API
4. If LOW/MID_SHARE: Clear categories (triggers fallback to defaults)
5. Reset scores and examples
6. Update UI with new form structure

---

#### 6. Translation Functions

**`translateCategoryName(name: string)` and `translateItemName(name: string)`**

**Purpose & Why It Exists:**
Translates category and item names from the database (which may be in English) into the user's selected language (English or Bulgarian). This enables bilingual support for database-loaded forms.

**Business Logic:**
- **Database Forms:** HIGH_SHARE forms are stored in database with English names
- **User Language:** Users may prefer Bulgarian interface
- **Translation Mapping:** Maps database names to translation keys
- **Fallback:** Returns original name if translation not found

**Why This Matters:**
- **User Experience:** Users see forms in their preferred language
- **Consistency:** All UI elements (hardcoded and database forms) are translated
- **Flexibility:** Database forms can be in any language, frontend translates as needed

**Translation Strategy:**
- Maps database names to translation keys (e.g., "Preparation Before the Meeting" → `salesperson:cluster1`)
- Uses i18next for actual translation lookup
- Falls back to original name if translation missing (graceful degradation)

### Internationalization (i18n)

**Configuration:**
- Library: `react-i18next`
- Languages: English (en), Bulgarian (bg)
- Detection: localStorage → navigator → HTML tag
- Namespaces: common, evaluation, coaching, salesperson

**Translation Files:**
- Organized by feature/component
- Nested JSON structure
- Dynamic key interpolation

### PWA Features

**Manifest:**
- Standalone display mode
- Theme color: #667eea
- Icons: 192x192, 512x512
- Shortcuts: Dashboard, New Evaluation

**Service Worker:**
- Currently disabled (Chrome caching issues)
- Planned: Offline caching, background sync

**Offline Support:**
- IndexedDB for data storage
- Queue for pending API calls
- Auto-sync when connection restored

### Styling

**Approach:**
- CSS modules (App.css)
- Inline styles for dynamic theming
- Responsive design with mobile-first approach
- Color-coded categories (purple, blue, green, amber)

**Mobile Optimization:**
- Large touch targets (64px minimum)
- Hamburger menu for navigation
- Full-screen forms
- Swipe gestures (planned)

---

## Backend API

### Technology Stack

**Core:**
- Node.js 18+
- Express.js 4.18.2
- PostgreSQL 8.16.3 (pg library)

**Key Libraries:**
- `jsonwebtoken` - JWT token generation/verification
- `bcrypt` - Password hashing
- `cors` - Cross-origin resource sharing
- `body-parser` - Request body parsing
- `nodemailer` - Email notifications (backups)
- `web-push` - Push notifications (optional)

### Project Structure

```
production-backend/
├── server.js                 # Main Express application
├── package.json              # Dependencies
├── Dockerfile                # Docker configuration
├── .env                      # Environment variables
├── backup-database.js        # Database backup script
├── auto-backup.sh            # Automated backup script
├── send-backup-notification.js  # Email notifications
├── seed-high-share-form.js   # High-share form seeding
├── seed-evaluation-forms.js  # Evaluation form seeding
└── public/
    └── react-admin/          # Admin panel static files
```

### Server Configuration

**Port:** 3000 (configurable via PORT env var)

**CORS Origins:**
- https://d2tuhgmig1r5ut.cloudfront.net
- https://scorecard.instorm.io
- https://api.scorecard.instorm.io
- https://api.instorm.io
- https://instorm.io
- https://www.instorm.io
- http://localhost:3000 (development)

**Middleware:**
- CORS with credentials
- Body parser (JSON)
- Static file serving for admin panel
- JWT authentication middleware

### Database Connection

**Connection Pool:**
- PostgreSQL connection pool (pg.Pool)
- SSL enabled (rejectUnauthorized: false)
- Connection string from DATABASE_URL env var

**Why Connection Pooling:**
- **Performance:** Reuses database connections instead of creating new ones for each request
- **Resource Management:** Limits concurrent connections to prevent database overload
- **Scalability:** Handles high traffic efficiently with limited database connections
- **Reliability:** Automatic connection recovery if database temporarily unavailable

**Migrations:**
- Auto-run on server startup
- Adds missing columns (customerType, isActive)
- Creates indexes
- Updates existing records with defaults

**Why Auto-Migrations:**
- **Zero-Downtime Deployments:** Schema updates happen automatically with code deployment
- **Consistency:** Ensures all environments have the same schema without manual intervention
- **Developer Experience:** Developers don't need to remember to run migration scripts
- **Error Prevention:** Prevents "column does not exist" errors in production
- **Backward Compatibility:** Uses `IF NOT EXISTS` to avoid errors if migrations already applied

### Key Functions

#### 1. Authentication Middleware
```javascript
function authenticateToken(req, res, next)
```

**Purpose & Why It Exists:**
This middleware protects all API endpoints by validating JWT tokens before processing requests. It exists to ensure that only authenticated users can access the API and that user identity is consistently available throughout the request lifecycle.

**Business Logic:**
- **Security First:** Prevents unauthorized access to sensitive sales data and evaluation information
- **User Context:** Attaches user information (id, email, role, companyId) to the request object, making it available to all downstream handlers
- **Default Company:** Sets a default `companyId` if missing from the token payload, ensuring multi-tenant isolation even for legacy tokens
- **Error Handling:** Returns appropriate HTTP status codes (401 for missing token, 403 for invalid token) to help frontend handle authentication errors gracefully

**Design Decisions:**
- Uses Bearer token format (`Authorization: Bearer <token>`) - industry standard, easy to integrate
- Synchronous JWT verification - fast, no database lookup needed for each request
- Attaches user to `req.user` - allows all route handlers to access user context without additional lookups
- Default company fallback - ensures backward compatibility with tokens issued before multi-tenancy was fully implemented

**Use Cases:**
- Every protected endpoint uses this middleware
- Frontend sends token in Authorization header on every API call
- Token expiration (24h) forces re-authentication, maintaining security

---

#### 2. Company Context Resolution
```javascript
function resolveCompanyContext(req)
```

**Purpose & Why It Exists:**
This function determines which company's data a request should access. It's critical for multi-tenant isolation - ensuring that users from one company cannot see or modify data from another company. This is a core security and data privacy requirement.

**Business Logic:**
- **Multi-Tenant Isolation:** Each company's data must be completely isolated from others
- **Super Admin Flexibility:** Super Admins need to access all companies for platform management, but regular users are strictly scoped
- **Multiple Input Methods:** Supports company selection via query params, request body, or headers - provides flexibility for different API consumers
- **Default Behavior:** Super Admins default to "all companies" view, regular users default to their own company

**Why Multiple Input Methods:**
- **Query Params:** Easy for GET requests and URL-based filtering (`?companyId=company_metro`)
- **Request Body:** Natural for POST/PUT requests where company context is part of the payload
- **Headers:** Useful for API clients that want to set company context once per session (`X-Company-Id`)

**Security Considerations:**
- Regular users cannot override their company scope - even if they try to pass a different `companyId`, they're restricted to their own
- Super Admins can explicitly request "all" companies via `?companyId=all` for cross-company analytics
- All database queries use the resolved `companyId` to filter results, preventing data leakage

**Use Cases:**
- Admin panel filtering by company
- Analytics dashboards showing company-specific or cross-company data
- User management scoped to company
- Evaluation creation ensuring salesperson and manager are from same company

---

#### 3. Column Detection Utility
```javascript
async function getUserTeamsColumns(client)
```

**Purpose & Why It Exists:**
This function dynamically detects the database schema style (camelCase vs snake_case) for the `user_teams` table. It exists because the database schema evolved over time, and different deployments may have different column naming conventions. This utility ensures the code works regardless of schema style.

**Business Problem It Solves:**
- **Schema Evolution:** The database was migrated from snake_case to camelCase, but some tables/columns may still use snake_case
- **Deployment Flexibility:** Different clients may have databases with different schemas
- **Zero-Downtime Migrations:** Allows gradual schema migration without breaking the application
- **Backward Compatibility:** Ensures the application works with both old and new schema formats

**How It Works:**
1. Queries `information_schema.columns` to get actual column names from the database
2. Checks for multiple possible column name formats (camelCase, snake_case, lowercase)
3. Returns properly quoted column names that match the actual schema
4. Logs detected columns for debugging

**Why This Matters:**
- **SQL Injection Prevention:** Using detected column names prevents hardcoded column references that might fail
- **Schema Agnostic:** Code doesn't need to know which schema style is in use
- **Migration Safety:** During schema migrations, the function adapts automatically
- **Error Prevention:** Avoids "column does not exist" errors that would crash the application

**Design Decisions:**
- **Preference Order:** Checks camelCase first (new standard), then snake_case (legacy), then lowercase (edge case)
- **Quoted Output:** Returns quoted identifiers (`"userId"`) for camelCase to handle PostgreSQL case sensitivity
- **Company Column Detection:** Also detects `companyId` column variations for multi-tenant queries
- **Null Handling:** Returns `null` for optional columns (like timestamps) that may not exist

**Use Cases:**
- Team membership queries (`SELECT * FROM user_teams WHERE ${teamCol} = $1`)
- User-team relationship lookups
- Team deletion (removing memberships before deleting team)
- Hierarchical team filtering

---

#### 4. Database Migrations
```javascript
async function runMigrations()
```

**Purpose & Why It Exists:**
This function automatically applies database schema changes on server startup. It ensures the database structure is always up-to-date without requiring manual SQL scripts or downtime. This is critical for maintaining data consistency and adding new features.

**Business Logic:**
- **Zero-Downtime Updates:** Schema changes are applied automatically when new code is deployed
- **Backward Compatibility:** Uses `IF NOT EXISTS` checks to avoid errors if columns already exist
- **Data Integrity:** Updates existing records with default values when new columns are added
- **Index Creation:** Automatically creates performance indexes for new columns

**Why Auto-Migration:**
- **Deployment Simplicity:** Developers don't need to remember to run migration scripts
- **Consistency:** Ensures all environments (dev, staging, production) have the same schema
- **Error Prevention:** Prevents "column does not exist" errors in production
- **Feature Rollout:** New features that require schema changes work immediately after deployment

**Current Migrations:**
1. **customerType Column:** Added to support Low/Mid/High Share customer types in evaluations
2. **isActive Column:** Added for soft-delete functionality (users can be deactivated without losing data)
3. **Index Creation:** Performance indexes for frequently queried columns

**Design Decisions:**
- **Idempotent:** Can run multiple times safely (checks before altering)
- **Non-Breaking:** Uses `ALTER TABLE ADD COLUMN` with defaults, doesn't modify existing data
- **Error Handling:** Catches and logs errors but doesn't crash server (allows graceful degradation)
- **PostgreSQL-Specific:** Uses PostgreSQL's `DO $$` blocks for conditional logic

**Use Cases:**
- Adding new evaluation fields (customerType, location coordinates)
- Adding user management features (isActive flag)
- Performance optimization (creating indexes)
- Multi-tenant enhancements (companyId columns)

---

#### 5. Evaluation Authorization Middleware
```javascript
const authorizeEvaluationCreation = (req, res, next)
```

**Purpose & Why It Exists:**
This middleware enforces role-based access control for evaluation creation. Not all users should be able to create evaluations - only managers and above. This prevents data integrity issues and ensures evaluations are created by authorized personnel.

**Business Logic:**
- **Role Hierarchy:** Only managers (SALES_LEAD and above) can evaluate their subordinates
- **Data Quality:** Prevents unauthorized or incorrect evaluations from being created
- **Audit Trail:** Ensures all evaluations are traceable to authorized managers
- **Business Rules:** Enforces organizational structure (salespeople don't evaluate themselves)

**Why These Roles:**
- **ADMIN/SALES_DIRECTOR:** Full access for administrative purposes
- **REGIONAL_SALES_MANAGER/REGIONAL_MANAGER:** Can evaluate teams in their region
- **SALES_LEAD:** Can evaluate salespeople in their team
- **SALESPERSON:** Cannot create evaluations (they are the subjects, not creators)

**Design Decisions:**
- **Explicit Allow List:** Only specified roles can proceed (more secure than deny list)
- **Early Return:** Returns 403 immediately if unauthorized (doesn't waste processing)
- **Clear Error Message:** Tells user exactly why they're denied (better UX)

**Use Cases:**
- Sales Lead evaluating a Salesperson
- Regional Manager evaluating a Sales Lead (coaching evaluation)
- Admin creating test evaluations
- Preventing salespeople from creating fake evaluations

---

#### 6. Score Calculation Functions

**Backend: `calculateOverallScore(items)`**
```javascript
function calculateOverallScore(items)
```

**Purpose & Why It Exists:**
Calculates the overall evaluation score from individual behavior item scores. This provides a single metric that represents the salesperson's overall performance, which is used for analytics, reporting, and performance tracking.

**Business Logic:**
- **Simple Average:** Calculates mean of all valid item scores (1-4 scale)
- **Data Validation:** Filters out invalid scores (null, 0, or out of range)
- **Null Handling:** Returns `null` instead of 0 for invalid data (distinguishes "no data" from "zero score")
- **Precision:** Rounds to 2 decimal places for readability

**Why This Approach:**
- **Simplicity:** Easy to understand and explain to stakeholders
- **Fairness:** All items weighted equally (category weights applied separately in frontend)
- **Robustness:** Handles missing or invalid scores gracefully
- **Consistency:** Same calculation method across all evaluations

**Frontend: `calculateOverallScore()` and `calculateClusterScore()`**

**Purpose:**
Frontend calculates scores in real-time as users fill out the form, providing immediate feedback. Uses weighted average based on category weights.

**Why Real-Time Calculation:**
- **User Feedback:** Users see their score update as they rate items
- **Validation:** Helps users understand if they're being too harsh or lenient
- **Engagement:** Immediate feedback increases form completion rates
- **Accuracy:** Ensures users understand the scoring system before submission

**Weighted Average Logic:**
- Each category has a weight (e.g., Preparation: 30%, Problem Definition: 25%)
- Cluster score = average of item scores in that category
- Overall score = sum of (cluster score × category weight) / sum of weights
- Only includes categories with at least one scored item

**Why Weighted:**
- **Business Priorities:** Some categories (like Preparation) are more important than others
- **Flexibility:** Different clients can assign different weights based on their priorities
- **Fairness:** Prevents one category from dominating the overall score

---

#### 7. Form Category Loading Logic

**Frontend: `getActiveCategories()`**
```typescript
const getActiveCategories = () => (categories.length > 0 ? categories : defaultCategories);
```

**Purpose & Why It Exists:**
This function determines which evaluation form to use - either the company-specific form loaded from the database, or a hardcoded fallback form. This enables multi-client customization while maintaining backward compatibility.

**Business Logic:**
- **Client Customization:** Each client can have their own evaluation forms stored in the database
- **Fallback Safety:** If no custom form exists, uses hardcoded default form (ensures system always works)
- **Dynamic Loading:** Forms are loaded based on customer type and company context
- **Version Support:** Can switch between form versions by setting `isActive` flags

**Why This Design:**
- **Flexibility:** New clients can have completely custom forms without code changes
- **Reliability:** Fallback ensures the system works even if database forms aren't configured
- **Migration Path:** Existing clients can gradually migrate from hardcoded to database forms
- **Multi-Version:** Supports A/B testing or gradual rollout of new form versions

**Use Cases:**
- Metro client: Uses database forms for HIGH_SHARE, hardcoded for LOW/MID_SHARE
- New client: Uses database forms for all customer types
- Form updates: New version activated, old version kept for historical data

---

#### 8. API Service Layer

**Frontend: `ApiService.request<T>()`**
```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T>
```

**Purpose & Why It Exists:**
Centralized API communication layer that handles authentication, error handling, and request formatting. This eliminates code duplication and ensures consistent API interaction patterns across the frontend.

**Business Logic:**
- **Token Management:** Automatically includes JWT token in all requests
- **Error Handling:** Standardizes error responses for consistent user experience
- **Type Safety:** TypeScript generics ensure type-safe API responses
- **Base URL:** Centralizes API endpoint configuration

**Why Centralized:**
- **DRY Principle:** Don't repeat authentication logic in every component
- **Consistency:** All API calls use the same error handling and token management
- **Maintainability:** Change API base URL or auth logic in one place
- **Testing:** Easier to mock and test API interactions

**Design Decisions:**
- **Bearer Token:** Standard JWT authentication format
- **Error Throwing:** Throws errors that components can catch and display
- **Generic Types:** TypeScript ensures compile-time type safety
- **Fetch API:** Modern, promise-based, no external dependencies

**Use Cases:**
- Login, logout, token refresh
- Loading evaluations, teams, users
- Creating evaluations
- Analytics data fetching

---

#### 9. Company ID Normalization
```javascript
function normalizeCompanyId(rawId)
function slugifyCompanyName(rawName)
```

**Purpose & Why It Exists:**
These functions sanitize and normalize company identifiers to ensure consistency and prevent security issues. Company IDs are used in URLs, database queries, and API calls, so they must be safe and predictable.

**Business Logic:**
- **Security:** Prevents SQL injection and XSS attacks by sanitizing input
- **Consistency:** Ensures company IDs follow a standard format (lowercase, underscores)
- **URL Safety:** Makes company IDs safe for use in URLs and query parameters
- **Database Compatibility:** Ensures IDs are valid PostgreSQL identifiers

**Why Normalization:**
- **User Input:** Company names come from user input (may have spaces, special chars)
- **URL Safety:** Company IDs appear in URLs - must be URL-safe
- **Database Safety:** Prevents invalid identifiers that could break queries
- **Case Insensitivity:** Normalizes to lowercase for consistent lookups

**Design Decisions:**
- **Slug Format:** Converts "Company Name" → "company_name" (readable, URL-safe)
- **Character Filtering:** Removes special characters, keeps only alphanumeric and underscores
- **Validation:** Returns `null` for invalid input (fails safely)
- **Idempotent:** Same input always produces same output

**Use Cases:**
- Creating new companies from admin panel
- Validating company IDs in API requests
- Generating company IDs from company names
- URL routing with company context

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  "displayName" VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

**Roles:**
- SUPER_ADMIN
- ADMIN
- SALES_DIRECTOR
- REGIONAL_SALES_MANAGER
- REGIONAL_MANAGER
- SALES_LEAD
- SALESPERSON

#### teams
```sql
CREATE TABLE teams (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "regionId" VARCHAR(255),
  "managerId" VARCHAR(255),
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("regionId") REFERENCES regions(id),
  FOREIGN KEY ("managerId") REFERENCES users(id)
);
```

#### user_teams
```sql
CREATE TABLE user_teams (
  id VARCHAR(255) PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL,
  "teamId" VARCHAR(255) NOT NULL,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES users(id),
  FOREIGN KEY ("teamId") REFERENCES teams(id),
  UNIQUE("userId", "teamId")
);
```

**Note:** Column names use quoted camelCase (`"userId"`, `"teamId"`). System includes dynamic detection for compatibility.

#### regions
```sql
CREATE TABLE regions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

#### evaluations
```sql
CREATE TABLE evaluations (
  id VARCHAR(255) PRIMARY KEY,
  "salespersonId" VARCHAR(255) NOT NULL,
  "managerId" VARCHAR(255) NOT NULL,
  "visitDate" TIMESTAMP NOT NULL,
  "customerName" VARCHAR(255),
  "customerType" VARCHAR(50) DEFAULT 'LOW_SHARE',
  location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  "locationAccuracy" DECIMAL(10, 2),
  "overallComment" TEXT,
  "overallScore" DECIMAL(5, 2),
  version INTEGER DEFAULT 1,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("salespersonId") REFERENCES users(id),
  FOREIGN KEY ("managerId") REFERENCES users(id)
);
```

**Customer Types:**
- LOW_SHARE
- MID_SHARE
- HIGH_SHARE
- COACHING (for Sales Lead evaluations)

#### evaluation_items
```sql
CREATE TABLE evaluation_items (
  id VARCHAR(255) PRIMARY KEY,
  "evaluationId" VARCHAR(255) NOT NULL,
  "behaviorItemId" VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4),
  comment TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("evaluationId") REFERENCES evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY ("behaviorItemId") REFERENCES behavior_items(id)
);
```

#### behavior_categories
```sql
CREATE TABLE behavior_categories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "order" INTEGER NOT NULL,
  weight DECIMAL(5, 4) NOT NULL,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "version" VARCHAR(50),  -- Optional: Form version identifier
  "isActive" BOOLEAN DEFAULT true,  -- For version switching
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

**Naming Convention:**
- Standard: `"Category Name (ROLE)"`
- High Share: `"Category Name (ROLE) HIGH_SHARE"`
- Versioned: `"Category Name (ROLE) v2.0"` or use `version` field
- Custom Types: `"Category Name (ROLE) CUSTOM_TYPE"`

**Multi-Client Support:**
- Each `companyId` can have completely different evaluation forms
- Forms are isolated per company - no cross-contamination
- Multiple form versions can coexist (via `isActive` or version field)
- Forms can be customized for specific client needs (different categories, items, weights)

#### behavior_items
```sql
CREATE TABLE behavior_items (
  id VARCHAR(255) PRIMARY KEY,
  "categoryId" VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "companyId" VARCHAR(255) DEFAULT 'company_metro',
  "description" TEXT,  -- Optional: Score descriptions (1-4)
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("categoryId") REFERENCES behavior_categories(id)
);
```

**Multi-Client Customization:**
- Each client can have different behavior items per category
- Items can be customized with client-specific wording
- Items can include score descriptions (1-4 scale explanations)
- Items can be activated/deactivated per client needs

### Indexes

**Performance Indexes:**
- `idx_evaluations_customer_type` on evaluations("customerType")
- `idx_users_is_active` on users("isActive")
- `idx_users_company` on users("companyId")
- `idx_evaluations_company` on evaluations("companyId")

### Relationships

```
users (1) ──< (N) user_teams (N) >── (1) teams
teams (N) >── (1) regions
teams (N) >── (1) users (manager)
evaluations (N) >── (1) users (salesperson)
evaluations (N) >── (1) users (manager)
evaluations (1) ──< (N) evaluation_items (N) >── (1) behavior_items
behavior_items (N) >── (1) behavior_categories
```

---

## Features & Functionality

### 1. User Management

**Admin Panel Features:**
- Create users (email, displayName, role, companyId)
- Update users (email, displayName, role, isActive)
- Delete users (soft delete via isActive)
- List users with filtering by company
- Password reset functionality

**User Roles & Permissions:**

| Role | Can Evaluate | Can View Analytics | Can Manage Teams | Can Export | Can Access Admin |
|------|--------------|-------------------|------------------|-----------|------------------|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| SALES_DIRECTOR | ❌ | ✅ | ✅ | ✅ | ❌ |
| REGIONAL_SALES_MANAGER | ✅ | ✅ | ✅ | ❌ | ❌ |
| REGIONAL_MANAGER | ✅ | ✅ | ❌ | ❌ | ❌ |
| SALES_LEAD | ✅ | ✅ | ❌ | ✅ | ❌ |
| SALESPERSON | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2. Team Management

**Hierarchical Structure:**
```
Company
  └── Regions
      └── Teams
          └── Users (Salespeople)
```

**Features:**
- Create/Update/Delete regions
- Create/Update/Delete teams
- Assign users to teams
- Remove users from teams
- View team members
- Team-based filtering in evaluations

**Team Assignment:**
- Users can belong to multiple teams
- Many-to-many relationship via `user_teams` table
- Team manager assignment (optional)

### 3. Evaluation System

#### Multi-Client Evaluation Forms

**Core Flexibility:**
The evaluation system is designed to be fully customizable per client. Each client (company) can have:
- **Custom evaluation forms** with their own categories and behavior items
- **Multiple form versions** for different scenarios or time periods
- **Flexible customer types** beyond default Low/Mid/High Share
- **Custom scoring criteria** with different weights and scales

**Form Loading Logic:**
1. **Company-Scoped:** Forms are loaded based on `companyId` - each client sees only their forms
2. **Role-Based:** Forms are filtered by target role (SALESPERSON, SALES_LEAD, etc.)
3. **Customer Type:** Forms can be filtered by customer type (LOW_SHARE, MID_SHARE, HIGH_SHARE, or custom types)
4. **Version Selection:** Active version determined by `isActive` flag or version field

**Default Evaluation Types (Example - Metro Client):**

**1. Salesperson Evaluation (SALES_LEAD evaluates SALESPERSON)**
- **Customer Types:**
  - **LOW_SHARE / MID_SHARE:** Hardcoded form with 4 categories, 17 items (fallback)
  - **HIGH_SHARE:** Database-driven form with 4 categories, 17 items (different questions)

**2. Coaching Evaluation (REGIONAL_MANAGER evaluates SALES_LEAD)**
- Database-driven categories
- Focus on coaching skills
- Different behavior items

**Custom Client Forms:**
- Each new client can have completely different evaluation forms
- Forms are seeded via scripts or admin interface
- Forms can include any number of categories and items
- Categories can have custom weights
- Items can have custom score descriptions

#### Evaluation Flow

1. **Form Selection:**
   - User selects evaluation type based on role
   - Selects salesperson/lead to evaluate
   - Chooses customer type (for salesperson evaluations)
   - System automatically loads company-specific form

2. **Category Loading (Multi-Client Aware):**
   - **Company-Scoped:** Forms loaded based on user's `companyId`
   - **HIGH_SHARE:** Fetches from `/scoring/categories?customerType=high-share` (company-specific)
   - **LOW_SHARE/MID_SHARE:** 
     - First attempts to load from database (company-specific)
     - Falls back to hardcoded `defaultCategories` if no company forms exist
   - **Coaching:** Fetches from `/scoring/categories` (role-based, company-specific)
   - **Custom Types:** Loads custom customer type forms from database

3. **Scoring:**
   - Each behavior item scored 1-4 (or custom scale if configured)
   - Optional comment/example per item
   - Real-time cluster score calculation
   - Real-time overall score calculation (weighted average using category weights)

4. **Validation:**
   - All items must be scored (1-4)
   - Required fields: salesperson, customer name, location, visit date
   - Duplicate check (same manager, salesperson, date, customer)
   - Form-specific validation rules (if configured)

5. **Submission:**
   - Creates evaluation record with `companyId`
   - Creates evaluation_items for each scored behavior
   - Calculates and stores overall score
   - Returns evaluation ID
   - All data scoped to company

#### Score Calculation

**Cluster Score (per category):**
```
clusterScore = (average of item scores / 4) * 100
```

**Overall Score:**
```
overallScore = Σ(clusterScore × categoryWeight) / Σ(categoryWeights)
```

**Example:**
- Category 1 (weight 0.30): items scored [3, 4, 3] → avg 3.33 → cluster 83.25%
- Category 2 (weight 0.25): items scored [4, 4] → avg 4.0 → cluster 100%
- Overall = (83.25 × 0.30 + 100 × 0.25) / (0.30 + 0.25) = 90.14%

### 4. Analytics & Reporting

**Dashboard Types:**

1. **User Dashboard:**
   - Recent evaluations
   - Personal statistics
   - Team overview

2. **Analytics Dashboard (Sales Leads, Regional Managers):**
   - Team performance metrics
   - Evaluation trends
   - Score distributions
   - Customer type breakdown

3. **Director Dashboard (Sales Directors):**
   - Company-wide metrics
   - Region comparisons
   - Team rankings
   - Evaluation volume trends
   - Average scores by region/team
   - Target achievement tracking

**Metrics Calculated:**
- Total evaluations
- Average scores
- Score distributions (1-4 breakdown)
- Evaluation frequency
- Customer type distribution
- Team member performance

### 5. Export Functionality

**Export Formats:**
- CSV export
- Excel export (planned)
- PDF reports (planned)

**Exportable Data:**
- Evaluations with all details
- Performance statistics
- Team reports
- Date range filtering
- Company/region/team filtering

### 6. Multi-Tenancy

**Company Isolation:**
- All data scoped by `companyId`
- Default company: `company_metro`
- Super Admins can access all companies
- Regular users restricted to their company

**Company Context Resolution:**
1. Query parameter: `?companyId=company_metro`
2. Request body: `{ companyId: "company_metro" }`
3. Header: `X-Company-Id: company_metro`
4. User's default companyId
5. Fallback to DEFAULT_COMPANY_ID

### 7. Backup System

**Automated Backups:**
- Daily backups at 23:00 (11 PM)
- Cron job execution
- Email notifications with backup details
- Backup retention (configurable)

**Backup Contents:**
- All table data (JSON format)
- SQL dump for restoration
- Summary statistics (row counts)

**Backup Location:**
- Local filesystem: `production-backend/backups/`
- Filename format: `backup-YYYY-MM-DDTHH-mm-ss/`

### 8. Multi-Client Form Customization & Seeding

**Overview:**
The platform is designed to serve multiple clients, each with their own customized evaluation forms. This section details how forms can be customized, versioned, and seeded for different clients.

#### Form Customization Architecture

**Company-Scoped Forms:**
- All evaluation forms (`behavior_categories` and `behavior_items`) are scoped by `companyId`
- Each client (company) has completely isolated forms
- Forms are loaded dynamically based on the user's company context
- No cross-contamination between client forms

**Form Structure:**
```
Company (companyId)
  └── Behavior Categories
      ├── Category 1 (weight, order)
      │   └── Behavior Items (order, isActive, descriptions)
      ├── Category 2 (weight, order)
      │   └── Behavior Items
      └── ...
```

**Customization Options:**
1. **Categories:** Each client can have different categories with custom names, weights, and order
2. **Items:** Each category can have different behavior items with custom wording
3. **Weights:** Category weights can be customized per client (must sum to 1.0)
4. **Customer Types:** Clients can define custom customer types beyond Low/Mid/High Share
5. **Score Descriptions:** Items can include descriptions for each score level (1-4)

#### Form Versioning

**Versioning Strategies:**

1. **Active/Inactive Flag:**
   - Use `isActive` field to switch between form versions
   - Old versions remain in database (for historical data)
   - Only active forms are loaded for evaluations

2. **Version Field:**
   - Add `version` field to `behavior_categories` table
   - Forms can be tagged with version identifiers (e.g., "v1.0", "v2.0", "2025-Q1")
   - Load specific version via API parameter

3. **Naming Convention:**
   - Include version in category/item names (e.g., "Category Name v2.0")
   - Filter by name pattern when loading forms

4. **Date-Based Versioning:**
   - Use `createdAt` timestamps to identify form versions
   - Activate forms based on date ranges

**Version Management:**
- Multiple versions can coexist in database
- Only one version active at a time (via `isActive`)
- Historical evaluations reference the form version used at time of creation
- Version switching can be done via admin interface or seeding scripts

#### Form Seeding

**Seeding Methods:**

1. **Script-Based Seeding:**
   - Create seeding scripts (e.g., `seed-client-forms.js`)
   - Scripts define categories, items, weights, and descriptions
   - Run scripts to populate forms for new clients
   - Can seed multiple form versions

2. **API-Based Seeding:**
   - Use `/public-admin/companies/:companyId/seed-defaults` endpoint
   - Can seed from template company or custom configuration
   - Supports cloning forms from existing company

3. **Admin Interface:**
   - (Future) Admin panel for creating/editing forms
   - Visual form builder
   - Drag-and-drop category/item ordering

**Seeding Script Structure:**
```javascript
const clientForms = {
  companyId: 'company_new_client',
  forms: [
    {
      name: 'Salesperson Evaluation v1.0',
      customerType: 'STANDARD',
      categories: [
        {
          name: 'Preparation (SALESPERSON)',
          order: 1,
          weight: 0.30,
          items: [
            {
              name: 'Custom behavior item 1',
              order: 1,
              descriptions: {
                1: 'Poor performance',
                2: 'Below average',
                3: 'Good performance',
                4: 'Excellent performance'
              }
            }
          ]
        }
      ]
    }
  ]
};
```

**Seeding Process:**
1. Create company record (if not exists)
2. Define form structure (categories, items, weights)
3. Insert into `behavior_categories` table
4. Insert into `behavior_items` table
5. Set `isActive=true` for active version
6. Verify form integrity (weights sum to 1.0, all items have categories)

#### Client Onboarding Process

**New Client Setup:**

1. **Create Company:**
   ```sql
   INSERT INTO companies (id, name, ...) VALUES ('company_new_client', 'New Client Name', ...);
   ```

2. **Create Users:**
   - Create admin user for the client
   - Create initial team structure (regions, teams)

3. **Seed Evaluation Forms:**
   - Run seeding script for the client
   - Configure forms based on client requirements
   - Test form loading and evaluation creation

4. **Configure Custom Types:**
   - Define custom customer types if needed
   - Update frontend to support custom types (if required)

5. **Activate Forms:**
   - Set `isActive=true` for active form version
   - Deactivate old versions if migrating

#### Form Loading Logic

**Backend Logic (`/scoring/categories` endpoint):**

```javascript
// 1. Determine company context
const companyId = user.companyId || DEFAULT_COMPANY_ID;

// 2. Determine target role (SALESPERSON, SALES_LEAD, etc.)
const targetRole = determineTargetRole(user.role);

// 3. Determine customer type filter
const customerTypeFilter = req.query.customerType;

// 4. Query company-specific categories
const query = `
  SELECT bc.* FROM behavior_categories bc
  WHERE bc."companyId" = $1
    AND bc.name LIKE '%' || $2 || '%'
    AND bc."isActive" = true
    ${customerTypeFilter ? `AND bc.name LIKE '%${customerTypeFilter}%'` : ''}
  ORDER BY bc."order"
`;

// 5. Load items for each category
// 6. Return complete form structure
```

**Frontend Logic:**
- Forms are loaded dynamically based on company context
- No hardcoded forms (except fallback for LOW_SHARE/MID_SHARE)
- Forms adapt to company-specific structure automatically

#### Best Practices

**Form Design:**
- Keep category weights summing to 1.0
- Use consistent naming conventions
- Include clear item descriptions
- Test forms before activating

**Version Management:**
- Document form changes in version notes
- Keep old versions for historical reference
- Test new versions before switching
- Communicate changes to users

**Multi-Client Considerations:**
- Ensure company isolation (no data leakage)
- Test forms for each client independently
- Maintain separate seeding scripts per client
- Version control seeding scripts

---

## API Endpoints

### Authentication

#### POST /auth/login
**Description:** User authentication

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "SALES_LEAD",
    "companyId": "company_metro",
    "isActive": true
  }
}
```

**Status Codes:**
- 200: Success
- 401: Invalid credentials
- 500: Server error

#### POST /auth/refresh
**Description:** Refresh access token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "token": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

#### POST /auth/logout
**Description:** Logout (client-side token removal)

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### Evaluations

#### POST /evaluations
**Description:** Create new evaluation

**Authentication:** Required (Bearer token)

**Authorization:** ADMIN, SALES_DIRECTOR, REGIONAL_SALES_MANAGER, REGIONAL_MANAGER, SALES_LEAD

**Request:**
```json
{
  "salespersonId": "user-id",
  "visitDate": "2025-11-17",
  "customerName": "Restaurant Milano",
  "customerType": "HIGH_SHARE",
  "location": "Sofia",
  "overallComment": "Great performance",
  "items": [
    {
      "behaviorItemId": "item-id-1",
      "rating": 4,
      "comment": "Excellent preparation"
    },
    {
      "behaviorItemId": "item-id-2",
      "rating": 3,
      "comment": "Good but could improve"
    }
  ]
}
```

**Response:**
```json
{
  "id": "eval-id",
  "salespersonId": "user-id",
  "managerId": "manager-id",
  "visitDate": "2025-11-17T00:00:00.000Z",
  "customerName": "Restaurant Milano",
  "customerType": "HIGH_SHARE",
  "location": "Sofia",
  "overallScore": 3.75,
  "createdAt": "2025-11-17T12:00:00.000Z"
}
```

**Validation:**
- All items must have rating between 1-4
- At least one item required
- Duplicate check (same manager, salesperson, date, customer within 5 seconds)

#### GET /evaluations/my
**Description:** Get user's evaluations (created by or about user)

**Authentication:** Required

**Query Parameters:**
- `companyId` (optional): Filter by company

**Response:**
```json
[
  {
    "id": "eval-id",
    "salespersonId": "user-id",
    "salesperson": {
      "id": "user-id",
      "displayName": "John Doe",
      "email": "john@example.com"
    },
    "manager": {
      "id": "manager-id",
      "displayName": "Jane Manager"
    },
    "visitDate": "2025-11-17T00:00:00.000Z",
    "customerName": "Restaurant Milano",
    "customerType": "HIGH_SHARE",
    "overallScore": 3.75,
    "items": [
      {
        "id": "item-id",
        "behaviorItemId": "behavior-id",
        "rating": 4,
        "comment": "Excellent",
        "behaviorItem": {
          "name": "Identify core products..."
        }
      }
    ]
  }
]
```

### Scoring Categories

#### GET /scoring/categories
**Description:** Get behavior categories for evaluation forms (company-specific)

**Authentication:** Required

**Query Parameters:**
- `customerType` (optional): "high-share" for high-share form, or custom customer type
- `version` (optional): Form version identifier (future enhancement)
- `companyId` (optional): Override company context (admin only)

**Response:**
```json
[
  {
    "id": "category-id",
    "name": "Preparation Before the Meeting (SALESPERSON) HIGH_SHARE",
    "order": 1,
    "weight": 0.25,
    "version": "v1.0",
    "isActive": true,
    "items": [
      {
        "id": "item-id",
        "name": "Identify core products the client uses...",
        "order": 1,
        "isActive": true,
        "description": "Score descriptions (optional)"
      }
    ]
  }
]
```

**Logic:**
- **Company-Scoped:** Returns forms for user's company (`companyId`)
- **Role-Based:** REGIONAL_MANAGER gets SALES_LEAD categories, others get SALESPERSON
- **Customer Type Filter:**
  - If `customerType=high-share`: Returns HIGH_SHARE categories
  - If `customerType=custom-type`: Returns custom type categories
  - Otherwise: Returns standard categories (excludes HIGH_SHARE and custom types)
- **Active Only:** Only returns categories with `isActive=true`
- **Version Support:** (Future) Can filter by version field

### Teams & Organizations

#### GET /organizations/teams
**Description:** Get teams user has access to (hierarchical filtering)

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "team-id",
    "name": "Team Alpha",
    "region": {
      "id": "region-id",
      "name": "Sofia Region"
    },
    "manager": {
      "id": "manager-id",
      "displayName": "Jane Manager"
    },
    "userTeams": [
      {
        "user": {
          "id": "user-id",
          "displayName": "John Doe",
          "email": "john@example.com"
        }
      }
    ]
  }
]
```

#### GET /organizations/salespeople
**Description:** Get salespeople user can evaluate (hierarchical filtering)

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "user-id",
    "email": "john@example.com",
    "displayName": "John Doe",
    "role": "SALESPERSON",
    "isActive": true,
    "teamId": "team-id"
  }
]
```

**Hierarchical Filtering:**
- SALES_DIRECTOR: All salespeople in company
- REGIONAL_SALES_MANAGER: Salespeople in manager's region
- REGIONAL_MANAGER: Salespeople in manager's teams
- SALES_LEAD: Salespeople in manager's team

#### GET /users/my-team
**Description:** Get current user's team with all members

**Authentication:** Required

**Response:**
```json
{
  "id": "team-id",
  "name": "Team Alpha",
  "region": {
    "id": "region-id",
    "name": "Sofia Region"
  },
  "members": [
    {
      "id": "user-id",
      "displayName": "John Doe",
      "email": "john@example.com",
      "role": "SALESPERSON"
    }
  ],
  "manager": {
    "id": "manager-id",
    "displayName": "Jane Manager"
  }
}
```

### Admin Panel

#### GET /public-admin/users
**Description:** Get all users (admin only)

**Authentication:** Required (ADMIN role)

**Query Parameters:**
- `companyId` (optional): Filter by company
- `role` (optional): Filter by role
- `isActive` (optional): Filter by active status

**Response:**
```json
[
  {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "SALES_LEAD",
    "isActive": true,
    "companyId": "company_metro"
  }
]
```

#### POST /public-admin/users
**Description:** Create new user

**Authentication:** Required (ADMIN role)

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "displayName": "New User",
  "role": "SALESPERSON",
  "companyId": "company_metro"
}
```

**Response:**
```json
{
  "id": "new-user-id",
  "email": "newuser@example.com",
  "displayName": "New User",
  "role": "SALESPERSON",
  "isActive": true,
  "companyId": "company_metro"
}
```

#### PUT /public-admin/users/:id
**Description:** Update user

**Authentication:** Required (ADMIN role)

**Request:**
```json
{
  "displayName": "Updated Name",
  "email": "updated@example.com",
  "role": "SALES_LEAD",
  "isActive": true
}
```

**Note:** Cannot change `companyId` via this endpoint

#### DELETE /public-admin/users/:id
**Description:** Delete user (soft delete via isActive=false)

**Authentication:** Required (ADMIN role)

#### GET /public-admin/teams
**Description:** Get all teams

**Authentication:** Required

**Query Parameters:**
- `companyId` (optional): Filter by company

#### POST /public-admin/teams
**Description:** Create new team

**Authentication:** Required (ADMIN role)

**Request:**
```json
{
  "name": "Team Alpha",
  "regionId": "region-id",
  "managerId": "manager-id"
}
```

#### PUT /public-admin/teams/:id
**Description:** Update team

**Authentication:** Required (ADMIN role)

#### DELETE /public-admin/teams/:id
**Description:** Delete team (removes memberships first)

**Authentication:** Required (ADMIN role)

#### POST /public-admin/assign-user-to-team
**Description:** Assign user to team

**Authentication:** Required

**Request:**
```json
{
  "userId": "user-id",
  "teamId": "team-id"
}
```

#### POST /public-admin/remove-user-from-team
**Description:** Remove user from team

**Authentication:** Required

**Request:**
```json
{
  "userId": "user-id",
  "teamId": "team-id"
}
```

#### GET /public-admin/regions
**Description:** Get all regions

**Authentication:** Required

#### POST /public-admin/regions
**Description:** Create new region

**Authentication:** Required (ADMIN role)

#### PUT /public-admin/regions/:id
**Description:** Update region

**Authentication:** Required (ADMIN role)

#### DELETE /public-admin/regions/:id
**Description:** Delete region

**Authentication:** Required (ADMIN role)

### Form Management

#### POST /public-admin/companies/:companyId/seed-defaults
**Description:** Seed default evaluation forms for a company

**Authentication:** Required (ADMIN role)

**Request:**
```json
{
  "templateCompanyId": "company_metro",  // Optional: Clone from template
  "forms": [  // Optional: Custom form definition
    {
      "name": "Salesperson Evaluation",
      "customerType": "STANDARD",
      "categories": [
        {
          "name": "Category Name (SALESPERSON)",
          "order": 1,
          "weight": 0.25,
          "items": [
            {
              "name": "Behavior item name",
              "order": 1,
              "descriptions": {
                "1": "Poor",
                "2": "Below average",
                "3": "Good",
                "4": "Excellent"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "message": "Forms seeded successfully",
  "categories": 4,
  "items": 17,
  "forms": [
    {
      "id": "form-id",
      "name": "Salesperson Evaluation",
      "version": "v1.0"
    }
  ]
}
```

**Logic:**
- If `templateCompanyId` provided: Clones forms from template company
- If `forms` provided: Creates custom forms from definition
- Sets `isActive=true` for seeded forms
- Validates form structure (weights sum to 1.0, items have categories)
- Returns summary of created forms

### Analytics

#### GET /analytics/dashboard
**Description:** Get analytics dashboard data

**Authentication:** Required

**Response:**
```json
{
  "totalEvaluations": 150,
  "averageScore": 3.45,
  "scoreDistribution": {
    "1": 5,
    "2": 20,
    "3": 75,
    "4": 50
  },
  "recentEvaluations": [...],
  "teamPerformance": [...]
}
```

#### GET /analytics/director-dashboard
**Description:** Get Sales Director dashboard data (company-wide)

**Authentication:** Required (SALES_DIRECTOR role)

**Response:**
```json
{
  "totalRegions": 5,
  "totalTeamMembers": 120,
  "averagePerformance": 3.52,
  "totalSales": 1500000,
  "evaluationsCompleted": 450,
  "targetAchievement": 0.85,
  "regions": [
    {
      "id": "region-id",
      "name": "Sofia Region",
      "averageScore": 3.6,
      "totalEvaluations": 90
    }
  ]
}
```

### Health & Debug

#### GET /health
**Description:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T12:00:00.000Z"
}
```

---

## Authentication & Authorization

### JWT Tokens

**Access Token:**
- Algorithm: HS256
- Expiration: 24 hours
- Payload:
  ```json
  {
    "id": "user-id",
    "email": "user@example.com",
    "role": "SALES_LEAD",
    "displayName": "John Doe",
    "companyId": "company_metro",
    "iat": 1234567890,
    "exp": 1234654290
  }
  ```

**Refresh Token:**
- Algorithm: HS256
- Expiration: 7 days
- Payload:
  ```json
  {
    "id": "user-id",
    "email": "user@example.com",
    "companyId": "company_metro",
    "iat": 1234567890,
    "exp": 1235153490
  }
  ```

**Token Storage:**
- Frontend: localStorage (fallback to sessionStorage)
- Headers: `Authorization: Bearer <token>`

### Password Security

**Hashing:**
- Algorithm: bcrypt
- Salt rounds: 10
- Storage: Hashed password in database

**Password Requirements:**
- Minimum length: 8 characters (recommended)
- No complexity requirements (current implementation)

### Authorization Rules

**Role-Based Access Control (RBAC):**

1. **Evaluation Creation:**
   - Allowed: ADMIN, SALES_DIRECTOR, REGIONAL_SALES_MANAGER, REGIONAL_MANAGER, SALES_LEAD
   - Denied: SALESPERSON

2. **Admin Panel Access:**
   - Allowed: ADMIN, SUPER_ADMIN
   - Denied: All other roles

3. **Team Management:**
   - Create/Update/Delete: ADMIN, SALES_DIRECTOR, REGIONAL_SALES_MANAGER, REGIONAL_MANAGER
   - View: All authenticated users

4. **Analytics:**
   - Director Dashboard: SALES_DIRECTOR only
   - Regular Analytics: ADMIN, REGIONAL_SALES_MANAGER, REGIONAL_MANAGER, SALES_LEAD

5. **Export:**
   - Allowed: ADMIN, SALES_DIRECTOR, REGIONAL_SALES_MANAGER, REGIONAL_MANAGER, SALES_LEAD

### Company Scoping

**Super Admin:**
- Can access all companies
- Query param `?companyId=all` returns all companies
- Default: All companies

**Regular Users:**
- Scoped to their `companyId`
- Cannot access other companies' data
- Company context from user record

---

## Deployment

### Frontend Deployment (PWA)

**Platform:** AWS S3 + CloudFront

**Build Process:**
```bash
npm run build
# Creates optimized production build in build/ directory
```

**Deployment Script:** `update-aws.sh`

**Steps:**
1. Build React app (`npm run build`)
2. Upload to S3 bucket (`aws s3 sync build/ s3://bucket-name --delete`)
3. Invalidate CloudFront cache (`aws cloudfront create-invalidation`)

**S3 Configuration:**
- Static website hosting enabled
- Bucket policy: Public read access
- Error document: index.html (for SPA routing)

**CloudFront Configuration:**
- Origin: S3 bucket
- Default root object: index.html
- Error pages: 404 → /index.html (SPA routing)
- HTTPS: Required
- Caching: Optimized for static content

**Environment Variables:**
- `REACT_APP_API_BASE_URL`: Backend API URL (https://api.instorm.io)

### Backend Deployment

**Platform:** AWS ECS Fargate

**Container:**
- Base image: `node:18-alpine`
- Port: 3000
- Health check: `/health` endpoint

**Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
USER nodejs
EXPOSE 3000
CMD ["npm", "start"]
```

**Deployment Script:** `deploy-backend.sh`

**Steps:**
1. Build Docker image (`docker build -t sales-scorecard-api:latest .`)
2. Tag for ECR (`docker tag sales-scorecard-api:latest ECR_REPO:latest`)
3. Push to ECR (`docker push ECR_REPO:latest`)
4. Force ECS service update (`aws ecs update-service --force-new-deployment`)

**ECS Configuration:**
- Cluster: `sales-scorecard-cluster`
- Service: `sales-scorecard-service`
- Task Family: `sales-scorecard-task`
- Region: `eu-north-1`
- Platform: `linux/amd64`

**Environment Variables (ECS Task Definition):**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `REFRESH_SECRET`: Refresh token secret
- `PORT`: 3000
- `NODE_ENV`: production

**Database:**
- Platform: AWS RDS PostgreSQL
- Region: eu-north-1
- Connection: SSL required
- Connection string format: `postgresql://user:pass@host:5432/dbname`

### Backup Deployment

**Automated Backups:**
- Schedule: Daily at 23:00 (11 PM)
- Method: Cron job on ECS task
- Script: `auto-backup.sh`

**Backup Process:**
1. Run `backup-database.js` (creates JSON + SQL backup)
2. Clean old backups (retention policy)
3. Send email notification via `send-backup-notification.js`

**Email Configuration:**
- SMTP: Gmail (smtp.gmail.com:587)
- Authentication: App Password
- Recipient: Configurable via `BACKUP_NOTIFICATION_EMAIL`

---

## Technical Requirements

### Frontend Requirements

**Runtime:**
- Node.js 18+
- Modern browser with ES6+ support
- Service Worker support (for PWA features)

**Build Tools:**
- npm or yarn
- React Scripts 5.0.1
- CRACO 7.1.0

**Browser Support:**
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

**Performance Targets:**
- Lighthouse Performance: 95+
- Lighthouse Accessibility: 95+
- Lighthouse Best Practices: 95+
- Initial bundle size: < 200KB gzipped

### Backend Requirements

**Runtime:**
- Node.js 18+
- PostgreSQL 12+

**Dependencies:**
- express: ^4.18.2
- pg: ^8.16.3
- jsonwebtoken: ^9.0.2
- bcrypt: ^5.1.1
- cors: ^2.8.5
- body-parser: ^1.20.2
- nodemailer: ^6.10.1 (for backups)

**Server Resources:**
- CPU: 1 vCPU (minimum)
- Memory: 2 GB (minimum)
- Disk: 20 GB (for backups)

### Database Requirements

**PostgreSQL:**
- Version: 12+
- Encoding: UTF-8
- Timezone: UTC

**Connection:**
- SSL: Required
- Max connections: 100 (configurable)
- Connection pool: 10-20 connections

**Storage:**
- Initial: 20 GB
- Auto-scaling: Recommended
- Backup retention: 7 days (AWS RDS)

### Infrastructure Requirements

**AWS Services:**
- S3: Static website hosting
- CloudFront: CDN distribution
- ECS Fargate: Container hosting
- ECR: Docker image registry
- RDS: PostgreSQL database
- IAM: Access control

**Network:**
- HTTPS: Required (TLS 1.2+)
- CORS: Configured for specific origins
- Firewall: Security groups for RDS

---

## Development Setup

### Frontend Setup

```bash
# Clone repository
git clone <repository-url>
cd SalesScorecard-PWA

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_NAME=Sales Scorecard
REACT_APP_SHORT_NAME=SalesScorecard
EOF

# Start development server
npm start
# Opens http://localhost:3000
```

### Backend Setup

```bash
# Navigate to backend directory
cd production-backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/sales_scorecard
JWT_SECRET=your-secret-key
REFRESH_SECRET=your-refresh-secret
PORT=3000
NODE_ENV=development
EOF

# Start server
npm start
# Server runs on http://localhost:3000
```

### Database Setup

```sql
-- Create database
CREATE DATABASE sales_scorecard;

-- Run migrations (auto-run on server startup)
-- Or manually run setup-database endpoint:
-- GET http://localhost:3000/debug/setup-database
```

### Seed Data

**Default Forms (Metro Client):**
```bash
# Seed high-share evaluation form for Metro
node seed-high-share-form.js

# Seed standard evaluation forms for Metro
node seed-evaluation-forms.js
```

**Custom Client Forms:**
```bash
# Create custom seeding script for new client
# Example: seed-client-forms.js
node seed-client-forms.js --companyId=company_new_client

# Or use API endpoint
curl -X POST https://api.instorm.io/public-admin/companies/company_new_client/seed-defaults \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "templateCompanyId": "company_metro"
  }'
```

**Seeding Script Template:**
```javascript
// seed-client-forms.js
const { Pool } = require('pg');
const crypto = require('crypto');

const COMPANY_ID = process.env.COMPANY_ID || 'company_new_client';

async function seedClientForms() {
  // 1. Connect to database
  // 2. Define form structure
  // 3. Insert categories
  // 4. Insert items
  // 5. Set isActive=true
  // 6. Verify integrity
}

seedClientForms();
```

### Testing

**Frontend:**
```bash
npm test
```

**Backend:**
- Manual testing via Postman/curl
- Health check: `GET /health`
- Authentication: `POST /auth/login`

---

## Additional Notes

### Security Considerations

1. **Password Security:**
   - Passwords hashed with bcrypt
   - No password complexity enforcement (should be added)

2. **JWT Security:**
   - Tokens expire after 24 hours
   - Refresh tokens expire after 7 days
   - Secrets stored in environment variables

3. **SQL Injection:**
   - Parameterized queries used throughout
   - No raw SQL string concatenation

4. **XSS Protection:**
   - DOMPurify used for sanitization
   - React escapes by default

5. **CORS:**
   - Restricted to specific origins
   - Credentials enabled

### Performance Optimizations

1. **Frontend:**
   - Code splitting (React lazy loading)
   - Asset hashing for cache busting
   - Optimized bundle size

2. **Backend:**
   - Connection pooling for database
   - Indexed database queries
   - Efficient hierarchical queries

3. **Database:**
   - Indexes on frequently queried columns
   - Foreign key constraints for data integrity

### Known Limitations

1. **Service Worker:**
   - Currently disabled due to Chrome caching issues
   - Offline support limited

2. **Password Reset:**
   - No automated password reset flow
   - Manual admin reset required

3. **Push Notifications:**
   - Configured but optional
   - Requires VAPID keys

4. **Export Formats:**
   - CSV export implemented
   - Excel/PDF exports planned

### Future Enhancements

1. **Features:**
   - **Visual Form Builder:** Admin interface for creating/editing evaluation forms
   - **Form Versioning UI:** Interface for managing multiple form versions
   - **Form Templates Library:** Pre-built form templates for common industries
   - **Real-time notifications**
   - **Advanced analytics charts**
   - **Mobile app (React Native)**
   - **Bulk evaluation import**

2. **Technical:**
   - **Explicit Version Field:** Add `version` column to behavior_categories for better versioning
   - **Form Validation Engine:** Configurable validation rules per form
   - **Form Import/Export:** JSON/YAML import/export for forms
   - **GraphQL API (optional)**
   - **Redis caching**
   - **WebSocket for real-time updates**
   - **Automated testing suite**

---

## Contact & Support

**Repository:** https://github.com/ZahariVassilev87/SalesScorecard-PWA  
**API Endpoint:** https://api.instorm.io  
**PWA URL:** https://scorecard.instorm.io

---

---

## Architectural Patterns & Design Decisions

This section explains the "why" behind key architectural decisions and patterns used throughout the platform.

### 1. Why JWT Tokens Instead of Sessions?

**Decision:** Use stateless JWT tokens for authentication instead of server-side sessions.

**Reasons:**
- **Scalability:** No need for shared session storage (Redis/database) - works across multiple server instances
- **Performance:** No database lookup on every request - token validation is fast
- **Stateless:** Server doesn't need to maintain session state - easier horizontal scaling
- **Mobile-Friendly:** Tokens work well with mobile apps and PWAs that may have unreliable connections
- **CORS-Friendly:** Tokens work seamlessly with cross-origin requests

**Trade-offs:**
- **Token Revocation:** Cannot instantly revoke tokens (must wait for expiration) - mitigated by short 24h expiration
- **Token Size:** JWT tokens are larger than session IDs - acceptable for this use case
- **Security:** Tokens must be stored securely on client - handled via secure storage utilities

---

### 2. Why Multi-Tenancy via `companyId` Instead of Separate Databases?

**Decision:** Use a single database with `companyId` column for multi-tenancy instead of separate databases per client.

**Reasons:**
- **Cost Efficiency:** Single database is cheaper than multiple databases
- **Simplified Deployment:** One database to manage, backup, and maintain
- **Cross-Company Analytics:** Super admins can analyze data across all companies
- **Shared Resources:** Database connections, indexes, and optimizations benefit all clients
- **Easier Migrations:** Schema changes apply to all clients simultaneously

**Trade-offs:**
- **Data Isolation:** Must be careful with queries to always filter by `companyId` - mitigated by `resolveCompanyContext()`
- **Performance:** Large datasets may need partitioning - not an issue at current scale
- **Compliance:** Some regulations may require separate databases - can be addressed if needed

**Security Measures:**
- All queries automatically filter by `companyId` via `resolveCompanyContext()`
- Regular users cannot override their company scope
- Database-level constraints prevent cross-company data access

---

### 3. Why Dynamic Column Detection Instead of Fixed Schema?

**Decision:** Dynamically detect database column names (camelCase vs snake_case) instead of assuming a fixed schema.

**Reasons:**
- **Schema Evolution:** Database was migrated from snake_case to camelCase - supports both during transition
- **Deployment Flexibility:** Different clients may have different schema versions
- **Zero-Downtime Migrations:** Can migrate schema gradually without breaking the application
- **Backward Compatibility:** Works with old databases that haven't been migrated yet

**Trade-offs:**
- **Performance:** Small overhead of querying `information_schema` - minimal impact, cached in memory
- **Complexity:** More complex than fixed schema - but necessary for flexibility
- **Debugging:** Must check logs to see which schema is detected - mitigated by logging

**When to Use:**
- Tables that have undergone schema migrations
- Tables that may exist in different formats across deployments
- Critical tables where schema changes could break the application

---

### 4. Why Hardcoded Fallback Forms Instead of Database-Only?

**Decision:** Use hardcoded default categories as fallback when database forms aren't available.

**Reasons:**
- **Reliability:** System always works even if database forms aren't configured
- **Backward Compatibility:** Existing functionality continues to work during migration
- **Development:** Developers can work without setting up database forms
- **Performance:** Hardcoded forms load instantly (no API call needed)

**Trade-offs:**
- **Code Duplication:** Form structure exists in both code and database - acceptable for reliability
- **Maintenance:** Changes to default form require code changes - but provides stability
- **Flexibility:** Hardcoded forms can't be customized per client - but database forms can override

**Migration Strategy:**
1. Start with hardcoded forms (current state for LOW/MID_SHARE)
2. Gradually migrate to database forms (HIGH_SHARE already migrated)
3. Keep hardcoded as fallback for reliability
4. Eventually all forms in database, hardcoded becomes legacy fallback

---

### 5. Why Real-Time Score Calculation Instead of Backend-Only?

**Decision:** Calculate evaluation scores in real-time on the frontend as users fill out forms.

**Reasons:**
- **User Experience:** Immediate feedback helps users understand their scoring
- **Engagement:** Real-time updates increase form completion rates
- **Validation:** Users can see if they're being too harsh or lenient before submitting
- **Performance:** No need to wait for backend calculation - instant feedback

**Trade-offs:**
- **Code Duplication:** Score calculation logic exists in both frontend and backend - mitigated by keeping logic simple
- **Consistency:** Must ensure frontend and backend calculations match - verified through testing
- **Security:** Frontend calculation could be manipulated - but backend validates and recalculates on submission

**Backend Validation:**
- Backend recalculates score on submission to ensure accuracy
- Frontend calculation is for UX only - backend is source of truth
- Any discrepancy would be caught and logged

---

### 6. Why Role-Based Access Control (RBAC) Instead of Permission-Based?

**Decision:** Use role-based access control with predefined roles instead of granular permissions.

**Reasons:**
- **Simplicity:** Easy to understand - roles map directly to organizational hierarchy
- **Performance:** Fast authorization checks - just compare role strings
- **Maintainability:** Clear role definitions - easy to see who can do what
- **Business Alignment:** Roles match real-world job titles and responsibilities

**Trade-offs:**
- **Flexibility:** Cannot create custom permission combinations - but roles cover all use cases
- **Granularity:** Cannot grant partial permissions - but roles are sufficient for business needs
- **Scalability:** Adding new roles requires code changes - but roles are stable

**Role Hierarchy:**
```
SUPER_ADMIN (all access)
  └── ADMIN (company management)
      └── SALES_DIRECTOR (company-wide analytics)
          └── REGIONAL_SALES_MANAGER (region management)
              └── REGIONAL_MANAGER (team management)
                  └── SALES_LEAD (evaluate salespeople)
                      └── SALESPERSON (evaluated, no permissions)
```

---

### 7. Why PWA Instead of Native Mobile App?

**Decision:** Build as Progressive Web App instead of native iOS/Android apps.

**Reasons:**
- **Cross-Platform:** Single codebase works on iOS, Android, and desktop
- **Deployment:** Update instantly without app store approval
- **Cost:** No need to maintain separate iOS and Android codebases
- **Web Technologies:** Team expertise in React/TypeScript, not native development
- **Offline Support:** Service workers provide offline capabilities similar to native apps

**Trade-offs:**
- **Performance:** Slightly slower than native apps - but acceptable for this use case
- **Features:** Limited access to device features - but sufficient for evaluation forms
- **App Store:** Not in app stores - but can be installed from browser

**PWA Features Used:**
- Install prompt (add to home screen)
- Offline caching (service worker)
- Push notifications (web push API)
- Responsive design (works on all screen sizes)

---

### 8. Why PostgreSQL Instead of NoSQL?

**Decision:** Use PostgreSQL relational database instead of NoSQL (MongoDB, etc.).

**Reasons:**
- **Data Relationships:** Complex relationships (users, teams, evaluations, items) benefit from relational model
- **ACID Compliance:** Transactions ensure data integrity (e.g., evaluation creation with multiple items)
- **Query Flexibility:** Complex analytics queries are easier with SQL
- **Multi-Tenancy:** Row-level security via `companyId` works naturally with relational model
- **Team Expertise:** Team familiar with SQL and relational databases

**Trade-offs:**
- **Scalability:** May need sharding at very large scale - not an issue currently
- **Schema Rigidity:** Schema changes require migrations - but provides data integrity
- **Performance:** Some operations slower than NoSQL - but acceptable for this workload

**When PostgreSQL Excels:**
- Complex joins (evaluations with items, users with teams)
- Aggregations (analytics, score calculations)
- Transactions (creating evaluation with multiple items atomically)
- Data integrity (foreign keys, constraints)

---

### 9. Why Auto-Migrations Instead of Manual SQL Scripts?

**Decision:** Run database migrations automatically on server startup instead of requiring manual SQL scripts.

**Reasons:**
- **Deployment Simplicity:** Schema updates happen automatically with code deployment
- **Consistency:** All environments (dev, staging, production) have same schema
- **Error Prevention:** Prevents "column does not exist" errors in production
- **Developer Experience:** Developers don't need to remember migration steps

**Trade-offs:**
- **Control:** Less control over when migrations run - but migrations are idempotent
- **Rollback:** No automatic rollback - but migrations are additive (add columns, not remove)
- **Complexity:** More complex migrations may need manual intervention - but current migrations are simple

**Migration Safety:**
- All migrations use `IF NOT EXISTS` - safe to run multiple times
- Only additive changes (add columns, create indexes) - no data loss
- Updates existing records with defaults - maintains data integrity

---

### 10. Why Weighted Score Calculation Instead of Simple Average?

**Decision:** Use weighted average for overall score calculation instead of simple average of all items.

**Reasons:**
- **Business Priorities:** Some categories (e.g., Preparation) are more important than others
- **Fairness:** Prevents less important categories from having equal impact
- **Flexibility:** Different clients can assign different weights based on their priorities
- **Real-World Alignment:** Matches how managers actually evaluate performance

**Trade-offs:**
- **Complexity:** More complex than simple average - but provides better accuracy
- **User Understanding:** Users must understand weights - but UI shows weights clearly
- **Configuration:** Weights must be configured correctly - but validated on form creation

**Weight Assignment:**
- Categories have weights that sum to 1.0 (100%)
- Example: Preparation (30%), Problem Definition (25%), Objections (25%), Proposal (20%)
- Weights can be customized per client in their evaluation forms

---

**Document Version:** 1.0  
**Last Updated:** November 2025  
**Maintained By:** Development Team

