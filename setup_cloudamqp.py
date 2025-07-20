#!/usr/bin/env python3
"""
CloudAMQP Setup Script for Suna
"""

import os
import re
from pathlib import Path

def validate_rabbitmq_url(url):
    """Validate RabbitMQ URL format."""
    # Basic validation for amqps:// or amqp:// URLs
    pattern = r'^(amqps?://)([^:]+):([^@]+)@([^:]+):(\d+)/(.+)$'
    match = re.match(pattern, url)
    return match is not None

def setup_managed_rabbitmq():
    """Interactive setup for managed RabbitMQ services."""
    print("☁️ Managed RabbitMQ Setup for Suna")
    print("=" * 40)
    print()
    
    print("📋 Available Services:")
    print("1. LavinMQ (Recommended) - https://www.lavinmq.com/")
    print("   - High-performance, RabbitMQ compatible")
    print("   - Twice the limits of other providers")
    print("   - Free tier available")
    print()
    print("2. CloudAMQP - https://www.cloudamqp.com/")
    print("   - Established RabbitMQ service")
    print("   - Free tier available")
    print()
    
    print("📋 Prerequisites:")
    print("1. Create an account with your chosen service")
    print("2. Create a RabbitMQ instance")
    print("3. Get your AMQP URL from the instance details")
    print()
    
    # Get managed RabbitMQ URL
    while True:
        rabbitmq_url = input("🔗 Enter your RabbitMQ URL (amqps://username:password@hostname:port/vhost): ").strip()
        
        if not rabbitmq_url:
            print("❌ URL cannot be empty. Please try again.")
            continue
            
        if not validate_rabbitmq_url(rabbitmq_url):
            print("❌ Invalid URL format. Expected: amqps://username:password@hostname:port/vhost")
            continue
            
        break
    
    # Update .env file
    env_file = Path("backend/.env")
    if env_file.exists():
        # Read existing .env file
        with open(env_file, 'r') as f:
            content = f.read()
        
        # Check if RABBITMQ_URL already exists
        if "RABBITMQ_URL=" in content:
            # Replace existing RABBITMQ_URL
            lines = content.split('\n')
            new_lines = []
            for line in lines:
                if line.startswith("RABBITMQ_URL="):
                    new_lines.append(f"RABBITMQ_URL={rabbitmq_url}")
                else:
                    new_lines.append(line)
            content = '\n'.join(new_lines)
        else:
            # Add RABBITMQ_URL to the end
            content += f"\nRABBITMQ_URL={rabbitmq_url}\n"
        
        # Write back to .env file
        with open(env_file, 'w') as f:
            f.write(content)
        
        print(f"✅ Updated {env_file}")
    else:
        print(f"❌ {env_file} not found. Please create it first.")
        return False
    
    # Test the connection
    print("\n🧪 Testing managed RabbitMQ connection...")
    try:
        import subprocess
        result = subprocess.run(["python", "backend/test_cloudamqp.py"], 
                              capture_output=True, text=True, cwd=os.getcwd())
        
        if result.returncode == 0:
            print("✅ Managed RabbitMQ connection test successful!")
            print("\n📋 Next Steps:")
            print("1. Deploy your application to Render")
            print("2. Add RABBITMQ_URL to your Render environment variables")
            print("3. Your background jobs should now work with your managed RabbitMQ service!")
        else:
            print("❌ Managed RabbitMQ connection test failed:")
            print(result.stdout)
            print(result.stderr)
            
    except Exception as e:
        print(f"❌ Could not run test: {e}")
    
    return True

def main():
    """Main function."""
    try:
        setup_managed_rabbitmq()
    except KeyboardInterrupt:
        print("\n\n👋 Setup cancelled.")
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")

if __name__ == "__main__":
    main() 