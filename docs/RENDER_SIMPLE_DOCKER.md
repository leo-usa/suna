# Simple Render Deployment with Existing Dockerfiles

This guide shows how to deploy Suna on Render using the existing Dockerfiles in your project.

## 🐳 **Understanding Your Current Setup**

Your Suna project already has:
- ✅ `backend/Dockerfile` - Backend container
- ✅ `frontend/Dockerfile` - Frontend container  
- ✅ `docker-compose.yaml` - Local development setup

## 🚀 **Deploy to Render (3 Services)**

### **Service 1: Backend API**

1. **Go to Render Dashboard**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure:**

```
Name: suna-backend
Environment: Docker
Region: Choose closest to you
Branch: main

Build Command: (leave empty - Docker handles this)
Start Command: (leave empty - Dockerfile handles this)
```

5. **Add Environment Variables:**
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Upstash)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_SSL=true

# RabbitMQ (LavinMQ)
RABBITMQ_URL=amqps://your-lavinmq-url

# LLM Providers
ANTHROPIC_API_KEY=your-anthropic-key
MODEL_TO_USE=anthropic/claude-sonnet-4-5

# Other APIs
TAVILY_API_KEY=your-tavily-key
FIRECRAWL_API_KEY=your-firecrawl-key
DAYTONA_API_KEY=your-daytona-key
QSTASH_TOKEN=your-qstash-token

# URLs
FRONTEND_URL=https://your-frontend.onrender.com
BACKEND_URL=https://your-backend.onrender.com
```

6. **Click "Create Web Service"**

### **Service 2: Frontend**

1. **Click "New +" → "Web Service"**
2. **Connect same repository**
3. **Configure:**

```
Name: suna-frontend
Environment: Docker
Region: Same as backend
Branch: main

Build Command: (leave empty)
Start Command: (leave empty)
```

4. **Add Environment Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com/api
NEXT_PUBLIC_URL=https://your-frontend.onrender.com
NEXT_PUBLIC_ENV_MODE=PRODUCTION
```

5. **Click "Create Web Service"**

### **Service 3: Background Worker**

1. **Click "New +" → "Background Worker"**
2. **Connect same repository**
3. **Configure:**

```
Name: suna-worker
Environment: Docker
Region: Same as others
Branch: main

Build Command: (leave empty)
Start Command: uv run dramatiq --processes 4 --threads 4 run_agent_background
```

4. **Add same environment variables as backend**
5. **Click "Create Background Worker"**

## 🔧 **What Each Service Does**

### **Backend Service:**
- ✅ Handles API requests
- ✅ Manages threads and agents
- ✅ Connects to database and external APIs
- ✅ Runs on port 8000

### **Frontend Service:**
- ✅ Serves the web interface
- ✅ Handles user interactions
- ✅ Communicates with backend API
- ✅ Runs on port 3000

### **Worker Service:**
- ✅ Processes background tasks
- ✅ Runs agent operations
- ✅ Handles file processing
- ✅ No web interface (background only)

## 🌐 **Service Communication**

```
User → Frontend → Backend → Database/APIs
                ↓
            Worker (background tasks)
```

## ⚙️ **Environment Variables Explained**

### **Required for Backend:**
- **Database**: Supabase connection
- **Redis**: Session storage and caching
- **RabbitMQ**: Message queue for background jobs
- **LLM**: AI model access
- **APIs**: External service access

### **Required for Frontend:**
- **Supabase**: Authentication and database
- **Backend URL**: Where to send API requests

### **Required for Worker:**
- **Same as backend** (needs all the same APIs)

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **Build Fails:**
   - Check Dockerfile syntax
   - Verify all dependencies are in package files
   - Check build logs in Render

2. **Services Can't Connect:**
   - Verify environment variables
   - Check service URLs are correct
   - Ensure all services are running

3. **Background Jobs Not Working:**
   - Check worker service logs
   - Verify RabbitMQ connection
   - Check Dramatiq configuration

### **Debug Commands:**

```bash
# Check service logs in Render dashboard
# Look for error messages
# Verify environment variables are set
```

## 💰 **Cost Optimization**

### **Free Tier:**
- ✅ Start with free tier for all services
- ✅ Test functionality
- ✅ Upgrade if needed

### **Paid Tier ($7/month each):**
- ✅ Better performance
- ✅ No sleep mode
- ✅ More resources

## 🎯 **Recommended Approach**

1. **Start with free tier** for all 3 services
2. **Test basic functionality**
3. **Upgrade worker to paid** if background jobs are slow
4. **Upgrade backend to paid** if API is slow
5. **Keep frontend on free** unless you have high traffic

## ✅ **Deployment Checklist**

- [ ] **Backend service** created and running
- [ ] **Frontend service** created and running  
- [ ] **Worker service** created and running
- [ ] **Environment variables** configured
- [ ] **Database** (Supabase) configured
- [ ] **Redis** (Upstash) configured
- [ ] **RabbitMQ** (LavinMQ) configured
- [ ] **API keys** configured
- [ ] **Services can communicate** with each other

Your Suna instance is now ready to run on Render! 🎉 