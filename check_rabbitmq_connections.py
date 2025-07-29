#!/usr/bin/env python3
"""
Script to check current RabbitMQ connections
"""

import os
import requests
import base64

def get_management_url():
    """Get the management API URL from RabbitMQ URL"""
    rabbitmq_url = os.getenv('RABBITMQ_URL')
    if not rabbitmq_url:
        print("❌ RABBITMQ_URL not found in environment")
        return None, None, None
    
    # Parse the URL: amqps://username:password@hostname:port/vhost
    if rabbitmq_url.startswith('amqps://'):
        url_parts = rabbitmq_url.replace('amqps://', '').split('@')
        if len(url_parts) != 2:
            print("❌ Invalid RABBITMQ_URL format")
            return None, None, None
        
        credentials_part = url_parts[0]
        host_part = url_parts[1]
        
        username, password = credentials_part.split(':')
        host_port_vhost = host_part.split('/')
        host_port = host_port_vhost[0]
        vhost = host_port_vhost[1] if len(host_port_vhost) > 1 else '/'
        
        host, port = host_port.split(':') if ':' in host_port else (host_port, '5671')
        
        # CloudAMQP management API uses the same host but different path
        management_url = f"https://{host}/api"
        
        return management_url, username, password
    
    return None, None, None

def check_rabbitmq_connections():
    """Check current RabbitMQ connections"""
    try:
        management_url, username, password = get_management_url()
        if not management_url:
            return False
        
        print(f"🔗 Connecting to RabbitMQ Management API...")
        
        # Create basic auth header
        credentials = f"{username}:{password}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        headers = {
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/json'
        }
        
        # Get current connections
        print("📊 Getting current connections...")
        response = requests.get(f"{management_url}/connections", headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Failed to get connections: {response.status_code}")
            return False
        
        connections = response.json()
        print(f"📈 Found {len(connections)} active connections")
        
        # Show details of each connection
        for i, connection in enumerate(connections, 1):
            name = connection.get('name', 'unknown')
            client_properties = connection.get('client_properties', {})
            product = client_properties.get('product', 'unknown')
            version = client_properties.get('version', 'unknown')
            peer_host = connection.get('peer_host', 'unknown')
            peer_port = connection.get('peer_port', 'unknown')
            
            print(f"  {i}. {name}")
            print(f"     Product: {product} {version}")
            print(f"     Peer: {peer_host}:{peer_port}")
            print(f"     State: {connection.get('state', 'unknown')}")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error accessing management API: {e}")
        return False

def main():
    print("🔍 Checking current RabbitMQ connections...\n")
    check_rabbitmq_connections()

if __name__ == "__main__":
    main() 