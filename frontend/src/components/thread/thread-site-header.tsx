"use client"

import { Button } from "@/components/ui/button"
import { FolderOpen, Link, PanelRightOpen, Check, X, Menu, Download } from "lucide-react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useRef, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { updateProject } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from 'react-i18next'

interface ThreadSiteHeaderProps {
  threadId: string
  projectId: string
  projectName: string
  onViewFiles: () => void
  onToggleSidePanel: () => void
  onProjectRenamed?: (newName: string) => void
  isMobileView?: boolean
  rightActions?: React.ReactNode
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function SiteHeader({ 
  threadId, 
  projectId,
  projectName, 
  onViewFiles, 
  onToggleSidePanel,
  onProjectRenamed,
  isMobileView,
  rightActions
}: ThreadSiteHeaderProps) {
  const pathname = usePathname()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile() || isMobileView
  const { setOpenMobile } = useSidebar()
  const { t } = useTranslation();
  
  const copyCurrentUrl = () => {
    const url = window.location.origin + pathname
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }

  const startEditing = () => {
    setEditName(projectName)
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditName(projectName)
  }

  const saveNewName = async () => {
    if (editName.trim() === "") {
      setEditName(projectName)
      setIsEditing(false)
      return
    }
    
    if (editName !== projectName) {
      try {
        if (!projectId) {
          toast.error("Cannot rename: Project ID is missing")
          setEditName(projectName)
          setIsEditing(false)
          return
        }
        
        const updatedProject = await updateProject(projectId, { name: editName })
        if (updatedProject) {
          onProjectRenamed?.(editName)
          toast.success("Project renamed successfully")
        } else {
          throw new Error("Failed to update project")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to rename project"
        console.error("Failed to rename project:", errorMessage)
        toast.error(errorMessage)
        setEditName(projectName)
      }
    }
    
    setIsEditing(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveNewName()
    } else if (e.key === "Escape") {
      cancelEditing()
    }
  }

  return (
    <header className={cn(
      "bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-20 w-full",
      isMobile && "px-2"
    )}>
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpenMobile(true)}
          className="h-9 w-9 mr-1"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div className="flex flex-1 items-center gap-2 px-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveNewName}
              className="h-8 w-auto min-w-[180px] text-base font-medium"
              maxLength={50}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={saveNewName}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={cancelEditing}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : !projectName || projectName === 'Project' ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div 
            className="text-base font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center"
            onClick={startEditing}
            title="Click to rename project"
          >
            {projectName}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 pr-4">
        {isMobile ? (
          // Mobile view - only show the side panel toggle
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidePanel}
            className="h-9 w-9 cursor-pointer"
            aria-label="Toggle computer panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        ) : (
          // Desktop view - show all buttons with tooltips
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onViewFiles}
                  className="h-9 w-9 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('threadHeader.viewFiles', 'View Files in Task')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyCurrentUrl}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Link className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('threadHeader.copyLink', 'Copy Link')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidePanel}
                  className="h-9 w-9 cursor-pointer"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('threadHeader.toggleComputer', 'Toggle Computer Preview (CMD+I)')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 cursor-pointer"
                  aria-label="Download all project files"
                  onClick={async () => {
                    if (!projectId) return;
                    try {
                      const supabase = createClient();
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) {
                        throw new Error('No access token available');
                      }
                      const res = await fetch(`${API_URL}/project/${projectId}/download-all`, {
                        method: 'GET',
                        headers: {
                          'Accept': 'application/zip',
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                      });
                      if (!res.ok) {
                        throw new Error('Failed to download project files');
                      }
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `project_${projectId}.zip`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      alert('Failed to download project files.');
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('threadHeader.downloadAll', 'Download all project files. Please download your files promptly—files will be lost if the sandbox is deleted.')}</p>
              </TooltipContent>
            </Tooltip>

            {rightActions}
          </TooltipProvider>
        )}
      </div>
    </header>
  )
} 