#!/usr/bin/env python3
"""
Script to clean up remote RabbitMQ connections
"""

import os
import subprocess
import time
import pika
import sys
import ssl

def close_remote_rabbitmq_connections():
    """Close RabbitMQ connections using pika"""
    try:
        # Get RabbitMQ URL from environment
        rabbitmq_url = os.getenv('RABBITMQ_URL')
        if not rabbitmq_url:
            print("❌ RABBITMQ_URL not found in environment")
            return False
        
        print(f"🔗 Connecting to remote RabbitMQ server...")
        
        # Use URLParameters which handles SSL automatically
        parameters = pika.URLParameters(rabbitmq_url)
        
        # Connect and immediately close to reset connection state
        print("🔄 Resetting remote RabbitMQ connections...")
        connection = pika.BlockingConnection(parameters)
        connection.close()
        
        print("✅ Remote RabbitMQ connections reset successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to remote RabbitMQ: {e}")
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
    print("🚀 Starting remote RabbitMQ cleanup...\n")
    
    # Step 1: Close remote connections
    print("1️⃣ Closing remote RabbitMQ connections...")
    remote_success = close_remote_rabbitmq_connections()
    
    # Step 2: Kill local processes
    print("\n2️⃣ Cleaning up local processes...")
    kill_local_processes()
    
    # Step 3: Check remaining processes
    print("\n3️⃣ Checking for remaining processes...")
    check_remaining_processes()
    
    print("\n✅ Cleanup completed!")
    
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