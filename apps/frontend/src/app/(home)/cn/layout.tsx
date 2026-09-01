import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby：国内用上 GPT、Claude，不需翻墙',
  description:
    '打开 dobby.now，国内直连 GPT 与 Claude，不用翻墙。每一轮对话都可以换模型，也可用国内开源模型。桌面端可操作这台电脑，云端沙箱关电脑也能继续跑。微信、飞书入口内测中。',
  path: '/cn',
  locale: 'zh_CN',
  absoluteTitle: true,
});

export default function CnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
