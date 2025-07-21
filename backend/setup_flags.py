#!/usr/bin/env python3
"""
Script to enable feature flags for production deployment.
Run this once after deploying to Render.
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flags.flags import enable_flag, disable_flag, list_flags

async def setup_production_flags():
    """Enable all production feature flags."""
    print("Setting up production feature flags...")
    
    # Enable core features
    await enable_flag('custom_agents', 'Enable custom agent creation and management')
    await enable_flag('agent_marketplace', 'Enable agent marketplace functionality')
    
    # List current flags
    print("\nCurrent feature flags:")
    flags = await list_flags()
    for flag_name, flag_data in flags.items():
        status = "✅ ENABLED" if flag_data.get('enabled') else "❌ DISABLED"
        print(f"  {flag_name}: {status} - {flag_data.get('description', 'No description')}")
    
    print("\nFeature flags setup complete!")

if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    # Run the setup
    asyncio.run(setup_production_flags()) 