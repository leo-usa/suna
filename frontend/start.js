#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Get the port from environment variable or default to 3000
const port = process.env.PORT || 3000;

console.log(`Starting Next.js server on port ${port}...`);

// Start Next.js with the correct port
const nextProcess = spawn('npx', ['next', 'start', '-p', port.toString()], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: port.toString(),
    NODE_ENV: 'production'
  }
});

nextProcess.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  nextProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  nextProcess.kill('SIGINT');
}); 