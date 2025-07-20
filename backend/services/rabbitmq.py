import os
import pika
from typing import Optional
from utils.logger import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_rabbitmq_connection_params():
    """
    Get RabbitMQ connection parameters based on environment configuration.
    Supports local RabbitMQ, CloudAMQP, and LavinMQ.
    """
    rabbitmq_host = os.getenv("RABBITMQ_HOST", "localhost")
    rabbitmq_port = int(os.getenv("RABBITMQ_PORT", "5672"))
    rabbitmq_user = os.getenv("RABBITMQ_USER", "guest")
    rabbitmq_password = os.getenv("RABBITMQ_PASSWORD", "guest")
    rabbitmq_vhost = os.getenv("RABBITMQ_VHOST", "/")
    
    # Check if we're using a managed service (URL-based connection)
    rabbitmq_url = os.getenv("RABBITMQ_URL")
    
    if rabbitmq_url:
        # Parse URL for CloudAMQP, LavinMQ, or other managed services
        if "cloudamqp.com" in rabbitmq_url:
            logger.info("Using CloudAMQP connection")
        elif "lavinmq.com" in rabbitmq_url:
            logger.info("Using LavinMQ connection")
        else:
            logger.info("Using managed RabbitMQ service")
        return pika.URLParameters(rabbitmq_url)
    else:
        # Use individual parameters
        credentials = pika.PlainCredentials(rabbitmq_user, rabbitmq_password)
        parameters = pika.ConnectionParameters(
            host=rabbitmq_host,
            port=rabbitmq_port,
            virtual_host=rabbitmq_vhost,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300,
        )
        logger.info(f"Using RabbitMQ connection to {rabbitmq_host}:{rabbitmq_port}")
        return parameters

def get_dramatiq_broker_url():
    """
    Get the broker URL for Dramatiq configuration.
    Supports CloudAMQP, LavinMQ, and local RabbitMQ.
    """
    rabbitmq_url = os.getenv("RABBITMQ_URL")
    
    if rabbitmq_url:
        # Managed service URL (CloudAMQP, LavinMQ, etc.)
        return rabbitmq_url
    else:
        # Local RabbitMQ
        rabbitmq_host = os.getenv("RABBITMQ_HOST", "localhost")
        rabbitmq_port = os.getenv("RABBITMQ_PORT", "5672")
        rabbitmq_user = os.getenv("RABBITMQ_USER", "guest")
        rabbitmq_password = os.getenv("RABBITMQ_PASSWORD", "guest")
        rabbitmq_vhost = os.getenv("RABBITMQ_VHOST", "/")
        
        return f"amqp://{rabbitmq_user}:{rabbitmq_password}@{rabbitmq_host}:{rabbitmq_port}/{rabbitmq_vhost}" 