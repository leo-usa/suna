#!/usr/bin/env python3
"""
Test script to debug sandbox counting and limit enforcement
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from daytona_sdk import AsyncDaytona, DaytonaConfig, SandboxState
from utils.config import config

load_dotenv()

async def test_sandbox_counting():
    """Test sandbox counting logic"""
    
    print("🔍 Testing sandbox counting logic...")
    
    # Initialize Daytona client
    daytona_config = DaytonaConfig(
        api_key=config.DAYTONA_API_KEY,
        api_url=config.DAYTONA_SERVER_URL,
        target=config.DAYTONA_TARGET,
    )
    
    daytona = AsyncDaytona(daytona_config)
    
    try:
        # Get all sandboxes
        sandboxes = await daytona.list()
        print(f"📊 Total sandboxes found: {len(sandboxes)}")
        
        # Count by state
        state_counts = {}
        for s in sandboxes:
            state = s.state
            state_counts[state] = state_counts.get(state, 0) + 1
        
        print(f"📈 Sandbox states: {state_counts}")
        
        # Count sandboxes that count towards limit
        active_states = [SandboxState.CREATING, SandboxState.RESTORING, SandboxState.STARTED, 
                        SandboxState.STOPPED, SandboxState.STARTING, SandboxState.STOPPING, 
                        SandboxState.PENDING_BUILD, SandboxState.BUILDING_SNAPSHOT, 
                        SandboxState.UNKNOWN, SandboxState.PULLING_SNAPSHOT, 
                        SandboxState.ARCHIVING, SandboxState.ARCHIVED]
        
        count_towards_limit = [s for s in sandboxes if s.state in active_states]
        print(f"🎯 Sandboxes counting towards limit: {len(count_towards_limit)} (out of {len(sandboxes)} total)")
        
        # Check limit
        print(f"📋 Limit is: {config.DAYTONA_MAX_SANDBOXES}")
        print(f"🚨 At limit: {len(count_towards_limit) >= config.DAYTONA_MAX_SANDBOXES}")
        
        # Show non-active sandboxes
        non_active = [s for s in count_towards_limit if s.state in [SandboxState.ARCHIVED, SandboxState.STOPPED]]
        print(f"💤 Non-active sandboxes available for deletion: {len(non_active)}")
        
        if non_active:
            print("📝 Non-active sandboxes:")
            for s in non_active[:5]:  # Show first 5
                last_used = s.labels.get('last_used_ts', 'N/A') if hasattr(s, 'labels') and s.labels else 'N/A'
                print(f"   - ID: {getattr(s, 'id', 'N/A')}, State: {s.state}, Last Used: {last_used}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_sandbox_counting()) 