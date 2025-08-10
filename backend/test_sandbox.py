import asyncio
from sandbox.sandbox import get_or_start_sandbox

async def test_sandbox():
    try:
        print("Testing sandbox connection...")
        sandbox = await get_or_start_sandbox('test-project')
        print(f"Sandbox created successfully: {sandbox.sandbox_id if hasattr(sandbox, 'sandbox_id') else 'No ID'}")
        
        # Test file creation
        test_content = "Hello World!"
        await sandbox.fs.upload_file(test_content.encode(), "/workspace/test.txt")
        print("File creation test successful")
        
        # Test file reading
        content = await sandbox.fs.download_file("/workspace/test.txt")
        print(f"File reading test successful: {content.decode()}")
        
        return True
    except Exception as e:
        print(f"Sandbox test failed: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_sandbox())
    print(f"Test result: {'SUCCESS' if result else 'FAILED'}")


