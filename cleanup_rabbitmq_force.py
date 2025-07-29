#!/usr/bin/env python3
"""
Script to force close remote RabbitMQ connections using management API
"""

import os
import subprocess
import time
import requests
import sys
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
        # Try the standard RabbitMQ management API endpoint
        management_url = f"https://{host}/api"
        
        return management_url, username, password
    
    return None, None, None

def close_rabbitmq_connections():
    """Close RabbitMQ connections using management API"""
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
        
        # Close each connection
        closed_count = 0
        for connection in connections:
            connection_name = connection.get('name', 'unknown')
            print(f"🔌 Closing connection: {connection_name}")
            
            try:
                close_response = requests.delete(
                    f"{management_url}/connections/{connection_name}",
                    headers=headers,
                    timeout=10
                )
                
                if close_response.status_code == 204:
                    print(f"✅ Closed connection: {connection_name}")
                    closed_count += 1
                else:
                    print(f"⚠️  Failed to close {connection_name}: {close_response.status_code}")
                    
            except Exception as e:
                print(f"❌ Error closing {connection_name}: {e}")
        
        print(f"✅ Successfully closed {closed_count} connections")
        return True
        
    except Exception as e:
        print(f"❌ Error accessing management API: {e}")
        return False

def kill_local_processes():
    """Kill local processes that might be holding connections"""
    processes_to_kill = ['dramatiq', 'uv run', 'run_agent_background', 'api.py']
    
    print("🧹 Cleaning up local processes...")
    for process in processes_to_kill:
        try:
            result = subprocess.run(['pkill', '-f', process], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Killed processes matching '{process}'")
            else:
                print(f"ℹ️  No processes found matching '{process}'")
        except Exception as e:
            print(f"❌ Error killing processes '{process}': {e}")

def check_remaining_processes():
    """Check for any remaining processes"""
    print("🔍 Checking for remaining processes...")
    try:
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        
        remaining = []
        for line in lines:
            if any(keyword in line for keyword in ['dramatiq', 'uv run', 'api.py']):
                remaining.append(line.strip())
        
        if remaining:
            print("⚠️  Remaining processes found:")
            for proc in remaining[:5]:  # Show first 5
                print(f"   {proc}")
        else:
            print("✅ No remaining processes found")
            
    except Exception as e:
        print(f"❌ Error checking processes: {e}")

def main():
    print("🚀 Starting force RabbitMQ cleanup...\n")
    
    # Step 1: Close remote connections via management API
    print("1️⃣ Closing remote RabbitMQ connections via Management API...")
    remote_success = close_rabbitmq_connections()
    
    # Step 2: Kill local processes
    print("\n2️⃣ Cleaning up local processes...")
    kill_local_processes()
    
    # Step 3: Check remaining processes
    print("\n3️⃣ Checking for remaining processes...")
    check_remaining_processes()
    
    print("\n✅ Force cleanup completed!")
    
    if remote_success:
        print("\n💡 You can now restart the services with:")
        print("   cd backend && uv run api.py")
        print("   cd backend && uv run dramatiq run_agent_background")
    else:
        print("\n⚠️  Remote connection cleanup failed. You may need to:")
        print("   - Wait a few minutes for connections to timeout")
        print("   - Check your CloudAMQP dashboard")
        print("   - Contact CloudAMQP support if issues persist")

if __name__ == "__main__":
    main() 