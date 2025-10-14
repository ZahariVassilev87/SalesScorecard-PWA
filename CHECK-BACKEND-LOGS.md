# 🔍 Backend Logs Debugging Guide

## ✅ Deployment Complete

The backend has been redeployed with enhanced error logging for all delete and assign operations.

## 📋 Check Backend Logs

### View Real-Time Logs
```bash
aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1
```

### View Recent Logs (Last 30 minutes)
```bash
aws logs tail /ecs/sales-scorecard-task --since 30m --region eu-north-1
```

### Filter for Specific Operations

**Delete Team Operations:**
```bash
aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1 --filter-pattern "DELETE TEAM"
```

**Assign User Operations:**
```bash
aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1 --filter-pattern "ASSIGN USER"
```

**Remove User Operations:**
```bash
aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1 --filter-pattern "REMOVE USER"
```

**Errors Only:**
```bash
aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1 --filter-pattern "Error"
```

## 🔍 What to Look For

When you try to delete a team or assign/remove a user, look for these log entries:

### Delete Team
```
[DELETE TEAM] Deleting team: Team Name (ID: xyz)
[DELETE TEAM] Warning: Team has N related evaluations
[DELETE TEAM] Deleted N team memberships
[DELETE TEAM] Updated N users with this teamId
[DELETE TEAM] Team deleted successfully
```

### Assign User to Team
```
[ASSIGN USER TO TEAM] Request body: {...}
[ASSIGN USER TO TEAM] Team ID: xyz
[ASSIGN USER TO TEAM] User IDs: [abc]
[ASSIGN USER TO TEAM] Using columns: {...}
[ASSIGN USER TO TEAM] Inserting membership: {...}
[ASSIGN USER TO TEAM] Successfully assigned users to team
```

### Common Errors

**Foreign Key Constraint:**
```
Error code: 23503
Error: Foreign key constraint violation
```

**Duplicate Entry:**
```
Error code: 23505
Error: User is already a member of this team
```

**Team Not Found:**
```
[ASSIGN USER TO TEAM] Team not found: xyz
```

**Missing Users:**
```
[ASSIGN USER TO TEAM] Missing users: [abc, def]
```

## 🧪 Test Steps

1. **Open terminal and start watching logs:**
   ```bash
   aws logs tail /ecs/sales-scorecard-task --follow --region eu-north-1
   ```

2. **In admin panel, try to:**
   - Delete a team
   - Assign a user to a team
   - Remove a user from a team

3. **Watch the terminal** - You'll see detailed logs about what's happening

4. **If you see an error**, the log will show:
   - Error code (e.g., 23503, 23505)
   - Error message
   - Error detail
   - Full stack trace

## 📊 Quick Diagnosis

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 23503 | Foreign key constraint | Related data exists, need to clean up first |
| 23505 | Duplicate entry | User already in team |
| 23514 | Check constraint | Invalid data value |
| 404 | Not found | Team or user doesn't exist |
| 400 | Bad request | Invalid input data |

## 🔧 Current Enhancements

The backend now has:
- ✅ Detailed logging for every operation
- ✅ Specific error messages with error codes
- ✅ Foreign key constraint handling
- ✅ Duplicate entry detection
- ✅ Missing data validation
- ✅ Full stack traces for debugging

## 🚀 Next Steps

1. Try the operation that was failing
2. Check the logs to see the specific error
3. The error message should now be clear and actionable
4. If you still see "Database error", check the logs for the detailed error

## 📞 Common Issues & Solutions

### "Failed to assign user to team: 500"
**Check logs for:**
- `[ASSIGN USER TO TEAM] Error code:` - Will show the specific database error
- Look for missing users, duplicate entries, or foreign key issues

### "Failed to delete team: 500"
**Check logs for:**
- `[DELETE TEAM] Error:` - Will show what prevented deletion
- Check if team members manage other teams
- Check for foreign key constraints

### "Team not found"
**This means:**
- The team ID doesn't exist in the database
- Check if the team was already deleted
- Verify the admin panel is sending the correct team ID

---

**Deployed:** September 30, 2025  
**Status:** ✅ Enhanced Logging Active


