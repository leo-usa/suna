import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Briefcase, ExternalLink } from "lucide-react"
import { KortixProcessModal } from "@/components/sidebar/kortix-enterprise-modal"
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function CTACard() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col space-y-2 py-2 px-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{t('sidebar.enterpriseDemo', 'Enterprise Demo')}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{t('sidebar.enterpriseDemoDesc', 'AI employees for your company')}</span>
      </div>
      <div className="flex flex-col space-y-2">
        <KortixProcessModal />
        {/* <Link href="https://cal.com/marko-kraemer/15min" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            {t('sidebar.scheduleDemo', 'Schedule Demo')}
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </Link> */}
      </div>
      
      <div className="flex items-center mt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(true)}
        >
          <Briefcase className="mr-1.5 h-3.5 w-3.5" />
          {t('sidebar.joinTeam', 'Join Our Team! 🚀')}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {i18n.language === 'zh-CN'
                  ? t('sidebar.addWeChatCN', '加庞博士微信：DrLeoPang')
                  : t('sidebar.addWeChatEN', 'Add DrLeoPang in WeChat')}
              </DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
