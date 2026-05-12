/**
 * Site metadata configuration - SIMPLE AND WORKING
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dobby.now';

export const siteMetadata = {
  name: 'Dobby',
  title: 'Dobby: Your Autonomous AI Worker',
  description: 'Built for complex tasks, designed for everything. The ultimate AI assistant that handles it all—from simple requests to mega-complex projects.',
  url: baseUrl,
  keywords: 'Dobby, AI Worker, Agentic AI, Autonomous AI Worker, AI Automation, AI Workflow Automation, AI Assistant, Task Automation',
};
