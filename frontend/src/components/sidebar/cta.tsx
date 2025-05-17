import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Briefcase, ExternalLink } from "lucide-react"
import { KortixProcessModal } from "@/components/sidebar/kortix-enterprise-modal"

export function CTACard({ dict }: { dict: Record<string, string> }) {
  const t = (key: string) => (dict && dict[key]) || key;
  return (
    <div className="flex flex-col space-y-2 py-2 px-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{t('enterprise.cta_title')}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{t('enterprise.cta_subtitle')}</span>
      </div>
      <div className="flex flex-col space-y-2">
        <KortixProcessModal dict={dict} />
        {/* <Link href="https://cal.com/marko-kraemer/15min" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            Schedule Demo
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </Link> */}
      </div>
      
      <div className="flex items-center mt-1">
        <Link 
          href="https://www.kortix.ai/careers" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Briefcase className="mr-1.5 h-3.5 w-3.5" />
          {t('enterprise.cta_join_team')}
        </Link>
      </div>
    </div>
  )
}
