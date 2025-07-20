# Render Docker Deployment Guide for Suna

This guide covers deploying Suna on Render using Docker containers.

## 🐳 **Docker Deployment Options**

### **Option 1: Single Dockerfile (Recommended)**

Deploy everything in one service using the unified Dockerfile.

### **Option 2: Separate Services**

Deploy frontend, backend, and worker as separate services.

## 🚀 **Option 1: Single Dockerfile Deployment**

### **Step 1: Prepare Your Repository**

Ensure your repository has:
- ✅ `Dockerfile` (unified build)
- ✅ `docker-compose.render.yml` (for reference)
- ✅ All environment variables configured

### **Step 2: Create Web Service on Render**

1. **Go to Render Dashboard**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

#### **Basic Settings:**
- **Name**: `suna-app`
- **Environment**: `Docker`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your deployment branch)

#### **Build Settings:**
- **Build Command**: Leave empty (Docker handles this)
- **Start Command**: Leave empty (Dockerfile CMD handles this)

#### **Environment Variables:**
Add all required environment variables:

```bash
# Redis Configuration
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_SSL=true

# RabbitMQ Configuration
RABBITMQ_URL=amqps://your-lavinmq-url

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Configuration
JWT_SECRET=your-jwt-secret

# URLs
FRONTEND_URL=https://your-app.onrender.com
BACKEND_URL=https://your-app.onrender.com

# Feature Flags (optional)
CUSTOM_AGENTS_ENABLED=true
KNOWLEDGE_BASE_ENABLED=true
AGENT_TRIGGERS_ENABLED=true
```

### **Step 3: Configure Health Check**

Add a health check endpoint to your backend:

```python
# In backend/api.py
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
```

### **Step 4: Deploy**

1. **Click "Create Web Service"**
2. **Wait for build to complete**
3. **Check logs for any issues**

## 🔄 **Option 2: Separate Services Deployment**

### **Service 1: Frontend Web Service**

1. **Create Web Service**
2. **Environment**: `Docker`
3. **Dockerfile**: Use `frontend/Dockerfile`
4. **Port**: `3000`

### **Service 2: Backend Web Service**

1. **Create Web Service**
2. **Environment**: `Docker`
3. **Dockerfile**: Use `backend/Dockerfile`
4. **Port**: `8000`

### **Service 3: Background Worker**

1. **Create Background Worker**
2. **Environment**: `Docker`
3. **Dockerfile**: Use `backend/Dockerfile`
4. **Command**: `uv run dramatiq --processes 4 --threads 2 run_agent_background`

## ⚙️ **Docker Configuration Details**

### **Unified Dockerfile Features:**

- **Multi-stage build** for optimized image size
- **Frontend**: Next.js standalone build
- **Backend**: Python with uv package manager
- **Both services** run in single container
- **Health checks** for monitoring

### **Port Configuration:**

- **Frontend**: Port 3000
- **Backend**: Port 8000
- **Render automatically** maps external port

### **Environment Variables:**

The Dockerfile automatically handles:
- ✅ **Node.js environment** setup
- ✅ **Python environment** setup
- ✅ **Service communication** between frontend/backend
- ✅ **Health monitoring**

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **Build Failures:**
```bash
# Check build logs
# Ensure all dependencies are in package.json/pyproject.toml
# Verify Dockerfile syntax
```

#### **Runtime Issues:**
```bash
# Check service logs
# Verify environment variables
# Test health endpoints
```

#### **Performance Issues:**
```bash
# Monitor resource usage
# Consider upgrading plan
# Optimize Dockerfile layers
```

### **Debug Commands:**

```bash
# Test locally
docker build -t suna .
docker run -p 3000:3000 -p 8000:8000 suna

# Check container logs
docker logs <container-id>

# Enter container
docker exec -it <container-id> /bin/bash
```

## 💰 **Cost Optimization**

### **Free Tier:**
- ✅ **Single Dockerfile** approach
- ✅ **Combined frontend/backend**
- ✅ **Background worker** as separate service

### **Paid Tier ($7/month):**
- ✅ **Better performance**
- ✅ **No sleep mode**
- ✅ **More resources**

## 🎯 **Recommended Approach**

### **For Production:**
1. **Start with Option 1** (Single Dockerfile)
2. **Monitor performance**
3. **Upgrade to paid plan** if needed
4. **Consider Option 2** for high traffic

### **For Development:**
1. **Use Option 1** for simplicity
2. **Test locally** with docker-compose
3. **Deploy to Render** for testing

## 🚀 **Deployment Checklist**

- [ ] **Repository connected** to Render
- [ ] **Dockerfile** in root directory
- [ ] **Environment variables** configured
- [ ] **Health check endpoint** added
- [ ] **Database services** (Supabase) configured
- [ ] **Redis service** (Upstash) configured
- [ ] **RabbitMQ service** (LavinMQ) configured
- [ ] **Feature flags** enabled
- [ ] **Domain/SSL** configured (optional)

## 📊 **Monitoring**

### **Health Checks:**
- **Frontend**: `https://your-app.onrender.com`
- **Backend**: `https://your-app.onrender.com/health`
- **Worker**: Monitor logs for Dramatiq processes

### **Logs:**
- **Build logs**: Check during deployment
- **Runtime logs**: Monitor for errors
- **Application logs**: Check for business logic issues

Your Suna instance is now ready for Docker deployment on Render! 🎉 