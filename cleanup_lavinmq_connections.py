#!/usr/bin/env python3
"""
Script to clean up LavinMQ connections using the management API.
This helps when you hit connection limits on the free plan.
"""

import os
import requests
import json
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv("backend/.env")

def get_lavinmq_management_url():
    """Extract management URL from RABBITMQ_URL."""
    rabbitmq_url = os.getenv("RABBITMQ_URL")
    if not rabbitmq_url:
        print("❌ RABBITMQ_URL not found in environment variables")
        return None
    
    # Parse the AMQP URL to get management URL
    parsed = urlparse(rabbitmq_url)
    
    # Extract credentials
    username = parsed.username
    password = parsed.password
    
    # For LavinMQ, the management URL is typically different
    # Try different possible management URLs
    host = parsed.hostname
    
    # LavinMQ management URLs
    possible_urls = [
        f"https://{host}:15672",  # Standard RabbitMQ management port
        f"https://{host}:443",    # HTTPS on standard port
        f"https://{host}",        # HTTPS without port
        f"http://{host}:15672",   # HTTP management port
    ]
    
    print(f"🔍 Trying to find LavinMQ management URL...")
    
    for management_url in possible_urls:
        print(f"  Testing: {management_url}")
        try:
            response = requests.get(
                f"{management_url}/api/overview",
                auth=(username, password),
                timeout=5
            )
            if response.status_code == 200:
                print(f"✅ Found working management URL: {management_url}")
                return {
                    'url': management_url,
                    'username': username,
                    'password': password
                }
        except requests.exceptions.RequestException:
            continue
    
    print("❌ Could not find working management URL")
    print("💡 Try accessing your LavinMQ dashboard directly to manage connections")
    return None

def list_connections(management_info):
    """List all active connections."""
    url = f"{management_info['url']}/api/connections"
    
    try:
        response = requests.get(
            url,
            auth=(management_info['username'], management_info['password']),
            timeout=10
        )
        response.raise_for_status()
        
        connections = response.json()
        print(f"📊 Found {len(connections)} active connections:")
        
        for conn in connections:
            print(f"  - ID: {conn.get('name', 'Unknown')}")
            print(f"    Client: {conn.get('client_properties', {}).get('connection_name', 'Unknown')}")
            print(f"    IP: {conn.get('host', 'Unknown')}")
            print(f"    Connected: {conn.get('connected_at', 'Unknown')}")
            print(f"    Channels: {conn.get('channels', 0)}")
            print()
        
        return connections
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to list connections: {e}")
        return []

def close_connection(management_info, connection_name):
    """Close a specific connection."""
    url = f"{management_info['url']}/api/connections/{connection_name}"
    
    try:
        response = requests.delete(
            url,
            auth=(management_info['username'], management_info['password']),
            timeout=10
        )
        response.raise_for_status()
        print(f"✅ Closed connection: {connection_name}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to close connection {connection_name}: {e}")
        return False

def close_all_connections(management_info):
    """Close all active connections."""
    connections = list_connections(management_info)
    
    if not connections:
        print("No connections to close.")
        return
    
    print(f"🗑️  Closing all {len(connections)} connections...")
    
    closed_count = 0
    for conn in connections:
        connection_name = conn.get('name')
        if connection_name:
            if close_connection(management_info, connection_name):
                closed_count += 1
    
    print(f"✅ Closed {closed_count}/{len(connections)} connections")

def main():
    print("🧹 LavinMQ Connection Cleanup Tool")
    print("=" * 40)
    
    # Get management info
    management_info = get_lavinmq_management_url()
    if not management_info:
        return
    
    print(f"🔗 Management URL: {management_info['url']}")
    print(f"👤 Username: {management_info['username']}")
    print()
    
    # List current connections
    connections = list_connections(management_info)
    
    if not connections:
        print("✅ No active connections found!")
        return
    
    # Ask user what to do
    print("Options:")
    print("1. Close all connections")
    print("2. Close specific connection")
    print("3. Just list connections (no action)")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        confirm = input("⚠️  Are you sure you want to close ALL connections? (yes/no): ").strip().lower()
        if confirm == "yes":
            close_all_connections(management_info)
        else:
            print("❌ Operation cancelled.")
    
    elif choice == "2":
        connection_name = input("Enter connection name to close: ").strip()
        if connection_name:
            close_connection(management_info, connection_name)
        else:
            print("❌ No connection name provided.")
    
    elif choice == "3":
        print("✅ No action taken.")
    
    else:
        print("❌ Invalid choice.")

if __name__ == "__main__":
    main() 