# Region Management - Admin Guide

## 🌍 **Overview**

As an administrator, you can now manage regions in the system. Regions are used to organize teams geographically and appear in various reports and analytics.

## 📍 **Accessing Region Management**

**URL:** `https://scorecard.instorm.io/manage-regions.html`

**Requirements:**
- You must be logged in as an ADMIN user
- Your authentication token will be automatically read from localStorage

## ✨ **Features**

### 1. **View All Regions**
- See all existing regions in a table
- View region ID, name, and creation date
- Regions are sorted alphabetically by name

### 2. **Create New Region**
- **Region ID:** A unique identifier (e.g., `bulgaria`, `germany`)
  - Use lowercase, no spaces
  - Cannot be changed after creation
- **Region Name:** The display name (e.g., `Bulgaria`, `Germany`)
  - Can contain spaces and capital letters
  - Can be edited later

### 3. **Edit Region Name**
- Click the "✏️ Edit" button next to any region
- Update the region name
- Click "Update Region" to save changes

### 4. **Delete Region**
- Click the "🗑️ Delete" button next to any region
- Confirm the deletion
- **Note:** You cannot delete a region if teams are assigned to it
  - You must first reassign those teams to another region
  - The system will show you how many teams are using the region

## 🔗 **API Endpoints**

The following endpoints are now available:

### **GET /public-admin/regions**
Fetch all regions (requires authentication)

### **POST /public-admin/regions**
Create a new region (requires ADMIN role)
```json
{
  "id": "region-id",
  "name": "Region Name"
}
```

### **PUT /public-admin/regions/:id**
Update a region's name (requires ADMIN role)
```json
{
  "name": "New Region Name"
}
```

### **DELETE /public-admin/regions/:id**
Delete a region (requires ADMIN role)
- Will fail if teams are assigned to this region

## 📊 **How Regions Work**

1. **Teams are assigned to regions** when you create or edit a team
2. **Region names appear in:**
   - Sales Director dashboard
   - Analytics reports
   - Team management views
   - Dropdown filters

3. **Default Regions:**
   - North America
   - Europe
   - Asia Pacific
   - Latin America

You can rename these or create new ones based on your organizational structure.

## 💡 **Best Practices**

1. **Use clear, descriptive names:**
   - ✅ Good: `Bulgaria`, `Central Europe`, `EMEA`
   - ❌ Avoid: `Reg1`, `Test`, `AAA`

2. **Keep region IDs simple:**
   - ✅ Good: `bulgaria`, `central-europe`, `emea`
   - ❌ Avoid: `reg_001`, `TEMP123`, `region-with-very-long-name`

3. **Plan before deleting:**
   - Check which teams are assigned to a region
   - Reassign teams before deleting
   - Consider renaming instead of deleting

4. **Organize logically:**
   - By country: Bulgaria, Romania, Greece
   - By area: Balkans, Western Europe, Nordics
   - By function: Direct Sales, Channel Partners

## 🔒 **Security**

- Only ADMIN users can create, edit, or delete regions
- All other users can only view regions
- All actions are logged on the backend
- Invalid requests are rejected with appropriate error messages

## 🐛 **Troubleshooting**

**Problem:** Can't delete a region
- **Solution:** Check if teams are assigned to it. Reassign teams first.

**Problem:** Region ID already exists
- **Solution:** Choose a different, unique ID.

**Problem:** Changes don't appear immediately
- **Solution:** Refresh the page to see the latest data.

**Problem:** "Unauthorized" error
- **Solution:** Make sure you're logged in as an ADMIN user.

## 📝 **Example Workflow**

1. **Login as Admin** at `https://scorecard.instorm.io`
2. **Navigate to** `https://scorecard.instorm.io/manage-regions.html`
3. **Create a new region:**
   - ID: `bulgaria`
   - Name: `Bulgaria`
4. **Edit an existing region:**
   - Change "North America" to "USA & Canada"
5. **Assign teams to the new region:**
   - Go to the admin panel
   - Edit teams and select the new region

## 🎉 **Success!**

You now have full control over your organization's regional structure!




