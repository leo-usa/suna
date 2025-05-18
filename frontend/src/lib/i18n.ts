import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      hero: {
        title: 'Less structure, more intelligence.',
        subtitle: 'AI agents that turn your thoughts into actions.',
        cta: 'Get Started'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms',
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access',
        }
      }
    }
  },
  de: {
    translation: {
      hero: {
        title: 'Weniger Struktur, mehr Intelligenz.',
        subtitle: 'KI-Agenten, die Ihre Gedanken in Taten umsetzen.',
        cta: 'Loslegen'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  es: {
    translation: {
      hero: {
        title: 'Menos estructura, más inteligencia.',
        subtitle: 'Agentes de IA que convierten tus ideas en acciones.',
        cta: 'Comenzar'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  fr: {
    translation: {
      hero: {
        title: "Moins de structure, plus d'intelligence.",
        subtitle: "Des agents IA qui transforment vos idées en actions.",
        cta: "Commencer"
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  it: {
    translation: {
      hero: {
        title: 'Meno struttura, più intelligenza.',
        subtitle: 'Agenti IA che trasformano i tuoi pensieri in azioni.',
        cta: 'Inizia'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  'pt-BR': {
    translation: {
      hero: {
        title: 'Menos estrutura, mais inteligência.',
        subtitle: 'Agentes de IA que transformam seus pensamentos em ações.',
        cta: 'Começar'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  'pt-PT': {
    translation: {
      hero: {
        title: 'Menos estrutura, mais inteligência.',
        subtitle: 'Agentes de IA que transformam os seus pensamentos em ações.',
        cta: 'Começar'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  'zh-CN': {
    translation: {
      hero: {
        title: '更少结构，更多智能。',
        subtitle: '让AI代理将你的想法变为行动。',
        cta: '立即开始'
      },
      useCases: {
        title: '应用场景',
        subtitle: '了解 Suna 能为你做什么。',
        watchReplay: '观看回放',
        none: '暂无可用的用例。',
        'competitor-analysis': {
          title: '竞品分析',
          description: '分析我在英国医疗行业新公司的市场。请给出主要竞争者、市场规模、优劣势，并附上他们的网站链接。完成后生成 PDF 报告。'
        },
        'vc-list': {
          title: 'VC 基金列表',
          description: '请根据资产规模，列出美国最重要的风险投资基金名单，并附上他们的网站和联系方式（如有）。'
        },
        'candidate-search': {
          title: '人才搜寻',
          description: '请在 LinkedIn 上帮我找 10 位目前可用（未在职）的初级软件工程师候选人，位于德国慕尼黑，拥有计算机相关学士学位及一年以上相关经验。'
        },
        'company-trip': {
          title: '公司出行计划',
          description: '为我的公司生成一份加州出行路线规划，共 8 人，出发地为法国巴黎，行程 7 天，出发日期为 2025 年 4 月 21 日。请详细安排每日活动。'
        },
        'excel-spreadsheet': {
          title: 'Excel 表格处理',
          description: '公司让我建立一个包含意大利彩票（Lotto、10eLotto、Million Day）所有信息的 Excel 表格。请整理并发送所有公开信息。'
        },
        'speaker-prospecting': {
          title: '活动演讲嘉宾自动化搜寻',
          description: '请找出过去一年在欧洲会议上发表过演讲的 20 位 AI 伦理专家，抓取会议网站、LinkedIn 和 YouTube，输出联系方式及演讲摘要。'
        },
        'scientific-papers': {
          title: '科学论文总结与对比',
          description: '研究并对比近 5 年关于酒精对人体影响的科学论文，生成关于该主题的重要论文报告。'
        },
        'lead-generation': {
          title: '客户调研与首封邮件',
          description: '在 LinkedIn 上调研我的潜在 B2B 客户（清洁技术行业），找出他们的网站和邮箱，并根据公司资料生成个性化首封邮件。'
        },
        'seo-analysis': {
          title: 'SEO 分析',
          description: '基于我的网站 suna.so，生成 SEO 分析报告，找出按关键词聚类的高排名页面，并识别缺失主题。'
        },
        'personal-trip': {
          title: '个人旅行规划',
          description: '为我生成一份从曼谷出发前往伦敦的 10 天个人旅行计划，需在伦敦市中心预订 Google 评分不低于 4.5 的住宿。'
        },
        'funded-startups': {
          title: '新获融资初创公司',
          description: '请在 Crunchbase、Dealroom 和 TechCrunch 上筛选 SaaS 金融领域 A 轮融资公司，生成包含公司数据、创始人及联系方式的销售报告。'
        },
        'scrape-forums': {
          title: '论坛信息抓取',
          description: '我想找罗马最好的美容中心，请通过 Google 抓取相关公开论坛的讨论内容。'
        },
      },
      openSource: {
        title: '开源',
        subtitle: 'Suna 完全开源且透明。',
        repo: 'GitHub 仓库',
        mainTitle: 'Suna 核心',
        mainDesc: '驱动 Suna 的核心引擎，人人可用。',
        viewOnGithub: '在 GitHub 查看',
        transparencyTitle: '透明与社区',
        transparencyDesc: '我们相信开放开发和社区驱动的进步。',
        transparency: '透明',
        transparencySub: '所有代码均公开可审计。',
        community: '社区',
        communitySub: '加入我们不断壮大的开源社区。',
        license: '许可证',
        licenseSub: 'Apache 2.0 许可证，最大自由度。',
        publicProjects: '公开项目',
        privateProjects: '私有项目',
        teamFunctionality: '团队功能（即将推出）',
      },
      cta: {
        title: '准备好开始了吗？',
        button: '雇佣 Suna',
        subtext: '无需信用卡。'
      },
      footer: {
        description: 'Suna 是你的开源 AI 员工，由 DrPang.AI 构建。',
        links: {
          Suna: 'Suna',
          Resources: '资源',
          Documentation: '文档',
          Discord: 'Discord 社区',
          GitHub: 'GitHub',
          'Privacy Policy': '隐私政策',
          'Terms of Service': '服务条款',
          'License Apache 2.0': 'Apache 2.0 许可证',
          About: '关于',
          Contact: '联系',
          Careers: '招聘',
        },
        about: '关于',
        contact: '联系',
        careers: '招聘',
        legal: '法律',
        privacy: '隐私',
        terms: '条款',
      },
      nav: {
        Home: '首页',
        'Use Cases': '应用场景',
        'Open Source': '开源',
        Pricing: '价格',
        Dashboard: '控制台',
      },
      pricing: {
        title: '选择适合你的方案',
        subtitle: '从免费方案开始，或升级至高级方案以获得更多使用时长',
        tabs: {
          cloud: '云端',
          selfHosted: '自托管'
        },
        selectPlan: '选择方案',
        hireSuna: '雇佣 Suna',
        currentPlan: '当前方案',
        current: '当前',
        scheduled: '已排程',
        changeScheduled: '更改排程',
        downgradePending: '降级待生效',
        upgrade: '升级',
        downgrade: '降级',
        loading: '加载中...',
        popular: '热门',
        perMonth: '/月',
        customizeUsage: '自定义每月用量',
        selectAPlan: '选择一个方案',
        localMode: '本地开发模式下，计费功能已禁用',
        tiers: {
          Free: '免费',
          FreeDesc: '免费开始使用 Suna。',
          Base: '基础',
          BaseDesc: '适合个人和小型团队。',
          Pro: '专业',
          ProDesc: '适合专业人士和成长型团队。',
          Custom: '自定义',
          CustomDesc: '根据你的需求自定义方案。'
        },
        features: {
          'Unlimited agents': '不限数量的代理',
          'Priority support': '优先支持',
          'Advanced analytics': '高级分析',
          'Custom integrations': '自定义集成',
          'Team management': '团队管理',
          'API access': 'API 接口访问',
          'Public Projects': '公开项目',
          'Private projects': '私有项目',
          'Team functionality (coming soon)': '团队功能（即将推出）',
          'Unlimited seats': '无限席位',
          'Unlimited seats.': '无限席位。',
          '2 hours': '2 小时',
          '10 min': '10 分钟',
          '6 hours': '6 小时',
          '12 hours': '12 小时',
          '25 hours': '25 小时',
          '50 hours': '50 小时',
          '125 hours': '125 小时',
          '200 hours': '200 小时',
        },
        units: {
          min: '分钟',
          mins: '分钟',
          hour: '小时',
          hours: '小时',
        },
        unlimitedSeats: '无限席位。',
        hours: '{{count}} 小时',
        hoursPerMonth: '{{count}} 小时/月',
        price: '${{amount}}',
        pricePerMonth: '${{amount}}/月',
      }
    }
  },
  'zh-TW': {
    translation: {
      hero: {
        title: '更少結構，更多智能。',
        subtitle: '將你的想法變為行動的AI代理。',
        cta: '開始使用'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  ja: {
    translation: {
      hero: {
        title: 'より少ない構造、より多くの知性。',
        subtitle: 'あなたの考えを行動に変えるAIエージェント。',
        cta: '始める'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  ko: {
    translation: {
      hero: {
        title: '더 적은 구조, 더 많은 지능.',
        subtitle: '당신의 생각을 행동으로 바꾸는 AI 에이전트.',
        cta: '시작하기'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  },
  ar: {
    translation: {
      hero: {
        title: 'هيكل أقل، ذكاء أكثر.',
        subtitle: 'وكلاء الذكاء الاصطناعي الذين يحولون أفكارك إلى أفعال.',
        cta: 'ابدأ'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Suna can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Suna is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Suna Core',
        mainDesc: 'The core engine powering Suna, available for everyone.',
        viewOnGithub: 'View on GitHub',
        transparencyTitle: 'Transparency & Community',
        transparencyDesc: 'We believe in open development and community-driven progress.',
        transparency: 'Transparency',
        transparencySub: 'All code is public and auditable.',
        community: 'Community',
        communitySub: 'Join our growing open source community.',
        license: 'License',
        licenseSub: 'Apache 2.0 License for maximum freedom.'
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Suna',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Suna is your open source AI employee. Built by DrPang.AI.',
        links: {
          Product: 'Product',
          Pricing: 'Pricing',
          Docs: 'Docs',
          Blog: 'Blog',
          Company: 'Company',
          About: 'About',
          Careers: 'Careers',
          Contact: 'Contact',
          Legal: 'Legal',
          Privacy: 'Privacy',
          Terms: 'Terms'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Suna',
        currentPlan: 'Current Plan',
        current: 'Current',
        scheduled: 'Scheduled',
        changeScheduled: 'Change Scheduled',
        downgradePending: 'Downgrade Pending',
        upgrade: 'Upgrade',
        downgrade: 'Downgrade',
        loading: 'Loading...',
        popular: 'Popular',
        perMonth: '/month',
        customizeUsage: 'Customize your monthly usage',
        selectAPlan: 'Select a plan',
        localMode: 'Running in local development mode - billing features are disabled',
        tiers: {
          Free: 'Free',
          FreeDesc: 'Get started with Suna for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.'
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access'
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; 