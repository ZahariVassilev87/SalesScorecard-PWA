# 🔧 Admin Panel Delete Functionality Fix

**Date**: September 30, 2025  
**Issue**: API 500 errors when deleting teams or removing team members in admin panel  
**Status**: ✅ Fixed

## 🐛 Problem Analysis

The admin panel was returning generic 500 errors when:
1. Deleting a team
2. Removing a user from a team

### Root Causes:
1. **Generic error handling** - 500 errors didn't provide specific details about what went wrong
2. **Missing foreign key checks** - No validation before deletion for dependent data
3. **No member removal endpoint** - Admin panel couldn't remove individual members from teams
4. **Insufficient cleanup** - Related data wasn't properly cleaned up before deletion

## ✅ Fixes Implemented

### 1. Enhanced Team Deletion Endpoint

**Location**: `production-backend/server.js` - `DELETE /public-admin/teams/:id`

**Improvements**:
- ✅ Added detailed logging for each step
- ✅ Check for evaluations related to team members
- ✅ Block deletion if team members manage other teams
- ✅ Clean up `user_teams` memberships
- ✅ Update users with `teamId` set to this team
- ✅ Specific error messages for foreign key violations
- ✅ Return detailed success response with counts

**Before**:
```javascript
try {
  await client.query('DELETE FROM teams WHERE id = $1', [id]);
  return res.json({ message: 'Team deleted', id });
} catch (error) {
  return res.status(500).json({ error: 'Database error' });
}
```

**After**:
```javascript
try {
  // Check for managed teams
  const managedCount = await checkManagedTeams(id);
  if (managedCount > 0) {
    return res.status(400).json({ 
      error: `Cannot delete: ${managedCount} teams managed by members. Reassign first.`
    });
  }
  
  // Clean up memberships
  const deletedMemberships = await cleanupMemberships(id);
  
  // Update user references
  const updatedUsers = await updateUserTeamIds(id);
  
  // Delete team
  await deleteTeam(id);
  
  return res.json({
    message: 'Team deleted successfully',
    deletedMemberships,
    updatedUsers
  });
} catch (error) {
  if (error.code === '23503') {
    return res.status(400).json({
      error: 'Cannot delete due to foreign key constraint',
      detail: error.detail
    });
  }
  return res.status(500).json({ 
    error: 'Failed to delete team', 
    message: error.message 
  });
}
```

### 2. New Remove User from Team Endpoint

**Location**: `production-backend/server.js` - `POST /public-admin/remove-user-from-team`

**Features**:
- ✅ ADMIN role required
- ✅ Validates teamId and userId
- ✅ Detects schema style (camelCase vs snake_case)
- ✅ Removes user_teams membership
- ✅ Returns 404 if user not in team
- ✅ Detailed logging
- ✅ Specific error messages

**Implementation**:
```javascript
app.post('/public-admin/remove-user-from-team', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { teamId, userId } = req.body;
  
  // Validate inputs
  if (!teamId || !userId) {
    return res.status(400).json({ error: 'teamId and userId required' });
  }

  // Detect schema style
  const { userCol, teamCol } = await getUserTeamsColumns(pool);

  // Remove membership
  const result = await pool.query(
    `DELETE FROM user_teams WHERE ${userCol} = $1 AND ${teamCol} = $2`,
    [userId, teamId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'User is not a member of this team' });
  }

  res.json({
    message: 'User removed from team successfully',
    teamId,
    userId
  });
});
```

### 3. Improved Error Messages

**Error Code Handling**:
- `23503` - Foreign key constraint violation → Specific error with details
- `404` - Resource not found → Clear "not found" message
- `400` - Business logic violation → Actionable error message
- `500` - Server error → Error message included

**Example Error Responses**:

```json
// Foreign key violation
{
  "error": "Cannot delete team due to foreign key constraint",
  "detail": "Key (id)=(abc-123) is still referenced from table..."
}

// Business logic violation
{
  "error": "Cannot delete team: 3 other team(s) are managed by members of this team. Please reassign those teams first."
}

// Not found
{
  "error": "User is not a member of this team"
}
```

## 🔍 Technical Details

### Database Schema Support
Both camelCase and snake_case column naming are supported:
- `userId` / `user_id`
- `teamId` / `team_id`

Detection is automatic using the `getUserTeamsColumns()` utility.

### Transaction Safety
Team deletion uses transactions to ensure atomicity:
```javascript
await client.query('BEGIN');
try {
  // Multiple operations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### Foreign Key Checks
Before deletion, the system checks:
1. Teams managed by team members
2. Evaluations related to team members
3. User references to the team

## 🧪 Testing

### Test Team Deletion
```bash
curl -X DELETE https://api.instorm.io/public-admin/teams/{teamId} \
  -H "Authorization: Bearer {token}"
```

**Expected Success Response**:
```json
{
  "message": "Team deleted successfully",
  "id": "team-uuid",
  "deletedMemberships": 5,
  "updatedUsers": 2
}
```

**Expected Error Response** (if team has dependencies):
```json
{
  "error": "Cannot delete team: 2 other team(s) are managed by members of this team. Please reassign those teams first."
}
```

### Test Remove User from Team
```bash
curl -X POST https://api.instorm.io/public-admin/remove-user-from-team \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "team-uuid", "userId": "user-uuid"}'
```

**Expected Success Response**:
```json
{
  "message": "User removed from team successfully",
  "teamId": "team-uuid",
  "userId": "user-uuid"
}
```

## 📊 Impact

### Before Fix:
- ❌ Generic 500 errors
- ❌ No way to remove individual members
- ❌ Unclear why deletions failed
- ❌ No cleanup of related data

### After Fix:
- ✅ Specific error messages
- ✅ Member removal endpoint
- ✅ Clear validation errors
- ✅ Automatic cleanup of related data
- ✅ Transaction safety
- ✅ Detailed logging

## 🚀 Deployment

### Files Modified:
1. `production-backend/server.js`
   - Enhanced `DELETE /public-admin/teams/:id`
   - Added `POST /public-admin/remove-user-from-team`

### Deployment Steps:
1. Back up the current `server.js`
2. Deploy the updated `server.js`
3. Restart the backend service
4. Test team deletion with various scenarios
5. Test member removal
6. Monitor logs for any issues

### Restart Command:
```bash
# If using PM2
pm2 restart sales-scorecard-api

# If using systemd
sudo systemctl restart sales-scorecard-api

# If using Docker
docker restart sales-scorecard-backend
```

## 📋 Admin Panel Integration

The admin panel should now:
1. Call `DELETE /public-admin/teams/:id` to delete teams
2. Call `POST /public-admin/remove-user-from-team` to remove members
3. Display specific error messages from the API
4. Handle 400 errors for business logic violations
5. Handle 404 errors for not found resources

### Example Frontend Code:
```typescript
async deleteTeam(teamId: string) {
  try {
    const response = await fetch(`${API_BASE}/public-admin/teams/${teamId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to delete team: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Delete team error:', error);
    throw error;
  }
}

async removeMemberFromTeam(teamId: string, userId: string) {
  try {
    const response = await fetch(`${API_BASE}/public-admin/remove-user-from-team`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ teamId, userId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to remove member: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Remove member error:', error);
    throw error;
  }
}
```

## 📞 Support

If issues persist:
1. Check backend logs for `[DELETE TEAM]` or `[REMOVE USER FROM TEAM]` entries
2. Verify the user has ADMIN role
3. Check for foreign key constraints in the database
4. Ensure all dependent data is cleaned up or reassigned

## ✅ Status

**All fixes implemented and ready for deployment!**

---
**Fix Applied**: September 30, 2025  
**Status**: ✅ Ready for Production
