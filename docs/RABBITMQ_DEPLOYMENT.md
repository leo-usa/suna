# RabbitMQ Deployment Guide for Render

This guide covers different options for deploying RabbitMQ on Render to support Suna's background job processing with Dramatiq.

## Overview

Suna uses RabbitMQ as the message broker for Dramatiq, which handles background agent execution. For Render deployment, you have several options:

## Option 1: CloudAMQP (Recommended)

CloudAMQP is a managed RabbitMQ service that's easy to set up and reliable for production.

### Setup Steps:

1. **Create CloudAMQP Account**
   - Go to [CloudAMQP](https://www.cloudamqp.com/)
   - Sign up for a free account (Little Lemur plan)
   - Create a new instance

2. **Get Connection Details**
   - In your CloudAMQP dashboard, find your instance
   - Click on "Details" to get the connection information
   - Copy the AMQP URL

3. **Configure Environment Variables**
   Add to your Render environment variables:
   ```
   RABBITMQ_URL=amqps://username:password@hostname:port/vhost
   ```

4. **Update Your Application**
   The application is already configured to use `RABBITMQ_URL` when available.

### CloudAMQP Plans:
- **Little Lemur (Free)**: 20 connections, 1M messages/month
- **Tiny Turtle ($5/month)**: 100 connections, 10M messages/month
- **Lucky Rabbit ($20/month)**: 500 connections, 50M messages/month

## Option 2: RabbitMQ on Render (Self-hosted)

You can run RabbitMQ as a separate service on Render.

### Setup Steps:

1. **Create a New Web Service on Render**
   - Service Type: Web Service
   - Build Command: `echo "RabbitMQ service"`
   - Start Command: `echo "RabbitMQ service"`

2. **Use RabbitMQ Docker Image**
   Create a `Dockerfile`:
   ```dockerfile
   FROM rabbitmq:3-management
   
   # Enable management plugin
   RUN rabbitmq-plugins enable rabbitmq_management
   
   # Create admin user
   RUN rabbitmqctl add_user admin your_password
   RUN rabbitmqctl set_user_tags admin administrator
   RUN rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
   
   EXPOSE 5672 15672
   ```

3. **Configure Environment Variables**
   ```
   RABBITMQ_HOST=your-rabbitmq-service.onrender.com
   RABBITMQ_PORT=5672
   RABBITMQ_USER=admin
   RABBITMQ_PASSWORD=your_password
   RABBITMQ_VHOST=/
   ```

## Option 3: Alternative Message Brokers

If RabbitMQ is too complex, you can replace it with simpler alternatives:

### Redis as Message Broker
Dramatiq supports Redis as a broker, which you're already using:

```python
from dramatiq.brokers.redis import RedisBroker

# In your run_agent_background.py
redis_broker = RedisBroker(url="redis://localhost:6379/0")
dramatiq.set_broker(redis_broker)
```

### In-Memory Broker (Development Only)
For development/testing:
```python
from dramatiq.brokers.stub import StubBroker

stub_broker = StubBroker()
dramatiq.set_broker(stub_broker)
```

## Configuration Examples

### Local Development (.env)
```bash
# Local RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# Or CloudAMQP
RABBITMQ_URL=amqps://username:password@hostname:port/vhost
```

### Production (Render Environment Variables)
```bash
# CloudAMQP (Recommended)
RABBITMQ_URL=amqps://your-username:your-password@your-instance.cloudamqp.com:5671/your-vhost

# Or Self-hosted RabbitMQ
RABBITMQ_HOST=your-rabbitmq-service.onrender.com
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your-secure-password
RABBITMQ_VHOST=/
```

## Testing Your Setup

Use the test script to verify your RabbitMQ configuration:

```bash
cd backend
python test_rabbitmq.py
```

## Troubleshooting

### Common Issues:

1. **Connection Refused**
   - Check if RabbitMQ service is running
   - Verify host/port configuration
   - Check firewall settings

2. **Authentication Failed**
   - Verify username/password
   - Check vhost permissions
   - Ensure user has proper access

3. **SSL/TLS Issues (CloudAMQP)**
   - Use `amqps://` for SSL connections
   - Verify certificate validity
   - Check port (5671 for SSL, 5672 for non-SSL)

4. **Dramatiq Broker Errors**
   - Check broker URL format
   - Verify RabbitMQ is accessible
   - Check Dramatiq version compatibility

### Debug Commands:

```bash
# Test basic connectivity
telnet your-rabbitmq-host 5672

# Test with curl (if management plugin enabled)
curl -u username:password http://your-rabbitmq-host:15672/api/overview

# Check Dramatiq broker
python -c "from dramatiq.brokers.rabbitmq import RabbitmqBroker; print('OK')"
```

## Security Considerations

1. **Use Strong Passwords**
   - Generate secure passwords for production
   - Use environment variables, never hardcode

2. **Network Security**
   - Use SSL/TLS for production connections
   - Restrict access to RabbitMQ ports
   - Use VPN or private networks when possible

3. **Access Control**
   - Create dedicated users for your application
   - Limit permissions to necessary operations
   - Regularly rotate credentials

## Monitoring

### CloudAMQP Dashboard
- Message rates and queue depths
- Connection counts
- Error rates
- Performance metrics

### Self-hosted Monitoring
- Enable management plugin
- Use Prometheus/Grafana
- Set up alerts for queue depths

## Cost Optimization

1. **CloudAMQP Plans**
   - Start with free plan for development
   - Monitor usage and upgrade as needed
   - Consider annual plans for discounts

2. **Self-hosted**
   - Use Render's free tier for development
   - Monitor resource usage
   - Scale based on actual needs

## Migration Guide

### From Local to CloudAMQP:

1. **Backup Local Data**
   ```bash
   # Export queues and exchanges
   rabbitmqctl export_definitions > backup.json
   ```

2. **Update Configuration**
   - Replace local host/port with CloudAMQP URL
   - Update environment variables
   - Test connectivity

3. **Migrate Data**
   ```bash
   # Import to CloudAMQP
   rabbitmqctl import_definitions backup.json
   ```

### From RabbitMQ to Redis:

1. **Update Broker Configuration**
   ```python
   from dramatiq.brokers.redis import RedisBroker
   redis_broker = RedisBroker(url="redis://localhost:6379/0")
   dramatiq.set_broker(redis_broker)
   ```

2. **Test Thoroughly**
   - Verify all background jobs work
   - Check performance impact
   - Monitor Redis memory usage

## Recommended Setup for Production

1. **Use CloudAMQP** - Most reliable and easiest to manage
2. **Start with Tiny Turtle plan** - Good balance of features and cost
3. **Enable SSL/TLS** - Secure all connections
4. **Set up monitoring** - Monitor queue depths and error rates
5. **Use dedicated credentials** - Separate users for different environments

## Support

- [CloudAMQP Documentation](https://www.cloudamqp.com/docs/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Dramatiq Documentation](https://dramatiq.io/)
- [Render Documentation](https://render.com/docs) 