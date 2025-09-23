# 🚀 Production Deployment Guide - AWS CloudFront

## 📋 Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- jq installed for JSON parsing

## 🚀 Quick Deployment

### 1. First Time Deployment
```bash
./deploy-aws.sh
```

This script will:
- ✅ Build the PWA for production
- ✅ Create S3 bucket for static hosting
- ✅ Configure S3 for website hosting
- ✅ Upload all files to S3
- ✅ Create CloudFront distribution
- ✅ Configure proper caching and error handling
- ✅ Save deployment information

### 2. Update Existing Deployment
```bash
./update-aws.sh
```

This script will:
- ✅ Build the PWA
- ✅ Upload updated files to S3
- ✅ Invalidate CloudFront cache

## 🔧 Manual Deployment Steps

### Step 1: Build the PWA
```bash
npm run build
```

### Step 2: Create S3 Bucket
```bash
BUCKET_NAME="sales-scorecard-pwa-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME --region us-east-1
```

### Step 3: Configure S3 for Static Website
```bash
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html
```

### Step 4: Set Bucket Policy
```bash
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
        }
    ]
}'
```

### Step 5: Upload Files
```bash
aws s3 sync build/ s3://$BUCKET_NAME --delete
```

### Step 6: Create CloudFront Distribution
Use the AWS Console or CLI to create a CloudFront distribution with:
- Origin: S3 bucket website endpoint
- Default root object: index.html
- Error pages: 404 → /index.html (for SPA routing)
- HTTPS redirect: Enabled
- Caching: Optimized for static content

## 🌐 Custom Domain Setup (Optional)

### 1. Request SSL Certificate
```bash
aws acm request-certificate \
    --domain-name your-domain.com \
    --subject-alternative-names www.your-domain.com \
    --validation-method DNS \
    --region us-east-1
```

### 2. Update CloudFront Distribution
- Add custom domain to CloudFront distribution
- Configure SSL certificate
- Update DNS records to point to CloudFront

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy PWA to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: ./update-aws.sh
```

## 📊 Monitoring & Analytics

### CloudWatch Metrics
- Monitor CloudFront distribution metrics
- Set up alarms for error rates
- Track cache hit ratios

### Performance Monitoring
- Use Web Vitals for performance tracking
- Monitor Core Web Vitals scores
- Set up real user monitoring (RUM)

## 🔒 Security Considerations

### S3 Bucket Security
- Enable versioning for backup
- Configure lifecycle policies
- Use bucket encryption

### CloudFront Security
- Enable AWS WAF for protection
- Configure security headers
- Use signed URLs for sensitive content

### CORS Configuration
If your API is on a different domain, configure CORS:
```json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
            "AllowedOrigins": ["https://your-pwa-domain.com"],
            "MaxAgeSeconds": 3000
        }
    ]
}
```

## 🚨 Troubleshooting

### Common Issues

1. **404 Errors on Refresh**
   - Ensure CloudFront error pages are configured
   - Check S3 website hosting configuration

2. **CORS Errors**
   - Verify API CORS configuration
   - Check CloudFront headers

3. **Cache Issues**
   - Invalidate CloudFront cache
   - Check cache headers in S3

4. **SSL Certificate Issues**
   - Verify certificate is in us-east-1 region
   - Check domain validation status

### Useful Commands

```bash
# Check distribution status
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID

# Invalidate cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

# Check S3 bucket contents
aws s3 ls s3://YOUR_BUCKET_NAME --recursive

# Test website endpoint
curl -I https://YOUR_DISTRIBUTION_ID.cloudfront.net
```

## 📈 Performance Optimization

### CloudFront Optimizations
- Enable compression
- Configure cache behaviors
- Use origin request policies
- Set up cache policies

### PWA Optimizations
- Enable service worker caching
- Optimize images and assets
- Use lazy loading
- Implement code splitting

## 💰 Cost Optimization

### S3 Costs
- Use S3 Intelligent Tiering
- Configure lifecycle policies
- Monitor storage usage

### CloudFront Costs
- Choose appropriate price class
- Monitor data transfer
- Optimize cache hit ratios

## 📞 Support

For issues or questions:
1. Check AWS CloudWatch logs
2. Review CloudFront access logs
3. Test with curl or browser dev tools
4. Check AWS service health dashboard
