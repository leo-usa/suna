import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMediaQuery } from "@/hooks/use-media-query"
import Image from "next/image"
import Cal, { getCalApi } from "@calcom/embed-react"
import { useTheme } from "next-themes"

export function KortixProcessModal({ dict }: { dict: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { resolvedTheme } = useTheme()
  const isDarkMode = resolvedTheme === "dark"
  const t = (key: string) => (dict && dict[key]) || key;
  
  useEffect(() => {
    (async function() {
      const cal = await getCalApi({"namespace": "enterprise-demo"})
      cal("ui", {"hideEventTypeDetails": true, "layout": "month_view"})
    })()
  }, [])
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm" 
          className="w-full text-xs"
        >
          {t('enterprise.cta_learn_more')}
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 gap-0 border-none max-w-[70vw] rounded-xl overflow-hidden">
        <DialogTitle className="sr-only">{t('enterprise.modal_title')}</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 h-[800px]">
          {/* Info Panel */}
          <div className="p-8 flex flex-col bg-white dark:bg-black relative h-full overflow-y-auto border-r border-gray-200 dark:border-gray-800">
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-8 mt-0 flex-shrink-0">
                <Image 
                  src={isDarkMode ? "/drpang-logo-white.svg" : "/drpang-logo.svg"} 
                  alt="DrPang.AI Logo" 
                  width={60} 
                  height={21} 
                  className="h-6 w-auto"
                />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4 text-foreground flex-shrink-0">
                {t('enterprise.modal_title')}
              </h2>
              <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-lg flex-shrink-0">
                {t('enterprise.modal_description')}
              </p>
              
              <div className="space-y-8 mb-auto flex-shrink-0">
                <div className="transition-all duration-300 hover:translate-x-1 group">
                  <h3 className="text-base md:text-lg font-medium mb-3 flex items-center">
                    <span className="bg-primary text-primary-foreground w-7 h-7 rounded-full inline-flex items-center justify-center mr-3 text-sm group-hover:shadow-md transition-all duration-300">1</span>
                    <span>{t('enterprise.modal_step1_title')}</span>
                  </h3>
                  <p className="text-base text-muted-foreground ml-10">
                    {t('enterprise.modal_step1_desc')}
                  </p>
                </div>
                
                <div className="transition-all duration-300 hover:translate-x-1 group">
                  <h3 className="text-base md:text-lg font-medium mb-3 flex items-center">
                    <span className="bg-primary text-primary-foreground w-7 h-7 rounded-full inline-flex items-center justify-center mr-3 text-sm group-hover:shadow-md transition-all duration-300">2</span>
                    <span>{t('enterprise.modal_step2_title')}</span>
                  </h3>
                  <p className="text-base text-muted-foreground ml-10">
                    {t('enterprise.modal_step2_desc')}
                  </p>
                </div>
                
                <div className="transition-all duration-300 hover:translate-x-1 group">
                  <h3 className="text-base md:text-lg font-medium mb-3 flex items-center">
                    <span className="bg-primary text-primary-foreground w-7 h-7 rounded-full inline-flex items-center justify-center mr-3 text-sm group-hover:shadow-md transition-all duration-300">3</span>
                    <span>{t('enterprise.modal_step3_title')}</span>
                  </h3>
                  <p className="text-base text-muted-foreground ml-10">
                    {t('enterprise.modal_step3_desc')}
                  </p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6 flex-shrink-0">
                <p className="text-base font-medium mb-3">{t('enterprise.modal_benefits_title')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    <p className="text-sm text-muted-foreground">{t('enterprise.modal_benefit1')}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    <p className="text-sm text-muted-foreground">{t('enterprise.modal_benefit2')}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    <p className="text-sm text-muted-foreground">{t('enterprise.modal_benefit3')}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    <p className="text-sm text-muted-foreground">{t('enterprise.modal_benefit4')}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    <p className="text-sm text-muted-foreground">{t('enterprise.modal_benefit5')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#171717] h-full overflow-hidden">
            <div className="h-full overflow-auto">
              <Cal 
                namespace="enterprise-demo"
                calLink="team/kortix/enterprise-demo"
                style={{width:"100%", height:"100%"}}
                config={{
                  layout: "month_view",
                  hideEventTypeDetails: "false",
                }}
              />
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
} 