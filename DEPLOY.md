# 🚀 Railway Deployment Guide

## Quick Deploy

1. **GitHub'a Push Et**
```bash
git add .
git commit -m "Railway deployment ready"
git push origin main
```

2. **Railway'e Git**
- [railway.app](https://railway.app) → Sign up with GitHub
- "New Project" → "Deploy from GitHub repo" → Bu repo'yu seç

3. **Environment Variables Ayarla**
Railway dashboard'da Variables sekmesinden ekle:

### 🔑 Required Variables
```env
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars

# Upstash Redis (zorunlu)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# API Limits
API_RATE_LIMIT_MAX_REQUESTS=100
API_RATE_LIMIT_WINDOW_MS=60000

# CORS (frontend domain'ini ekle)
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 🛠️ Optional Variables
```env
# Custom Settings
MAX_FILE_SIZE_MB=10
BATCH_PROCESSING_LIMIT=10000
DEFAULT_TIMEOUT_MS=5000

# Monitoring
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

## 📋 Deployment Checklist

- ✅ **Build Config**: `railway.json` added
- ✅ **Health Check**: `/api/health` endpoint
- ✅ **Database**: PostgreSQL with full schema
- ✅ **Cache**: Upstash Redis integration
- ✅ **Security**: Helmet.js production ready
- ✅ **Performance**: Optimized for production

## 🔧 Post-Deploy Steps

1. **Test Health**
```bash
curl https://your-app.railway.app/api/health
```

2. **Test Email Validation**
```bash
curl -X POST https://your-app.railway.app/api/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

3. **Check Logs**
Railway dashboard → Deployments → View Logs

## 🎯 Custom Domain (Optional)

1. Railway dashboard → Settings → Domains
2. Add custom domain
3. Configure DNS records
4. SSL otomatik aktif olur

## 💰 Cost Estimation

- **App Hosting**: $5/ay (512MB RAM, 1GB storage)  
- **PostgreSQL**: $5/ay (1GB storage, 100GB transfer)
- **Expected Usage**: ~50-100 API calls/dakika
- **Redis**: Upstash free tier (10K ops/month)

**Total: ~$10-12/ay**

## 🔍 Monitoring

### Built-in Endpoints
- Health: `/api/health`
- System stats: `/api/analytics/system-stats`
- Debug: `/api/debug/system-health`

### Railway Metrics
- CPU, Memory, Network usage
- Response times
- Error rates
- Deploy frequency

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
```bash
# Check Node.js version
engines: {"node": ">=16.0.0"}
```

2. **Database Errors**
```bash
# SQLite path in production
/tmp/database.sqlite
```

3. **Redis Connection**
```bash
# Verify Upstash credentials
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### Debug Commands
```bash
# Local test with production env
NODE_ENV=production npm start

# Check environment variables
echo $NODE_ENV
```

## 🎉 Success!

Your API will be live at: `https://your-project-name.railway.app`

Test it with your frontend and enjoy! 🚀