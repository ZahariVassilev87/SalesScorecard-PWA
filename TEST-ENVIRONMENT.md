# 🧪 Test Environment Setup

## Overview
This document describes how to use the test environment for the Sales Scorecard PWA before deploying to production.

## Test Environment URLs

### Current Test Environment
- **URL**: https://d2tuhgmig1r5ut.cloudfront.net
- **Status**: Active (same as production for now)
- **Purpose**: Test new features before production deployment

## Deployment Scripts

### 1. Test Environment Deployment
```bash
# Deploy to test environment
./deploy-test.sh

# Update test environment
./update-test.sh
```

### 2. Production Environment Deployment
```bash
# Deploy to production environment
./deploy-aws.sh

# Update production environment
./update-aws.sh
```

## Testing Workflow

### Step 1: Local Development
```bash
# Start local development server
npm start

# Test on localhost:3000
```

### Step 2: Test Environment
```bash
# Deploy to test environment
./update-test.sh

# Test on test URL
# Wait 5-10 minutes for cache invalidation
```

### Step 3: Production Deployment
```bash
# Deploy to production
./update-aws.sh

# Test on production URL
```

## Current Features to Test

### ✅ Completed Features
- [x] Bilingual support (EN/BG)
- [x] Language Switcher
- [x] Dashboard translations
- [x] EvaluationForm translations
- [x] Navigation translations
- [x] "New Evaluation" → "Ново измерване на поведението"
- [x] "Analytics" → "Анализ на представянето"

### 🔄 In Progress
- [ ] EvaluationHistory translations
- [ ] MyTeam translations
- [ ] TeamManagementView translations
- [ ] AnalyticsView translations

## Testing Checklist

### Language Switching
- [ ] Login form language switcher works
- [ ] App header language switcher works
- [ ] All text changes language correctly
- [ ] "Sales Scorecard" remains untranslated
- [ ] "Performance Evaluation System" remains untranslated

### Component Testing
- [ ] Dashboard displays correctly in both languages
- [ ] EvaluationForm displays correctly in both languages
- [ ] Navigation tabs are translated
- [ ] All buttons and labels are translated
- [ ] Error messages are translated
- [ ] Success messages are translated

### Functionality Testing
- [ ] Login works in both languages
- [ ] Evaluation creation works in both languages
- [ ] Navigation works in both languages
- [ ] All forms submit correctly
- [ ] All data displays correctly

## Environment Management

### Test Environment
- **Purpose**: Test new features and translations
- **URL**: https://d2tuhgmig1r5ut.cloudfront.net
- **Deployment**: `./update-test.sh`
- **Cache**: 5-10 minutes invalidation time

### Production Environment
- **Purpose**: Live application for users
- **URL**: https://d2tuhgmig1r5ut.cloudfront.net (same for now)
- **Deployment**: `./update-aws.sh`
- **Cache**: 5-10 minutes invalidation time

## Notes

### Current Status
- Test and production environments are currently the same
- Both use the same CloudFront distribution
- This allows for easy testing before creating separate environments

### Future Improvements
- Create separate test bucket and CloudFront distribution
- Use different domain for test environment
- Implement automated testing pipeline
- Add staging environment between test and production

## Troubleshooting

### Cache Issues
```bash
# Force cache invalidation
aws cloudfront create-invalidation --distribution-id E1KXF36IV5EKY3 --paths "/*"
```

### Build Issues
```bash
# Clean build
rm -rf build/
npm run build
```

### Deployment Issues
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check S3 bucket
aws s3 ls s3://sales-scorecard-pwa-1758666607
```

## Contact
For issues with the test environment, contact the development team.
