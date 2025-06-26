"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function KortixLogo() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // After mount, we can access the theme
  useEffect(() => {
    setMounted(true)
  }, [])
  
  return (
    <div className="flex h-24 w-24 items-center justify-center flex-shrink-0">
      <Image
        src="/dobby-logo.svg"
        alt="DrPang.AI"
        width={96}
        height={96}
        className={`${mounted && theme === 'dark' ? 'invert' : ''}`}
      />
    </div>
  )
} 