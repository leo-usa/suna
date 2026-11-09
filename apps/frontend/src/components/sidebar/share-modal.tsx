"use client"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, Globe, ExternalLink, Lock, Upload, RefreshCw } from "lucide-react"
import { toast } from "@/lib/toast"
import { useThreadQuery, useUpdateThreadMutation } from "@/hooks/threads/use-threads"
import { Skeleton } from "../ui/skeleton"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { listMySites, publishWork, unpublishSite, type WorkPost } from "@/lib/api/works"
import Link from "next/link"

interface SharePopoverProps {
  threadId?: string
  projectId?: string
  children?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const LoadingSkeleton = () => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-7 w-7 rounded-lg" />
      <div className="space-y-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
    <Skeleton className="h-5 w-9 rounded-full" />
  </div>
)

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

function SharePopoverContent({
  threadId,
  projectId,
  isOpen,
}: {
  threadId?: string
  projectId?: string
  isOpen: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState("")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [existing, setExisting] = useState<WorkPost | null>(null)
  const [branded, setBranded] = useState(true)
  const [sitesLimit, setSitesLimit] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const t = useTranslations("threads.sharePopover")

  const updateThreadMutation = useUpdateThreadMutation()
  const { data: threadData, isLoading, refetch } = useThreadQuery(threadId || "")

  const isPublic = Boolean(threadData?.is_public)

  const shareLink = threadId
    ? `${process.env.NEXT_PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "")}/share/${threadId}`
    : ""

  const resolvedProjectId = projectId || threadData?.project_id || undefined

  useEffect(() => {
    if (!isOpen) setCopied(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !resolvedProjectId) return
    let cancelled = false
    ;(async () => {
      try {
        const mine = await listMySites(true)
        if (cancelled) return
        setBranded(Boolean(mine.branded))
        setSitesLimit(mine.sites_limit)
        setActiveCount(mine.active_count)
        const match =
          mine.posts.find((p) => p.project_id === resolvedProjectId && p.status === "published") ||
          mine.posts.find((p) => p.project_id === resolvedProjectId) ||
          null
        setExisting(match)
        if (match) {
          setTitle(match.title || "")
          setSlug(match.slug || "")
          const origin = typeof window !== "undefined" ? window.location.origin : ""
          setPublishedUrl(`${origin}/works/${match.slug || match.id}`)
        } else if (threadData?.project?.name) {
          setTitle(threadData.project.name)
        }
      } catch {
        // ignore — publish still works without prior list
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, resolvedProjectId, threadData?.project?.name])

  const handleToggle = async (checked: boolean) => {
    if (!threadId) return
    try {
      await updateThreadMutation.mutateAsync({
        threadId,
        data: { is_public: checked },
      })
      await refetch()
      toast.success(checked ? t("toastLinkEnabled") : t("toastLinkDisabled"))
    } catch (error) {
      console.error("Error:", error)
      toast.error(t("toastFailedToUpdate"))
    }
  }

  const handleCopy = async () => {
    if (!shareLink || copied) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      toast.success(t("toastCopied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("toastFailedToCopy"))
    }
  }

  const handleOpen = () => window.open(shareLink, "_blank", "noopener,noreferrer")

  const handleShareX = () => {
    const text = encodeURIComponent(t("shareXText"))
    const url = encodeURIComponent(shareLink)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank")
  }

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(shareLink)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank")
  }

  const handlePublish = async (replaceExisting: boolean) => {
    if (!resolvedProjectId) {
      // toast.error is globally no-op; use warning so the user sees it
      toast.warning(t("publishNeedProject"))
      return
    }
    if (publishing) return
    setPublishing(true)
    try {
      const result = await publishWork({
        projectId: resolvedProjectId,
        threadId,
        title: title.trim() || undefined,
        slug: slug.trim() || undefined,
        postId: replaceExisting ? existing?.id : undefined,
        replaceExisting,
      })
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const url = `${origin}${result.url}`
      setPublishedUrl(url)
      setExisting({
        id: result.id,
        title: title || result.slug || "Site",
        user_name: "",
        like_count: 0,
        description: "",
        thumbnail_path: "",
        created_at: new Date().toISOString(),
        html_url: result.html_url,
        html_path: "",
        artifact_type: result.artifact_type,
        language: result.language,
        slug: result.slug,
        branded: result.branded,
        status: "published",
        vanity_url: result.vanity_url,
        files: [],
        project_id: resolvedProjectId,
      })
      if (result.slug) setSlug(result.slug)
      setBranded(Boolean(result.branded))
      toast.message(result.updated ? t("publishUpdated") : t("publishSuccess"))
      window.open(result.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      const message = error instanceof Error ? error.message : t("publishFailed")
      console.error("[SharePopover] publish failed:", error)
      toast.warning(message || t("publishFailed"), { duration: 6000 })
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!existing?.id || unpublishing) return
    setUnpublishing(true)
    try {
      await unpublishSite(existing.id)
      setExisting(null)
      setPublishedUrl("")
      toast.message(t("unpublishSuccess"))
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : t("unpublishFailed"))
    } finally {
      setUnpublishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2.5 w-[320px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded-lg shrink-0 transition-all duration-200",
              isPublic
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </div>
          <div className="text-left min-w-0">
            <p className="text-[13px] font-medium leading-tight">
              {isPublic ? t("titlePublicEnabled") : t("titleEnablePublic")}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {isPublic ? t("subtitleAnyoneCanView") : t("subtitleOnlyYou")}
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handleToggle}
          disabled={updateThreadMutation.isPending}
          className={cn("shrink-0", updateThreadMutation.isPending && "opacity-50")}
        />
      </div>

      {isPublic && (
        <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-150 pt-0.5">
          <button
            onClick={handleCopy}
            className={cn(
              "w-full flex items-center gap-2 px-2.5 h-8 rounded-lg transition-all",
              "bg-muted/50 hover:bg-muted active:scale-[0.99]",
              copied && "bg-emerald-500/10",
            )}
          >
            <span className="flex-1 text-[11px] text-muted-foreground font-mono truncate text-left">
              {shareLink.replace(/^https?:\/\//, "")}
            </span>
            <div
              className={cn(
                "transition-colors shrink-0",
                copied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleOpen}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              {t("open")}
            </button>
            <button
              onClick={handleShareX}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border/60 hover:bg-muted transition-colors"
              title={t("shareOnX")}
            >
              <XIcon />
            </button>
            <button
              onClick={handleShareLinkedIn}
              className="flex items-center justify-center h-7 w-7 rounded-lg border border-border/60 hover:bg-muted transition-colors"
              title={t("shareOnLinkedIn")}
            >
              <LinkedInIcon />
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border/60 pt-2.5 space-y-2">
        <p className="text-[12px] font-medium">{t("publishSectionTitle")}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("publishTitlePlaceholder")}
          className="w-full h-8 px-2.5 rounded-lg border border-border/60 bg-background text-[12px]"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-\u4e00-\u9fff]/g, "-"))}
          placeholder={t("publishSlugPlaceholder")}
          className="w-full h-8 px-2.5 rounded-lg border border-border/60 bg-background text-[12px] font-mono"
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          {resolvedProjectId ? t("publishHint") : t("publishNeedProject")}
          {sitesLimit != null && activeCount != null
            ? ` ${t("publishQuota", { active: activeCount, limit: sitesLimit })}`
            : ""}
        </p>
        {branded && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            {t("publishBrandedHint")}{" "}
            <Link href="/dashboard?settings=plan" className="underline">
              {t("upgradeToRemoveBadge")}
            </Link>
          </p>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={() => handlePublish(Boolean(existing?.id && existing.status === "published"))}
            disabled={!resolvedProjectId || publishing}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-medium",
              "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all",
              (!resolvedProjectId || publishing) && "opacity-50",
            )}
          >
            {existing?.id && existing.status === "published" ? (
              <RefreshCw className={cn("h-3 w-3", publishing && "animate-spin")} />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {publishing
              ? t("publishing")
              : existing?.id && existing.status === "published"
                ? t("updatePublish")
                : t("publish")}
          </button>
          {existing?.id && existing.status === "published" && (
            <button
              onClick={handleUnpublish}
              disabled={unpublishing}
              className="h-8 px-2.5 rounded-lg text-[11px] border border-border/60 hover:bg-muted"
            >
              {unpublishing ? "…" : t("unpublish")}
            </button>
          )}
        </div>
        {publishedUrl && (
          <button
            onClick={() => window.open(publishedUrl, "_blank", "noopener,noreferrer")}
            className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-medium border border-border/60 hover:bg-muted"
          >
            <ExternalLink className="h-3 w-3" />
            {t("openWork")}
          </button>
        )}
        <Link
          href="/dashboard?settings=sites"
          className="block text-center text-[11px] text-muted-foreground hover:text-foreground"
        >
          {t("manageSites")}
        </Link>
      </div>
    </div>
  )
}

export function SharePopover({
  threadId,
  projectId,
  children,
  side = "bottom",
  align = "end",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SharePopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      {children ?? (
        <PopoverAnchor className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      )}
      <PopoverContent
        side={children ? side : "bottom"}
        align={children ? align : "center"}
        className="w-[320px] p-0 overflow-hidden"
        sideOffset={8}
      >
        <SharePopoverContent threadId={threadId} projectId={projectId} isOpen={isOpen} />
      </PopoverContent>
    </Popover>
  )
}
