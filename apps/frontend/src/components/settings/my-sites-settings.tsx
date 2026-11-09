'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Globe, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  listMySites,
  setSiteCustomDomain,
  unpublishSite,
  verifySiteCustomDomain,
  type MySitesResponse,
  type WorkPost,
} from '@/lib/api/works';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function MySitesSettings() {
  const [data, setData] = useState<MySitesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainDraft, setDomainDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await listMySites(true);
      setData(mine);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onUnpublish = async (post: WorkPost) => {
    setBusyId(post.id);
    try {
      await unpublishSite(post.id);
      toast.success('Site unpublished');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to unpublish');
    } finally {
      setBusyId(null);
    }
  };

  const onSetDomain = async (post: WorkPost) => {
    const domain = (domainDraft[post.id] || post.custom_domain || '').trim();
    if (!domain) return;
    setBusyId(post.id);
    try {
      const result = await setSiteCustomDomain(post.id, domain);
      toast.success(
        `Add CNAME → ${result.instructions.cname} and publish ${result.instructions.txt_name} = ${result.instructions.txt_value} (or /.well-known/dobby-site.txt)`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to set domain');
    } finally {
      setBusyId(null);
    }
  };

  const onVerifyDomain = async (post: WorkPost) => {
    setBusyId(post.id);
    try {
      const result = await verifySiteCustomDomain(post.id);
      if (result.verified) toast.success('Domain verified');
      else toast.error(result.errors?.[0] || 'Domain not verified yet');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sites…
      </div>
    );
  }

  const posts = data?.posts || [];

  return (
    <div className="space-y-4 p-1">
      <div className="rounded-lg border border-border/60 p-3 text-sm">
        <p className="font-medium">Published sites</p>
        <p className="text-muted-foreground text-xs mt-1">
          {data?.active_count ?? 0}/{data?.sites_limit ?? 0} active
          {data?.branded
            ? ' · Free plan shows a Made with Dobby badge'
            : ' · Paid plan: no badge, vanity + custom domains'}
        </p>
        {data?.branded && (
          <Link href="/dashboard?settings=plan" className="text-xs underline mt-2 inline-block">
            Upgrade to remove branding
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published sites yet. Use Share → Publish in a project.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const href = `/works/${post.slug || post.id}`;
            const busy = busyId === post.id;
            return (
              <li key={post.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{post.title || 'Untitled'}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{href}</p>
                    <p
                      className={cn(
                        'text-[11px] mt-0.5',
                        post.status === 'published' ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                    >
                      {post.status || 'published'}
                      {post.branded ? ' · branded' : ''}
                      {post.vanity_url ? ` · ${post.vanity_url}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {post.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={busy}
                        onClick={() => onUnpublish(post)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {data?.custom_domain && post.status === 'published' && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
                    <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Custom domain
                    </label>
                    <div className="flex gap-1.5">
                      <Input
                        value={domainDraft[post.id] ?? post.custom_domain ?? ''}
                        onChange={(e) =>
                          setDomainDraft((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        placeholder="app.example.com"
                        className="h-8 text-xs"
                      />
                      <Button size="sm" className="h-8" disabled={busy} onClick={() => onSetDomain(post)}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={busy || !post.custom_domain}
                        onClick={() => onVerifyDomain(post)}
                      >
                        Verify
                      </Button>
                    </div>
                    {post.custom_domain_verified && post.custom_domain && (
                      <p className="text-[11px] text-emerald-600">Verified: https://{post.custom_domain}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
