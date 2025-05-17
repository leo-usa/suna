"use client"

import { useEffect, useState } from "react"
import {
  ArrowUpRight,
  Link as LinkIcon,
  MoreHorizontal,
  Trash2,
  Plus,
  MessagesSquare,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { getProjects, getThreads, Project, deleteProject } from "@/lib/api"
import Link from "next/link"

// Thread with associated project info for display in sidebar
type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  url: string;
  updatedAt: string;
}

export function NavAgents({ dict }: { dict: Record<string, string> }) {
  const { isMobile, state } = useSidebar()
  const [threads, setThreads] = useState<ThreadWithProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  // Extract locale from pathname (assumes /[locale]/...)
  const locale = pathname?.split("/")[1] || "en";

  const t = (key: string) => (dict && dict[key]) || key;

  // Helper to sort threads by updated_at (most recent first)
  const sortThreads = (threadsList: ThreadWithProject[]): ThreadWithProject[] => {
    return [...threadsList].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  };

  // Function to load threads data with associated projects
  const loadThreadsWithProjects = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true)
      }
      
      // Get all projects
      const projects = await getProjects() as Project[]
      console.log("Projects loaded:", projects.length, projects.map(p => ({ id: p.id, name: p.name })));
      
      // If no projects are found, the user might not be logged in
      if (projects.length === 0) {
        setThreads([])
        return
      }
      
      // Create a map of projects by ID for faster lookups
      const projectsById = new Map<string, Project>();
      projects.forEach(project => {
        projectsById.set(project.id, project);
      });
      
      // Get all threads at once
      const allThreads = await getThreads() 
      console.log("Threads loaded:", allThreads.length, allThreads.map(t => ({ thread_id: t.thread_id, project_id: t.project_id })));
      
      // Create display objects for threads with their project info
      const threadsWithProjects: ThreadWithProject[] = [];
      
      for (const thread of allThreads) {
        const projectId = thread.project_id;
        // Skip threads without a project ID
        if (!projectId) continue;
        
        // Get the associated project
        const project = projectsById.get(projectId);
        if (!project) {
          console.log(`❌ Thread ${thread.thread_id} has project_id=${projectId} but no matching project found`);
          continue;
        }
        
        console.log(`✅ Thread ${thread.thread_id} matched with project "${project.name}" (${projectId})`);
        
        // Add to our list
        threadsWithProjects.push({
          threadId: thread.thread_id,
          projectId: projectId,
          projectName: project.name || 'Unnamed Project',
          url: `/${locale}/agents/${thread.thread_id}`,
          updatedAt: thread.updated_at || project.updated_at || new Date().toISOString()
        });
      }
      
      // Set threads, ensuring consistent sort order
      setThreads(sortThreads(threadsWithProjects))
    } catch (err) {
      console.error("Error loading threads with projects:", err)
      // Set empty threads array on error
      setThreads([])
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }

  // Load threads dynamically from the API on initial load
  useEffect(() => {
    loadThreadsWithProjects(true);
  }, []);

  // Listen for project-updated events to update the sidebar without full reload
  useEffect(() => {
    const handleProjectUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { projectId, updatedData } = customEvent.detail;
        
        // Update just the name for the threads with the matching project ID
        setThreads(prevThreads => {
          const updatedThreads = prevThreads.map(thread => 
            thread.projectId === projectId 
              ? { 
                  ...thread, 
                  projectName: updatedData.name,
                } 
              : thread
          );
          
          // Return the threads without re-sorting immediately
          return updatedThreads;
        });
        
        // Silently refresh in background to fetch updated timestamp and re-sort
        setTimeout(() => loadThreadsWithProjects(false), 1000);
      }
    }

    // Add event listener
    window.addEventListener('project-updated', handleProjectUpdate as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('project-updated', handleProjectUpdate as EventListener);
    }
  }, []);

  // Reset loading state when navigation completes (pathname changes)
  useEffect(() => {
    setLoadingThreadId(null)
  }, [pathname])

  // Function to handle thread click with loading state
  const handleThreadClick = (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => {
    e.preventDefault()
    setLoadingThreadId(threadId)
    router.push(url)
  }

  return (
    <SidebarGroup>
      <div className="flex justify-between items-center">
        <SidebarGroupLabel>{t('sidebar.agents')}</SidebarGroupLabel>
        {state !== "collapsed" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link 
                href="/dashboard" 
                className="text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center rounded-md"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">{t('sidebar.new_agent')}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.new_agent')}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <SidebarMenu className="overflow-y-auto max-h-[calc(100vh-200px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {state === "collapsed" && (
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <Plus className="h-4 w-4" />
                    <span>{t('sidebar.new_agent')}</span>
                  </Link>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent>{t('sidebar.new_agent')}</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        )}
        
        {isLoading ? (
          // Show skeleton loaders while loading
          Array.from({length: 3}).map((_, index) => (
            <SidebarMenuItem key={`skeleton-${index}`}>
              <SidebarMenuButton>
                <div className="h-4 w-4 bg-sidebar-foreground/10 rounded-md animate-pulse"></div>
                <div className="h-3 bg-sidebar-foreground/10 rounded w-3/4 animate-pulse"></div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        ) : threads.length > 0 ? (
          // Show all threads with project info
          <>
            {threads.map((thread) => {
              // Check if this thread is currently active
              const isActive = pathname?.includes(thread.threadId) || false;
              const isThreadLoading = loadingThreadId === thread.threadId;
              
              return (
                <SidebarMenuItem key={`thread-${thread.threadId}`}>
                  {state === "collapsed" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild className={isActive ? "bg-accent text-accent-foreground" : ""}>
                          <Link href={thread.url} onClick={(e) => handleThreadClick(e, thread.threadId, thread.url)}>
                            {isThreadLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessagesSquare className="h-4 w-4" />
                            )}
                            <span>{thread.projectName}</span>
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent>{thread.projectName}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild className={isActive ? "bg-accent text-accent-foreground font-medium" : ""}>
                      <Link href={thread.url} onClick={(e) => handleThreadClick(e, thread.threadId, thread.url)}>
                        {isThreadLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessagesSquare className="h-4 w-4" />
                        )}
                        <span>{thread.projectName}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                  {state !== "collapsed" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align={isMobile ? "end" : "start"}
                      >
                        <DropdownMenuItem onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + thread.url)
                          toast.success(t('sidebar.link_copied'))
                        }}>
                          <LinkIcon className="text-muted-foreground" />
                          <span>{t('sidebar.copy_link')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={thread.url} target="_blank" rel="noopener noreferrer">
                            <ArrowUpRight className="text-muted-foreground" />
                            <span>{t('sidebar.open_in_new_tab')}</span>
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => {
                          if (window.confirm(t('sidebar.delete_confirm'))) {
                            setDeletingProjectId(thread.projectId);
                            try {
                              await deleteProject(thread.projectId);
                              toast.success(t('sidebar.project_deleted'));
                              await loadThreadsWithProjects();
                            } catch (err) {
                              toast.error(t('sidebar.delete_failed'));
                            } finally {
                              setDeletingProjectId(null);
                            }
                          }
                        }} disabled={deletingProjectId === thread.projectId}>
                          <Trash2 className="text-muted-foreground" />
                          <span>{deletingProjectId === thread.projectId ? t('sidebar.deleting') : t('sidebar.delete')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </SidebarMenuItem>
              );
            })}
          </>
        ) : (
          // Empty state
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MessagesSquare className="h-4 w-4" />
              <span>{t('sidebar.no_agents')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
