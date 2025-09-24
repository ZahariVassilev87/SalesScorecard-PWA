# 🌐 Custom Domain Setup Guide

This guide will help you set up the custom domain `scorecard.instorm.io` for your Sales Scorecard PWA.

## 📋 Prerequisites

- AWS CLI configured with appropriate permissions
- Domain `instorm.io` registered and managed through Route 53 (or accessible for DNS management)
- Existing CloudFront distribution (from previous deployment)

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)

Run the automated script to set up everything:

```bash
./update-domain.sh
```

This script will:
- ✅ Request SSL certificate for `scorecard.instorm.io`
- ✅ Create DNS validation records
- ✅ Update CloudFront distribution with custom domain
- ✅ Create CNAME record pointing to CloudFront
- ✅ Update deployment configuration

### Option 2: Manual Setup

If you prefer to set up manually or need to troubleshoot:

#### Step 1: Request SSL Certificate

```bash
aws acm request-certificate \
    --domain-name scorecard.instorm.io \
    --subject-alternative-names "www.scorecard.instorm.io" \
    --validation-method DNS \
    --region us-east-1
```

#### Step 2: Validate Certificate

1. Get validation records:
```bash
aws acm describe-certificate \
    --certificate-arn YOUR_CERTIFICATE_ARN \
    --region us-east-1
```

2. Create DNS validation record in Route 53:
```bash
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \
    --change-batch file://validation-record.json
```

#### Step 3: Update CloudFront Distribution

```bash
aws cloudfront update-distribution \
    --id YOUR_DISTRIBUTION_ID \
    --distribution-config file://updated-config.json \
    --if-match YOUR_ETAG
```

#### Step 4: Create CNAME Record

```bash
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \
    --change-batch file://cname-record.json
```

## 🔧 Configuration Files

### CloudFront Distribution Update

The distribution configuration needs these updates:

```json
{
    "Aliases": {
        "Quantity": 1,
        "Items": ["scorecard.instorm.io"]
    },
    "ViewerCertificate": {
        "ACMCertificateArn": "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID",
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021"
    }
}
```

### DNS Records

#### Certificate Validation Record
```json
{
    "Name": "_validation-domain.acm-validations.aws.",
    "Type": "CNAME",
    "TTL": 300,
    "ResourceRecords": [
        {
            "Value": "validation-value.acm-validations.aws."
        }
    ]
}
```

#### CNAME Record for Subdomain
```json
{
    "Name": "scorecard.instorm.io",
    "Type": "CNAME",
    "TTL": 300,
    "ResourceRecords": [
        {
            "Value": "d2tuhgmig1r5ut.cloudfront.net"
        }
    ]
}
```

## 📊 Required AWS Permissions

Your AWS user/role needs these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "acm:RequestCertificate",
                "acm:DescribeCertificate",
                "acm:ListCertificates"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:GetDistribution",
                "cloudfront:GetDistributionConfig",
                "cloudfront:UpdateDistribution"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:ListHostedZones",
                "route53:GetHostedZone",
                "route53:ChangeResourceRecordSets"
            ],
            "Resource": "*"
        }
    ]
}
```

## 🧪 Testing the Setup

### 1. Check Certificate Status
```bash
aws acm describe-certificate \
    --certificate-arn YOUR_CERTIFICATE_ARN \
    --region us-east-1 \
    --query 'Certificate.Status'
```

### 2. Check CloudFront Distribution
```bash
aws cloudfront get-distribution \
    --id YOUR_DISTRIBUTION_ID \
    --query 'Distribution.Status'
```

### 3. Test DNS Resolution
```bash
nslookup scorecard.instorm.io
dig scorecard.instorm.io
```

### 4. Test HTTPS Access
```bash
curl -I https://scorecard.instorm.io
```

## ⏱️ Timeline

- **Certificate Validation**: 5-10 minutes
- **CloudFront Deployment**: 10-15 minutes
- **DNS Propagation**: 5-60 minutes (usually within 5-10 minutes)

## 🔍 Troubleshooting

### Certificate Issues

**Problem**: Certificate validation fails
**Solution**: 
- Check DNS validation record is created correctly
- Ensure the record has propagated (use `dig` to verify)
- Wait up to 30 minutes for validation

### CloudFront Issues

**Problem**: Distribution update fails
**Solution**:
- Check if distribution is in "Deployed" state
- Verify certificate is in "Issued" state
- Ensure you're using the correct ETag

### DNS Issues

**Problem**: Domain doesn't resolve
**Solution**:
- Check CNAME record is created correctly
- Verify hosted zone ID is correct
- Wait for DNS propagation

### SSL Issues

**Problem**: HTTPS doesn't work
**Solution**:
- Ensure certificate is in us-east-1 region
- Check CloudFront distribution is using the correct certificate
- Verify SSL support method is "sni-only"

## 📱 PWA Configuration Updates

After setting up the custom domain, update your PWA configuration:

### 1. Update API Base URL

In `src/services/api.ts`:
```typescript
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.instorm.io';
```

### 2. Update CORS Settings

In your backend API, add the new domain to CORS origins:
```typescript
app.enableCors({
  origin: [
    'https://scorecard.instorm.io',
    'https://api.instorm.io'
  ],
  credentials: true,
});
```

### 3. Update PWA Manifest

In `public/manifest.json`:
```json
{
  "start_url": "https://scorecard.instorm.io/",
  "scope": "https://scorecard.instorm.io/"
}
```

## 🎯 Final Steps

1. **Test the domain**: Visit `https://scorecard.instorm.io`
2. **Update bookmarks**: Update any existing bookmarks
3. **Update documentation**: Update any documentation with the new URL
4. **Monitor**: Set up monitoring for the new domain
5. **Backup**: Keep the CloudFront domain as a backup

## 📞 Support

If you encounter issues:

1. Check AWS CloudWatch logs
2. Verify all DNS records are correct
3. Ensure certificate is properly validated
4. Check CloudFront distribution status

## 🔗 Useful Commands

```bash
# Check deployment status
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID

# Invalidate cache after updates
aws cloudfront create-invalidation \
    --distribution-id YOUR_DISTRIBUTION_ID \
    --paths "/*"

# Check certificate status
aws acm describe-certificate \
    --certificate-arn YOUR_CERTIFICATE_ARN \
    --region us-east-1

# List hosted zones
aws route53 list-hosted-zones
```

---

**🎉 Once complete, your PWA will be available at: https://scorecard.instorm.io**
