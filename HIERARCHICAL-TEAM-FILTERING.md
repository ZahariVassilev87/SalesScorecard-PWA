# 🎯 Hierarchical Team-Based Evaluation System

**Date:** September 30, 2025  
**Status:** ✅ DEPLOYED

---

## 📋 Overview

The Sales Scorecard PWA now implements **hierarchical team-based filtering** for evaluations. Each manager can only evaluate their direct subordinates within their own teams.

---

## 🏢 Evaluation Hierarchy

```
ADMIN / SALES_DIRECTOR
    ↓ (sees everyone)
    
REGIONAL_MANAGER
    ↓ evaluates (sees only Sales Leads in their managed teams)
    
SALES_LEAD
    ↓ evaluates (sees only Salespeople in their teams)
    
SALESPERSON
    (can only see themselves)
```

---

## 🎯 Who Can Evaluate Whom

### **Regional Manager (REGIONAL_MANAGER)**
- **Can Evaluate:** Sales Leads (SALES_LEAD)
- **Filtering:** Only Sales Leads in teams where the Regional Manager is the team manager
- **Form Used:** Sales Lead Coaching Evaluation (focuses on coaching abilities)

### **Sales Lead (SALES_LEAD)**
- **Can Evaluate:** Salespeople (SALESPERSON)
- **Filtering:** Only Salespeople in the same teams as the Sales Lead
- **Form Used:** Sales Lead → Salesperson Evaluation (focuses on sales skills)

### **Admin / Sales Director**
- **Can Evaluate:** Everyone (SALES_LEAD and SALESPERSON)
- **Filtering:** No restrictions - sees all active users
- **Form Used:** Standard evaluation form

### **Salesperson**
- **Can Evaluate:** Themselves only
- **Filtering:** Can only see their own profile
- **Purpose:** Self-evaluation and viewing their own scores

---

## 🔐 Backend Implementation

### **Endpoint:** `GET /organizations/salespeople`

The backend filters evaluatable users based on the authenticated user's role and team membership:

```javascript
// REGIONAL_MANAGER sees SALES_LEADs in their teams
if (role === 'REGIONAL_MANAGER') {
  query += ` AND u.role = 'SALES_LEAD' AND t."managerId" = $1`;
}

// SALES_LEAD sees SALESPEOPLEs in their teams
else if (role === 'SALES_LEAD') {
  query += ` AND u.role = 'SALESPERSON' AND t.id IN (
    SELECT ut2.teamId FROM user_teams ut2 WHERE ut2.userId = $1
  )`;
}

// SALESPERSON sees only themselves
else if (role === 'SALESPERSON') {
  query += ` AND u.id = $1`;
}

// ADMIN/SALES_DIRECTOR sees everyone
else if (role === 'ADMIN' || role === 'SALES_DIRECTOR') {
  query += ` AND u.role IN ('SALESPERSON', 'SALES_LEAD')`;
}
```

---

## 📱 Frontend Experience

### **Evaluation Form Dropdown**

When a user opens the Evaluation Form in the PWA, the dropdown shows:

#### **As Regional Manager:**
```
Select Team Member to Evaluate:
├── John Smith (Sales Lead) - Team Alpha
├── Jane Doe (Sales Lead) - Team Alpha  
└── Mike Johnson (Sales Lead) - Team Beta
```

#### **As Sales Lead:**
```
Select Team Member to Evaluate:
├── Sarah Connor (Salesperson) - Team Alpha
├── Kyle Reese (Salesperson) - Team Alpha
└── Marcus Wright (Salesperson) - Team Alpha
```

#### **As Salesperson:**
```
Select Team Member to Evaluate:
└── [Your own name] (Salesperson) - Team Alpha
```

---

## 🔄 How It Works

### **Step 1: User Logs In**
- User role and team membership are retrieved from JWT token
- Backend authenticates and authorizes the user

### **Step 2: User Opens Evaluation Form**
- Frontend calls `apiService.getEvaluatableUsers()`
- Backend filters based on role and team hierarchy
- Only relevant subordinates are returned

### **Step 3: User Selects Team Member**
- Dropdown shows only evaluatable team members
- Each entry shows: Name (Role) - Team Name

### **Step 4: User Completes Evaluation**
- Evaluation is submitted with selected team member
- Backend validates that the evaluator has permission
- Evaluation is saved with proper hierarchy tracking

---

## 🗄️ Database Schema

### **Key Tables:**

#### **users**
```sql
- id (primary key)
- email
- displayName
- role (REGIONAL_MANAGER, SALES_LEAD, SALESPERSON, etc.)
- isActive
```

#### **teams**
```sql
- id (primary key)
- name
- managerId (references users.id)
- regionId
```

#### **user_teams**
```sql
- userId (references users.id)
- teamId (references teams.id)
- (a user can be in multiple teams)
```

#### **evaluations**
```sql
- salespersonId (the person being evaluated)
- managerId (the person doing the evaluation)
- teamId (optional - for future use)
- items (evaluation scores and comments)
```

---

## ✅ Benefits

### **1. Data Privacy**
- Users only see their direct subordinates
- No access to other teams' members
- Prevents cross-team evaluation confusion

### **2. Organizational Clarity**
- Clear reporting structure
- Matches real-world team hierarchy
- Easy to understand who evaluates whom

### **3. Scalability**
- Works with any number of teams
- Supports multiple team memberships
- Easy to add new roles or levels

### **4. Security**
- Role-based access control (RBAC)
- Backend validation of permissions
- Cannot bypass restrictions via API

---

## 🧪 Testing Scenarios

### **Test Case 1: Regional Manager**
1. Log in as Regional Manager (manages Team Alpha)
2. Open Evaluation Form
3. **Expected:** See only Sales Leads from Team Alpha
4. **Should NOT see:** Salespeople, Sales Leads from other teams

### **Test Case 2: Sales Lead**
1. Log in as Sales Lead (member of Team Alpha)
2. Open Evaluation Form
3. **Expected:** See only Salespeople from Team Alpha
4. **Should NOT see:** Sales Leads, Salespeople from other teams

### **Test Case 3: Salesperson**
1. Log in as Salesperson
2. Open Evaluation Form
3. **Expected:** See only themselves
4. **Should NOT see:** Any other users

### **Test Case 4: Admin**
1. Log in as Admin
2. Open Evaluation Form
3. **Expected:** See all Sales Leads and Salespeople
4. **Can see:** Everyone across all teams

---

## 📊 Example Team Structure

```
Team: Alpha (Manager: Bob - Regional Manager)
├── John (Sales Lead)
│   ├── Sarah (Salesperson)
│   └── Kyle (Salesperson)
└── Jane (Sales Lead)
    └── Marcus (Salesperson)

Team: Beta (Manager: Alice - Regional Manager)
├── Tom (Sales Lead)
│   └── Lisa (Salesperson)
└── Jerry (Sales Lead)
    └── Emma (Salesperson)
```

### **What Bob (RM of Team Alpha) Sees:**
- John (Sales Lead)
- Jane (Sales Lead)

### **What John (SL in Team Alpha) Sees:**
- Sarah (Salesperson)
- Kyle (Salesperson)

### **What Alice (RM of Team Beta) Sees:**
- Tom (Sales Lead)
- Jerry (Sales Lead)

### **What Sarah (SP in Team Alpha) Sees:**
- Sarah (herself only)

---

## 🚀 Deployment Details

**Backend Changes:**
- ✅ Updated `/organizations/salespeople` endpoint
- ✅ Added hierarchical filtering logic
- ✅ Enhanced logging for debugging
- ✅ Tested with multiple roles

**Deployment:**
- Docker image built: `sales-scorecard-api:latest`
- Pushed to ECR: `221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest`
- Deployed to: AWS ECS (sales-scorecard-cluster)
- Region: eu-north-1 (Stockholm)

---

## 📝 Related Documents

- **SALES-EVALUATION-FORMS.md** - Details about evaluation form types
- **SALES-LEAD-COACHING-EVALUATION.md** - Coaching evaluation criteria
- **Backend Server:** `/production-backend/server.js` (line 823)
- **Frontend API:** `/src/services/api.ts` (getEvaluatableUsers method)
- **Evaluation Form:** `/src/components/EvaluationForm.tsx`

---

## 🔧 Configuration

### **Environment Variables**
No additional environment variables required. Uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Token authentication

### **Role Names** (case-sensitive)
- `ADMIN`
- `SALES_DIRECTOR`
- `REGIONAL_MANAGER`
- `REGIONAL_SALES_MANAGER` (alias for REGIONAL_MANAGER)
- `SALES_LEAD`
- `SALESPERSON`

---

## 💡 Future Enhancements

1. **Multi-Team Management**
   - Allow users to be managers of multiple teams
   - Show team selector if user manages multiple teams

2. **Cross-Team Visibility**
   - Optional setting for Sales Directors to see all teams
   - Regional view for multi-region organizations

3. **Delegation**
   - Allow temporary delegation of evaluation rights
   - Acting manager functionality during absences

4. **Analytics**
   - Team-based performance metrics
   - Hierarchy-aware reporting
   - Cross-team comparisons (for admins)

---

**Status:** ✅ Live and Active  
**Version:** 2.0  
**Last Updated:** September 30, 2025





