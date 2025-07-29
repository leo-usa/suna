#!/usr/bin/env python3
"""
Script to clean up RabbitMQ connections and processes
"""

import os
import signal
import subprocess
import time
import pika
import sys

def kill_processes_by_name(name):
    """Kill all processes with the given name"""
    try:
        result = subprocess.run(['pkill', '-f', name], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Killed processes matching '{name}'")
        else:
            print(f"ℹ️  No processes found matching '{name}'")
    except Exception as e:
        print(f"❌ Error killing processes '{name}': {e}")

def close_rabbitmq_connections():
    """Close RabbitMQ connections using pika"""
    try:
        # Get RabbitMQ URL from environment
        rabbitmq_url = os.getenv('RABBITMQ_URL')
        if not rabbitmq_url:
            print("❌ RABBITMQ_URL not found in environment")
            return False
        
        print(f"🔗 Connecting to RabbitMQ at: {rabbitmq_url.split('@')[1] if '@' in rabbitmq_url else 'localhost'}")
        
        # Parse connection parameters
        connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
        channel = connection.channel()
        
        # Get connection info
        connection_info = connection.connection
        print(f"✅ Connected to RabbitMQ successfully")
        
        # Close the connection
        connection.close()
        print("✅ RabbitMQ connection closed")
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to RabbitMQ: {e}")
        return False

def cleanup_processes():
    """Clean up all related processes"""
    print("🧹 Cleaning up processes...")
    
    # Kill all dramatiq processes
    kill_processes_by_name("dramatiq")
    
    # Kill all uv run processes
    kill_processes_by_name("uv run")
    
    # Kill all Python processes related to the project
    kill_processes_by_name("run_agent_background")
    kill_processes_by_name("api.py")
    
    # Wait a moment for processes to terminate
    time.sleep(2)
    
    print("✅ Process cleanup completed")

def check_remaining_processes():
    """Check if any processes are still running"""
    print("🔍 Checking for remaining processes...")
    
    try:
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        
        remaining = []
        for line in lines:
            if any(keyword in line for keyword in ['dramatiq', 'uv run', 'api.py', 'run_agent_background']):
                if 'grep' not in line:  # Exclude grep itself
                    remaining.append(line.strip())
        
        if remaining:
            print("⚠️  Remaining processes found:")
            for proc in remaining:
                print(f"   {proc}")
        else:
            print("✅ No remaining processes found")
            
    except Exception as e:
        print(f"❌ Error checking processes: {e}")

def main():
    """Main cleanup function"""
    print("🚀 Starting RabbitMQ and process cleanup...")
    
    # Step 1: Close RabbitMQ connections
    print("\n1️⃣ Closing RabbitMQ connections...")
    close_rabbitmq_connections()
    
    # Step 2: Clean up processes
    print("\n2️⃣ Cleaning up processes...")
    cleanup_processes()
    
    # Step 3: Check remaining processes
    print("\n3️⃣ Checking for remaining processes...")
    check_remaining_processes()
    
    print("\n✅ Cleanup completed!")
    print("\n💡 You can now restart the services with:")
    print("   cd backend && uv run api.py")
    print("   cd backend && uv run dramatiq run_agent_background")

if __name__ == "__main__":
    main() 