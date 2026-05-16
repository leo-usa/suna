'use client';

import { Project } from "@/lib/api/threads";
import { Thread } from "@/lib/api/threads";
import { formatDateForList } from '@/lib/utils/date-formatting';

// Re-export hooks from their proper locations for backward compatibility
export { useProjects, usePublicProjectsQuery, useUpdateProject, useDeleteProject } from '../threads/use-project';
export { useThreads } from '../threads/use-threads';
export { useDeleteThread, useDeleteMultipleThreads } from '../threads/use-thread-mutations';

// Sidebar-specific utility types and functions
export type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  threadName: string;
  url: string;
  updatedAt: string;
  dedicatedAt?: string | null;
  // Icon system field for thread categorization
  iconName?: string | null;
};

export const processThreadsWithProjects = (
  threads: Thread[],
  projects: Project[]
): ThreadWithProject[] => {
  const projectsById = new Map<string, Project>();
  projects.forEach((project) => {
    projectsById.set(project.id, project);
  });

  const threadsWithProjects: ThreadWithProject[] = [];

  for (const thread of threads) {
    const projectId = thread.project_id;
    if (!projectId) continue;

    const project = projectsById.get(projectId);
    if (!project) {
      continue;
    }
    // Use dedicated icon_name field from backend
    const displayName = project.name || 'Unnamed Project';
    const iconName = project.icon_name; // Get icon from dedicated database field
    const dedicatedAt = project.dedicated_at ?? null;

    // Format date for fallback if thread has no name
    const updatedAt = thread.updated_at || project.updated_at || new Date().toISOString();
    const formattedDate = formatDateForList(updatedAt);
    
    threadsWithProjects.push({
      threadId: thread.thread_id,
      projectId: projectId,
      projectName: displayName,
      threadName: thread.name && thread.name.trim() ? thread.name : formattedDate,
      url: `/projects/${projectId}/thread/${thread.thread_id}`,
      updatedAt: updatedAt,
      dedicatedAt,
      // Use dedicated field or parsed embedded data
      iconName: iconName,
    });
  }

  return sortThreads(threadsWithProjects);
};

export const sortThreads = (
  threadsList: ThreadWithProject[],
): ThreadWithProject[] => {
  return [...threadsList].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

export type GroupedThreads = {
  [dateGroup: string]: ThreadWithProject[];
};

export type ProjectGroup = {
  projectId: string;
  projectName: string;
  iconName?: string | null;
  dedicatedAt?: string | null;
  threads: ThreadWithProject[];
  latestUpdate: string;
};

export const compareProjectGroups = (a: ProjectGroup, b: ProjectGroup) => {
  const aDedicated = a.dedicatedAt ? 1 : 0;
  const bDedicated = b.dedicatedAt ? 1 : 0;
  if (aDedicated !== bDedicated) {
    return bDedicated - aDedicated;
  }
  return new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime();
};

export type GroupedByProject = {
  [projectId: string]: ProjectGroup;
};

export const groupThreadsByProject = (
  threadsList: ThreadWithProject[]
): GroupedByProject => {
  const sortedThreads = sortThreads(threadsList);
  const grouped: GroupedByProject = {};
  
  sortedThreads.forEach(thread => {
    const projectId = thread.projectId;
    
    if (!grouped[projectId]) {
      grouped[projectId] = {
        projectId: projectId,
        projectName: thread.projectName,
        iconName: thread.iconName,
        dedicatedAt: thread.dedicatedAt,
        threads: [],
        latestUpdate: thread.updatedAt,
      };
    }
    
    grouped[projectId].threads.push(thread);
    
    // Update latest update if this thread is newer
    if (new Date(thread.updatedAt) > new Date(grouped[projectId].latestUpdate)) {
      grouped[projectId].latestUpdate = thread.updatedAt;
    }
  });
  
  const sortedProjects = Object.values(grouped).sort(compareProjectGroups);
  
  // Rebuild grouped object with sorted order
  const sortedGrouped: GroupedByProject = {};
  sortedProjects.forEach(project => {
    sortedGrouped[project.projectId] = project;
  });
  
  return sortedGrouped;
};

export const groupThreadsByDate = (
  threadsList: ThreadWithProject[]
): GroupedThreads => {
  const sortedThreads = sortThreads(threadsList);
  const grouped: GroupedThreads = {};
  const now = new Date();
  
  // Get start of today (midnight)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  sortedThreads.forEach(thread => {
    const threadDate = new Date(thread.updatedAt);
    
    // Get start of thread date (midnight)
    const startOfThreadDate = new Date(threadDate);
    startOfThreadDate.setHours(0, 0, 0, 0);
    
    // Calculate difference in calendar days, not 24-hour periods
    const diffInDays = Math.floor((startOfToday.getTime() - startOfThreadDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let dateGroup: string;
    
    if (diffInDays === 0) {
      dateGroup = 'today';
    } else if (diffInDays === 1) {
      dateGroup = 'yesterday';
    } else if (diffInDays <= 7) {
      dateGroup = 'thisWeek';
    } else if (diffInDays <= 30) {
      dateGroup = 'thisMonth';
    } else if (diffInDays <= 90) {
      dateGroup = 'last3Months';
    } else {
      dateGroup = 'older';
    }
    
    if (!grouped[dateGroup]) {
      grouped[dateGroup] = [];
    }
    grouped[dateGroup].push(thread);
  });
  
  return grouped;
};

export type GroupedByDateThenProject = {
  [dateGroup: string]: GroupedByProject;
};

export const groupThreadsByDateThenProject = (
  threadsList: ThreadWithProject[]
): GroupedByDateThenProject => {
  const sortedThreads = sortThreads(threadsList);
  const grouped: GroupedByDateThenProject = {};
  const now = new Date();
  
  // Get start of today (midnight)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  sortedThreads.forEach(thread => {
    // Dedicated projects live in the pinned section at the top of the sidebar
    if (thread.dedicatedAt) {
      return;
    }

    const threadDate = new Date(thread.updatedAt);
    
    // Get start of thread date (midnight)
    const startOfThreadDate = new Date(threadDate);
    startOfThreadDate.setHours(0, 0, 0, 0);
    
    // Calculate difference in calendar days
    const diffInDays = Math.floor((startOfToday.getTime() - startOfThreadDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let dateGroup: string;
    
    if (diffInDays === 0) {
      dateGroup = 'today';
    } else if (diffInDays === 1) {
      dateGroup = 'yesterday';
    } else if (diffInDays <= 7) {
      dateGroup = 'thisWeek';
    } else if (diffInDays <= 30) {
      dateGroup = 'thisMonth';
    } else if (diffInDays <= 90) {
      dateGroup = 'last3Months';
    } else {
      dateGroup = 'older';
    }
    
    // Initialize date group if needed
    if (!grouped[dateGroup]) {
      grouped[dateGroup] = {};
    }
    
    const projectId = thread.projectId;
    
    // Initialize project within date group if needed
    if (!grouped[dateGroup][projectId]) {
      grouped[dateGroup][projectId] = {
        projectId: projectId,
        projectName: thread.projectName,
        iconName: thread.iconName,
        dedicatedAt: thread.dedicatedAt,
        threads: [],
        latestUpdate: thread.updatedAt,
      };
    }
    
    grouped[dateGroup][projectId].threads.push(thread);
    
    // Update latest update if this thread is newer
    if (new Date(thread.updatedAt) > new Date(grouped[dateGroup][projectId].latestUpdate)) {
      grouped[dateGroup][projectId].latestUpdate = thread.updatedAt;
    }
  });
  
  return grouped;
};

/** Pinned dedicated-computer projects (shown above date groups). */
export const groupDedicatedProjects = (
  threadsList: ThreadWithProject[],
): ProjectGroup[] => {
  const dedicatedThreads = threadsList.filter((t) => Boolean(t.dedicatedAt));
  if (dedicatedThreads.length === 0) {
    return [];
  }
  const grouped = groupThreadsByProject(dedicatedThreads);
  return Object.values(grouped).sort(compareProjectGroups);
};
