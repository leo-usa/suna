#!/usr/bin/env python3
"""
Test script to verify CloudAMQP connectivity.
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

def test_managed_rabbitmq_connection():
    """Test managed RabbitMQ connection (CloudAMQP, LavinMQ, etc.)."""
    try:
        from services.rabbitmq import get_rabbitmq_connection_params
        import pika
        
        # Get connection parameters
        parameters = get_rabbitmq_connection_params()
        
        # Determine service type from URL
        rabbitmq_url = os.getenv("RABBITMQ_URL", "")
        if "cloudamqp.com" in rabbitmq_url:
            print("🔍 Testing CloudAMQP connection...")
            service_name = "CloudAMQP"
        elif "lavinmq.com" in rabbitmq_url:
            print("🔍 Testing LavinMQ connection...")
            service_name = "LavinMQ"
        else:
            print("🔍 Testing managed RabbitMQ connection...")
            service_name = "Managed RabbitMQ"
        
        # Try to connect
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Test basic operations
        test_queue = f"test_{service_name.lower()}_queue"
        channel.queue_declare(queue=test_queue, durable=True)
        channel.basic_publish(exchange='', routing_key=test_queue, body='test message')
        
        # Clean up
        channel.queue_delete(queue=test_queue)
        connection.close()
        
        print(f"✅ {service_name} connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ Managed RabbitMQ connection failed: {e}")
        return False

def test_dramatiq_with_managed_service():
    """Test Dramatiq with managed RabbitMQ service."""
    try:
        from services.rabbitmq import get_dramatiq_broker_url
        from dramatiq.brokers.rabbitmq import RabbitmqBroker
        import dramatiq
        
        # Get broker URL
        broker_url = get_dramatiq_broker_url()
        print(f"📡 Broker URL: {broker_url}")
        
        # Determine service type from URL
        if "cloudamqp.com" in broker_url:
            print("🔍 Testing Dramatiq with CloudAMQP...")
            service_name = "CloudAMQP"
        elif "lavinmq.com" in broker_url:
            print("🔍 Testing Dramatiq with LavinMQ...")
            service_name = "LavinMQ"
        else:
            print("🔍 Testing Dramatiq with managed RabbitMQ...")
            service_name = "Managed RabbitMQ"
        
        # Create broker
        broker = RabbitmqBroker(url=broker_url)
        
        # Set the broker
        dramatiq.set_broker(broker)
        
        # Test broker connection by creating a simple actor
        @dramatiq.actor
        def test_actor():
            return f"test from {service_name.lower()}"
        
        print(f"✅ Dramatiq with {service_name} successful!")
        return True
        
    except Exception as e:
        print(f"❌ Dramatiq with managed service failed: {e}")
        return False

def main():
    """Run all tests."""
    print("☁️ Managed RabbitMQ Connectivity Test")
    print("=" * 40)
    
    # Check environment variables
    print("📋 Environment Variables:")
    rabbitmq_url = os.getenv("RABBITMQ_URL")
    if rabbitmq_url:
        # Determine service type
        if "cloudamqp.com" in rabbitmq_url:
            service_name = "CloudAMQP"
        elif "lavinmq.com" in rabbitmq_url:
            service_name = "LavinMQ"
        else:
            service_name = "Managed RabbitMQ"
        
        print(f"  Service: {service_name}")
        
        # Mask the password in the URL
        if "://" in rabbitmq_url:
            parts = rabbitmq_url.split("://")
            if "@" in parts[1]:
                user_pass, rest = parts[1].split("@", 1)
                if ":" in user_pass:
                    user, password = user_pass.split(":", 1)
                    masked_url = f"{parts[0]}://{user}:{'*' * len(password)}@{rest}"
                    print(f"  RABBITMQ_URL: {masked_url}")
                else:
                    print(f"  RABBITMQ_URL: {parts[0]}://***@{rest}")
            else:
                print(f"  RABBITMQ_URL: {rabbitmq_url}")
        else:
            print(f"  RABBITMQ_URL: {rabbitmq_url}")
    else:
        print("  RABBITMQ_URL: (not set)")
        print("  RABBITMQ_HOST:", os.getenv("RABBITMQ_HOST", "(not set)"))
        print("  RABBITMQ_PORT:", os.getenv("RABBITMQ_PORT", "(not set)"))
    
    print()
    
    # Run tests
    managed_ok = test_managed_rabbitmq_connection()
    print()
    
    dramatiq_ok = test_dramatiq_with_managed_service()
    print()
    
    # Summary
    print("📊 Test Summary:")
    print(f"  Managed RabbitMQ Connection: {'✅ PASS' if managed_ok else '❌ FAIL'}")
    print(f"  Dramatiq with Managed Service: {'✅ PASS' if dramatiq_ok else '❌ FAIL'}")
    
    if managed_ok and dramatiq_ok:
        print("\n🎉 All tests passed! Your managed RabbitMQ service is ready for use.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check your RabbitMQ configuration.")
        return 1

if __name__ == "__main__":
    exit(main()) 