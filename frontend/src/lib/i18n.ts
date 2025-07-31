import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const zhTranslation = {
  hero: {
    title: 'Dobby, 你的AI打工狗',
    subtitle: '让AI代理将你的想法变为行动。',
    cta: '立即开始'
  },
        useCases: {
        title: '应用场景',
        subtitle: '了解 Dobby 能为你做什么。',
        watchReplay: '观看回放',
        none: '暂无可用的用例。',
        sectionTitle: '看看 Dobby 的实际应用',
        sectionSubtitle: '探索 Dobby 如何自主完成复杂任务的真实案例'
      },
      useCaseDetails: {
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
          description: '基于我的网站 DrPang.AI，生成 SEO 分析报告，找出按关键词聚类的高排名页面，并识别缺失主题。'
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
        }
      },
  competitorAnalysis: {
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
    description: '基于我的网站 DrPang.AI，生成 SEO 分析报告，找出按关键词聚类的高排名页面，并识别缺失主题。'
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
  openSource: {
    title: '开源',
    subtitle: 'Dobby 完全开源且透明。',
    repo: 'GitHub 仓库',
    mainTitle: 'Dobby 核心',
    mainDesc: '驱动 Dobby 的核心引擎，人人可用。',
    viewOnGithub: '在 GitHub 查看',
    transparencyTitle: '透明与社区',
    transparencyDesc: '我们相信开放开发和社区驱动的进步。',
    transparency: '透明',
    transparencySub: '所有代码均公开可审计。',
    community: 'Community',
    communitySub: '加入我们不断壮大的开源社区。',
    license: '许可证',
    licenseSub: 'Apache 2.0 许可证，最大自由度。',
    publicProjects: '公开项目',
    privateProjects: '私有项目',
    teamFunctionality: '团队功能（即将推出）',
  },
  cta: {
    title: '准备好开始了吗？',
    button: '雇佣 Dobby',
    subtext: '无需信用卡。'
  },
        footer: {
        description: 'Dobby是你的AI打工狗，由庞博士提供',
        links: {
          Suna: 'Dobby',
          Pricing: '价格',
          Blog: 'Blog',
          Company: 'Company',
          About: '关于',
          Careers: '招聘',
          Contact: '联系',
          Legal: '法律声明',
          Privacy: '隐私政策',
          Terms: '服务条款',
        },
        about: '关于',
        contact: '联系',
        careers: '招聘',
        legal: '法律',
        privacy: '隐私',
        terms: '条款',
        footerSections: {
          company: '庞博士.AI',
          legal: '法律',
          about: '关于',
          contact: '联系',
          careers: '招聘',
          privacyPolicy: '隐私政策',
          termsOfService: '服务条款',
          license: 'Apache 2.0 许可证'
        }
      },
  nav: {
    Home: '首页',
    UseCases: '应用场景',
    OpenSource: '开源',
    Pricing: '价格',
    Dashboard: '仪表板',
    Community: '社区',
  },
  chatInput: {
    placeholder: '描述你需要什么帮助...',
    attachFile: '附加文件',
    start: '开始',
    stop: '停止',
    working: 'Dobby 正在工作...'
  },
  auth: {
    welcomeBack: '欢迎回来',
    signInToContinue: '登录你的账户以继续',
    orContinueWithEmail: '或继续使用电子邮件',
    signIn: '登录',
    createNewAccount: '创建新账户',
    forgotPassword: '忘记密码？',
    byContinuing: '继续即表示你同意我们的',
    termsOfService: '服务条款',
    privacyPolicy: '隐私政策',
    sendResetLink: '发送重置链接',
    cancel: '取消',
    signUp: '注册',
    backToSignIn: '返回登录',
    joinSuna: '加入 Dobby',
    createAccountAndStart: '创建你的账户并开始使用 AI',
    checkYourEmail: '检查你的电子邮件',
    confirmationSent: '我们已发送确认链接到：',
    activateAccount: '点击你电子邮件中的链接以激活你的账户。如果你没有看到电子邮件，请检查你的垃圾邮件文件夹。',
    emailAddress: '电子邮件地址',
    password: '密码',
    confirmPassword: '确认密码',
    creatingAccount: '正在创建账户...',
    signingIn: '正在登录...',
    resetPassword: '重置密码',
    backToHome: '返回首页',
    enterEmailToReset: '输入你的电子邮件地址，我们将向你发送一封电子邮件来重置你的密码。',
    invalidEmail: '请输入有效的电子邮件地址',
    passwordTooShort: '密码必须至少包含 6 个字符',
    passwordsDontMatch: '密码不匹配',
    accountCreatedCheckEmail: '账户已创建！请检查你的电子邮件以完成注册。',
    checkEmailForReset: '请检查你的电子邮件以获取密码重置链接',
    passwordUpdated: '密码已成功更新',
  },
        common: {
        close: '关闭',
        and: '和',
        loading: '加载中...',
      },
      community: {
        gallery: '社区作品展示',
        by: '作者：{{name}}',
        anonymous: '匿名',
        communitySub: '加入我们不断壮大的开源社区。',
        none: '暂无社区作品。',
        pagination: {
          previous: '上一页',
          next: '下一页'
        }
      },
      pricing: {
        tabs: {
          cloud: '云端',
          selfHosted: '自托管'
        }
      },
      billing: {
        billingPeriod: {
          monthly: '月付',
          yearly: '年付'
        }
      },
  pagination: {
    prev: '上一页',
    next: '下一页',
    page: '第{{page}}页',
  },
};

const resources = {
  en: {
    translation: {
      hero: {
        title: 'Dobby, your AI Employee.',
        subtitle: 'AI agents that turn your thoughts into actions.',
        cta: 'Get Started'
      },
      useCases: {
        title: 'Use Cases',
        subtitle: 'See what Dobby can do for you.',
        watchReplay: 'Watch Replay',
        none: 'No use cases available.',
        sectionTitle: 'See Dobby in action',
        sectionSubtitle: 'Explore real-world examples of how Dobby completes complex tasks autonomously'
      },
      useCaseDetails: {
        'competitor-analysis': {
          title: 'Competitor Analysis',
          description: 'Analyze the market for my next company in the healthcare industry, located in the UK. Give me the major players, their market size, strengths, and weaknesses, and add their website URLs. Once done, generate a PDF report.'
        },
        'vc-list': {
          title: 'VC List',
          description: 'Give me the list of the most important VC Funds in the United States based on Assets Under Management. Give me website URLs, and if possible an email to reach them out.'
        },
        'candidate-search': {
          title: 'Looking for Candidates',
          description: 'Go on LinkedIn, and find 10 profiles available - they are not working right now - for a junior software engineer position, who are located in Munich, Germany. They should have at least one bachelor\'s degree in Computer Science or anything related to it, and 1-year of experience in any field/role.'
        },
        'company-trip': {
          title: 'Company Trip Planning',
          description: 'Generate a California trip itinerary for my company, 8 people, departing from Paris, France, 7 days, departure date April 21, 2025. Please detail daily activities.'
        },
        'excel-spreadsheet': {
          title: 'Excel Spreadsheet Processing',
          description: 'My company asked me to create an Excel spreadsheet containing all information about Italian lotteries (Lotto, 10eLotto, Million Day). Please organize and send all public information.'
        },
        'speaker-prospecting': {
          title: 'Event Speaker Prospecting',
          description: 'Find 20 AI ethics experts who have spoken at European conferences in the past year, scrape conference websites, LinkedIn and YouTube, output contact information and speech summaries.'
        },
        'scientific-papers': {
          title: 'Scientific Paper Summary & Comparison',
          description: 'Research and compare scientific papers on the effects of alcohol on the human body from the past 5 years, generate a report on important papers on this topic.'
        },
        'lead-generation': {
          title: 'Lead Research & First Email',
          description: 'Research my potential B2B customers (clean tech industry) on LinkedIn, find their websites and emails, and generate personalized first emails based on company profiles.'
        },
        'seo-analysis': {
          title: 'SEO Analysis',
          description: 'Generate an SEO analysis report based on my website DrPang.AI, find high-ranking pages clustered by keywords, and identify missing topics.'
        },
        'personal-trip': {
          title: 'Personal Trip Planning',
          description: 'Generate a 10-day personal trip plan from Bangkok to London, need to book accommodation in central London with Google rating no less than 4.5.'
        },
        'funded-startups': {
          title: 'Newly Funded Startups',
          description: 'Please filter Series A funded companies in SaaS fintech on Crunchbase, Dealroom and TechCrunch, generate a sales report including company data, founders and contact information.'
        },
        'scrape-forums': {
          title: 'Forum Information Scraping',
          description: 'I want to find the best beauty center in Rome, please scrape relevant public forum discussions through Google.'
        }
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Dobby is fully open source and transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Dobby Core',
        mainDesc: 'The core engine powering Dobby, available for everyone.',
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
      community: {
        gallery: 'Community Gallery',
        by: 'By {{name}}',
        anonymous: 'Anonymous',
        communitySub: 'Join our growing open source community.',
        none: 'No community posts yet.',
        pagination: {
          previous: 'Previous',
          next: 'Next'
        }
      },
      cta: {
        title: 'Ready to get started?',
        button: 'Hire Dobby',
        subtext: 'No credit card required.'
      },
      footer: {
        description: 'Dobby is your AI employee. Provided by DrPang.AI.',
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
          Suna: 'Dobby',
        },
        about: 'About',
        contact: 'Contact',
        careers: 'Careers',
        legal: 'Legal',
        privacy: 'Privacy',
        terms: 'Terms',
        footerSections: {
          company: 'Dr.Pang.AI',
          legal: 'Legal',
          about: 'About',
          contact: 'Contact',
          careers: 'Careers',
          privacyPolicy: 'Privacy Policy',
          termsOfService: 'Terms of Service',
          license: 'License Apache 2.0'
        }
      },
      pricing: {
        title: 'Choose the right plan for your needs',
        subtitle: 'Start with our free plan or upgrade to a premium plan for more usage hours',
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted',
        },
        selectPlan: 'Select Plan',
        hireSuna: 'Hire Dobby',
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
          FreeDesc: 'Get started with Dobby for free.',
          Base: 'Base',
          BaseDesc: 'For individuals and small teams.',
          Pro: 'Pro',
          ProDesc: 'For professionals and growing teams.',
          Custom: 'Custom',
          CustomDesc: 'Customize your plan to fit your needs.',
        },
        features: {
          'Unlimited agents': 'Unlimited agents',
          'Priority support': 'Priority support',
          'Advanced analytics': 'Advanced analytics',
          'Custom integrations': 'Custom integrations',
          'Team management': 'Team management',
          'API access': 'API access',
        },
        webCrawl: {
          success: 'Success',
          failed: 'Failed',
          openUrl: 'Open URL',
          unknown: 'Unknown',
          crawling: 'Crawling webpage...',
          fetching: 'Fetching content from {{domain}}',
          pageContent: 'Page Content',
          noContent: 'No content extracted',
          restricted: 'The webpage might be restricted or empty',
          completed: '{{tool}} completed successfully',
          failedOperation: '{{tool}} operation failed',
          executing: 'Executing',
        },
        '30mins': '30 mins',
      },
      billing: {
        status: 'Billing Status',
        usageThisMonth: "This Month's Agent Usage",
        manage: 'Manage Subscription',
        minutes: 'minutes',
        localMode: 'Running in local development mode - billing features are disabled',
        noLimits: 'Agent usage limits are not enforced in this environment',
        errorLoading: 'Error loading billing status',
        loading: 'Loading...',
        subscription: 'Subscription',
        prepaidTab: 'Prepaid (WeChat & AliPay supported)',
        topUp: 'Top Up Credits',
        prepaidCredits: 'Prepaid Credits',
        selectAmount: 'Select Credit Package',
        selectPayment: 'Select Payment Method',
        cancel: 'Cancel',
        payNow: 'Pay Now',
        chooseAmount: 'Please select a credit package and payment method',
        '1hour': '1 hour',
        '5hours': '5 hours',
        '10hours': '10 hours',
        alipay: 'AliPay',
        wechatpay: 'WeChat Pay',
        card: 'Credit/Debit Card',
        errorRedirect: 'Failed to redirect to payment page',
        subscriptionUpgradeInfo: 'When you upgrade, you only pay the difference.',
        usageLimitReached: 'Usage Limit Reached',
        usageLimitMessage: 'Monthly limit of 360 minutes reached and no prepaid credits available. Please upgrade your plan or top up credits.',
        dismiss: 'Dismiss',
        upgradePlan: 'Upgrade Plan',
        paymentRequired: 'Payment Required',
        noActiveSubscription: 'No active subscription or prepaid credits found.',
        '30mins': '30 mins',
        billingPeriod: {
          monthly: 'Monthly',
          yearly: 'Yearly'
        }
      },
      sidebar: {
        agents: 'Agents',
        newAgent: 'New Agent',
        tooltipNewAgent: 'Create a new agent',
        noAgents: 'No agents yet',
        toggleSidebar: 'Toggle sidebar (CMD+B)',
        expandSidebar: 'Expand sidebar (CMD+B)',
      },
      agentDetail: {
        streamError: 'Agent stream error',
        loadError: 'Failed to load thread',
        cannotViewDetails: 'Cannot view details: Assistant message ID is missing.',
        couldNotFindDetails: 'Could not find details for this tool call.',
        sendAMessage: 'Send a message to start.',
        inputPlaceholder: 'Type your message...',
        noToolCallDetails: 'No tool call details available.',
      },
      communityShare: {
        sharing: 'Sharing...',
        shared: 'Shared to community!',
        tooltip: 'Share to Community (recommended)\nShare your work with the Dobby community!',
        popupBlocked: 'Could not open new tab. Please allow pop-ups for this site.',
        generating: 'Generating share link, please wait...'
      },
      communityPost: {
        copyLink: 'Copy link',
        attribution: 'Generated by Dobby',
      },
      chatInput: {
        placeholder: 'Describe what you need help with...',
        attachFile: 'Attach file',
        start: 'Start',
        stop: 'Stop',
        working: 'Dobby is working...'
      },
      editor: {
        preview: 'Preview',
        code: 'Code',
        open: 'Open',
        edit: 'Edit',
        save: 'Save',
        discard: 'Discard',
      },
      sandboxModal: {
        title: 'Sandbox Deleted',
        deleted: 'This project\'s sandbox has been deleted.',
        lost: 'All files and data are permanently lost.',
        recovery: 'We will create a new sandbox for you to continue your work.',
        recommend: 'We recommend starting a new project for best results.',
      },
      common: {
        close: 'Close',
        and: 'and',
        loading: 'Loading...',
      },
      nav: {
        Home: 'Home',
        UseCases: 'Use Cases',
        OpenSource: 'Open Source',
        Pricing: 'Pricing',
        Dashboard: 'Dashboard',
        Community: 'Community',
      },
      pagination: {
        prev: 'Previous',
        next: 'Next',
        page: 'Page {{page}}',
      },
      settings: {
        billing: 'Billing',
      },
      teamSettings: {
        billing: 'Billing',
      },
    }
  },
  'zh-CN': {
    translation: zhTranslation,
  },
  zh: {
    translation: zhTranslation,
  },
  'zh-TW': {
    translation: {
      hero: {
        title: 'Dobby, 你的AI打工狗',
        subtitle: '讓AI代理將你的想法變為行動。',
        cta: '立即開始'
      },
      useCases: {
        title: '應用場景',
        subtitle: '了解 Dobby 能為你做什麼。',
        watchReplay: '觀看回放',
        none: '暫無可用的用例。',
        sectionTitle: '看看 Dobby 的實際應用',
        sectionSubtitle: '探索 Dobby 如何自主完成複雜任務的真實案例'
      },
      openSource: {
        title: '開源',
        subtitle: 'Dobby 完全開源且透明。',
        repo: 'GitHub 倉庫',
        mainTitle: 'Dobby 核心',
        mainDesc: '驅動 Dobby 的核心引擎，人人可用。',
        viewOnGithub: '在 GitHub 查看',
        transparencyTitle: '透明與社區',
        transparencyDesc: '我們相信開放開發和社區驅動的進步。',
        transparency: '透明',
        transparencySub: '所有代碼均公開可審計。',
        community: 'Community',
        communitySub: '加入我們不斷壯大的開源社區。',
        license: '許可證',
        licenseSub: 'Apache 2.0 許可證，最大自由度。',
        publicProjects: '公開項目',
        privateProjects: '私有項目',
        teamFunctionality: '團隊功能（即將推出）',
      },
      cta: {
        title: '準備好開始了嗎？',
        button: '僱傭 Dobby',
        subtext: '無需信用卡。'
      },
      footer: {
        description: 'Dobby是你的AI打工狗，由龐博士提供',
        links: {
          Suna: 'Dobby',
          Pricing: '價格',
          Blog: 'Blog',
          Company: 'Company',
          About: '關於',
          Careers: '招聘',
          Contact: '聯繫',
          Legal: '法律聲明',
          Privacy: '隱私政策',
          Terms: '服務條款',
        },
        about: '關於',
        contact: '聯繫',
        careers: '招聘',
        legal: '法律',
        privacy: '隱私',
        terms: '條款',
        footerSections: {
          company: '龐博士.AI',
          legal: '法律',
          about: '關於',
          contact: '聯繫',
          careers: '招聘',
          privacyPolicy: '隱私政策',
          termsOfService: '服務條款',
          license: 'Apache 2.0 許可證'
        }
      },
      pricing: {
        tabs: {
          cloud: '雲端',
          selfHosted: '自託管'
        }
      },
      billing: {
        billingPeriod: {
          monthly: '月付',
          yearly: '年付'
        }
      },
      nav: {
        Home: '首頁',
        UseCases: '應用場景',
        OpenSource: '開源',
        Pricing: '價格',
        Dashboard: '儀表板',
        Community: '社區',
      },
      chatInput: {
        placeholder: '描述你需要什麼幫助...',
        attachFile: '附加文件',
        start: '開始',
        stop: '停止',
        working: 'Dobby 正在工作...'
      },
      auth: {
        welcomeBack: '歡迎回來',
        signInToContinue: '登錄你的帳戶以繼續',
        orContinueWithEmail: '或繼續使用電子郵件',
        signIn: '登錄',
        createNewAccount: '創建新帳戶',
        forgotPassword: '忘記密碼？',
        byContinuing: '繼續即表示你同意我們的',
        termsOfService: '服務條款',
        privacyPolicy: '隱私政策',
        sendResetLink: '發送重置鏈接',
        cancel: '取消',
        signUp: '註冊',
        backToSignIn: '返回登錄',
        joinSuna: '加入 Dobby',
        createAccountAndStart: '創建你的帳戶並開始使用 AI',
        checkYourEmail: '檢查你的電子郵件',
        confirmationSent: '我們已發送確認鏈接到：',
        activateAccount: '點擊你電子郵件中的鏈接以激活你的帳戶。如果你沒有看到電子郵件，請檢查你的垃圾郵件文件夾。',
        emailAddress: '電子郵件地址',
        password: '密碼',
        confirmPassword: '確認密碼',
        creatingAccount: '正在創建帳戶...',
        signingIn: '正在登錄...',
        resetPassword: '重置密碼',
        backToHome: '返回首頁',
        enterEmailToReset: '輸入你的電子郵件地址，我們將向你發送一封電子郵件來重置你的密碼。',
        invalidEmail: '請輸入有效的電子郵件地址',
        passwordTooShort: '密碼必須至少包含 6 個字符',
        passwordsDontMatch: '密碼不匹配',
        accountCreatedCheckEmail: '帳戶已創建！請檢查你的電子郵件以完成註冊。',
        checkEmailForReset: '請檢查你的電子郵件以獲取密碼重置鏈接',
        passwordUpdated: '密碼已成功更新',
      },
      common: {
        close: '關閉',
        and: '和',
        loading: '載入中...',
      },
      community: {
        gallery: '社區作品展示',
        by: '作者：{{name}}',
        anonymous: '匿名',
        communitySub: '加入我們不斷壯大的開源社區。',
        none: '暫無社區作品。',
        pagination: {
          previous: '上一頁',
          next: '下一頁'
        }
      },
    }
  },
  de: {
    translation: {
      hero: {
        title: 'Dobby, dein KI-Mitarbeiter.',
        subtitle: 'KI-Agenten, die deine Gedanken in Taten umsetzen.',
        cta: 'Loslegen'
      },
      useCases: {
        title: 'Anwendungsfälle',
        subtitle: 'Sieh, was Dobby für dich tun kann.',
        watchReplay: 'Wiedergabe ansehen',
        none: 'Keine Anwendungsfälle verfügbar.'
      },
      openSource: {
        title: 'Open Source',
        subtitle: 'Dobby ist vollständig Open Source und transparent.',
        repo: 'GitHub Repository',
        mainTitle: 'Dobby Core',
        mainDesc: 'Die Kern-Engine, die Dobby antreibt, verfügbar für alle.',
        viewOnGithub: 'Auf GitHub ansehen',
        transparencyTitle: 'Transparenz & Community',
        transparencyDesc: 'Wir glauben an offene Entwicklung und communitygetriebenen Fortschritt.',
        transparency: 'Transparenz',
        transparencySub: 'Aller Code ist öffentlich und überprüfbar.',
        community: 'Community',
        communitySub: 'Tritt unserer wachsenden Open-Source-Community bei.',
        license: 'Lizenz',
        licenseSub: 'Apache 2.0 Lizenz für maximale Freiheit.'
      },
      cta: {
        title: 'Bereit loszulegen?',
        button: 'Dobby einstellen',
        subtext: 'Keine Kreditkarte erforderlich.'
      },
      footer: {
        description: 'Dobby ist dein KI-Mitarbeiter. Bereitgestellt von DrPang.AI.',
        links: {
          Product: 'Produkt',
          Pricing: 'Preise',
          Docs: 'Dokumentation',
          Blog: 'Blog',
          Company: 'Unternehmen',
          About: 'Über uns',
          Careers: 'Karriere',
          Contact: 'Kontakt',
          Legal: 'Rechtliches',
          Privacy: 'Datenschutz',
          Terms: 'AGB',
          Suna: 'Dobby',
        },
        about: 'Über uns',
        contact: 'Kontakt',
        careers: 'Karriere',
        legal: 'Rechtliches',
        privacy: 'Datenschutz',
        terms: 'AGB',
        footerSections: {
          company: 'Dr.Pang.AI',
          legal: 'Rechtliches',
          about: 'Über uns',
          contact: 'Kontakt',
          careers: 'Karriere',
          privacyPolicy: 'Datenschutzrichtlinie',
          termsOfService: 'Nutzungsbedingungen',
          license: 'Apache 2.0 Lizenz'
        }
      },
      pricing: {
        tabs: {
          cloud: 'Cloud',
          selfHosted: 'Self-hosted'
        }
      },
      billing: {
        billingPeriod: {
          monthly: 'Monatlich',
          yearly: 'Jährlich'
        }
      },
      nav: {
        Home: 'Startseite',
        UseCases: 'Anwendungsfälle',
        OpenSource: 'Open Source',
        Pricing: 'Preise',
        Dashboard: 'Dashboard',
        Community: 'Community',
      },
      chatInput: {
        placeholder: 'Beschreibe, wobei du Hilfe brauchst...',
        attachFile: 'Datei anhängen',
        start: 'Start',
        stop: 'Stop',
        working: 'Dobby arbeitet...'
      },
      auth: {
        welcomeBack: 'Willkommen zurück',
        signInToContinue: 'Melde dich in deinem Konto an, um fortzufahren',
        orContinueWithEmail: 'oder mit E-Mail fortfahren',
        signIn: 'Anmelden',
        createNewAccount: 'Neues Konto erstellen',
        forgotPassword: 'Passwort vergessen?',
        byContinuing: 'Durch Fortfahren stimmst du unseren',
        termsOfService: 'Nutzungsbedingungen',
        privacyPolicy: 'Datenschutzrichtlinie',
        sendResetLink: 'Reset-Link senden',
        cancel: 'Abbrechen',
        signUp: 'Registrieren',
        backToSignIn: 'Zurück zur Anmeldung',
        joinSuna: 'Dobby beitreten',
        createAccountAndStart: 'Erstelle dein Konto und beginne mit der Nutzung von KI',
        checkYourEmail: 'Überprüfe deine E-Mails',
        confirmationSent: 'Wir haben einen Bestätigungslink gesendet an:',
        activateAccount: 'Klicke auf den Link in deiner E-Mail, um dein Konto zu aktivieren. Falls du die E-Mail nicht siehst, überprüfe deinen Spam-Ordner.',
        emailAddress: 'E-Mail-Adresse',
        password: 'Passwort',
        confirmPassword: 'Passwort bestätigen',
        creatingAccount: 'Konto wird erstellt...',
        signingIn: 'Anmeldung läuft...',
        resetPassword: 'Passwort zurücksetzen',
        backToHome: 'Zurück zur Startseite',
        enterEmailToReset: 'Gib deine E-Mail-Adresse ein und wir senden dir eine E-Mail zum Zurücksetzen des Passworts.',
        invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein',
        passwordTooShort: 'Passwort muss mindestens 6 Zeichen lang sein',
        passwordsDontMatch: 'Passwörter stimmen nicht überein',
        accountCreatedCheckEmail: 'Konto erstellt! Bitte überprüfe deine E-Mails, um die Registrierung abzuschließen.',
        checkEmailForReset: 'Bitte überprüfe deine E-Mails für den Passwort-Reset-Link',
        passwordUpdated: 'Passwort erfolgreich aktualisiert',
      },
      common: {
        close: 'Schließen',
        and: 'und',
        loading: 'Laden...',
      },
      community: {
        gallery: 'Community Galerie',
        by: 'Von {{name}}',
        anonymous: 'Anonym',
        communitySub: 'Tritt unserer wachsenden Open-Source-Community bei.',
        none: 'Noch keine Community-Beiträge.',
        pagination: {
          previous: 'Zurück',
          next: 'Weiter'
        }
      },
    }
  },
  es: {
    translation: {
      hero: {
        title: 'Dobby, tu empleado de IA.',
        subtitle: 'Agentes de IA que convierten tus pensamientos en acciones.',
        cta: 'Comenzar'
      },
      useCases: {
        title: 'Casos de uso',
        subtitle: 'Ve qué puede hacer Dobby por ti.',
        watchReplay: 'Ver reproducción',
        none: 'No hay casos de uso disponibles.'
      },
      openSource: {
        title: 'Código abierto',
        subtitle: 'Dobby es completamente de código abierto y transparente.',
        repo: 'Repositorio GitHub',
        mainTitle: 'Dobby Core',
        mainDesc: 'El motor central que impulsa Dobby, disponible para todos.',
        viewOnGithub: 'Ver en GitHub',
        transparencyTitle: 'Transparencia y Comunidad',
        transparencyDesc: 'Creemos en el desarrollo abierto y el progreso impulsado por la comunidad.',
        transparency: 'Transparencia',
        transparencySub: 'Todo el código es público y auditable.',
        community: 'Comunidad',
        communitySub: 'Únete a nuestra creciente comunidad de código abierto.',
        license: 'Licencia',
        licenseSub: 'Licencia Apache 2.0 para máxima libertad.'
      },
      cta: {
        title: '¿Listo para comenzar?',
        button: 'Contratar Dobby',
        subtext: 'No se requiere tarjeta de crédito.'
      },
      footer: {
        description: 'Dobby es tu empleado de IA. Proporcionado por DrPang.AI.',
        links: {
          Product: 'Producto',
          Pricing: 'Precios',
          Docs: 'Documentación',
          Blog: 'Blog',
          Company: 'Empresa',
          About: 'Acerca de',
          Careers: 'Carreras',
          Contact: 'Contacto',
          Legal: 'Legal',
          Privacy: 'Privacidad',
          Terms: 'Términos',
          Suna: 'Dobby',
        },
        about: 'Acerca de',
        contact: 'Contacto',
        careers: 'Carreras',
        legal: 'Legal',
        privacy: 'Privacidad',
        terms: 'Términos',
        footerSections: {
          company: 'Dr.Pang.AI',
          legal: 'Legal',
          about: 'Acerca de',
          contact: 'Contacto',
          careers: 'Carreras',
          privacyPolicy: 'Política de Privacidad',
          termsOfService: 'Términos de Servicio',
          license: 'Licencia Apache 2.0'
        }
      },
      pricing: {
        tabs: {
          cloud: 'Nube',
          selfHosted: 'Auto-hospedado'
        }
      },
      billing: {
        billingPeriod: {
          monthly: 'Mensual',
          yearly: 'Anual'
        }
      },
      nav: {
        Home: 'Inicio',
        UseCases: 'Casos de uso',
        OpenSource: 'Código abierto',
        Pricing: 'Precios',
        Dashboard: 'Panel',
        Community: 'Comunidad',
      },
      chatInput: {
        placeholder: 'Describe en qué necesitas ayuda...',
        attachFile: 'Adjuntar archivo',
        start: 'Iniciar',
        stop: 'Detener',
        working: 'Dobby está trabajando...'
      },
      auth: {
        welcomeBack: 'Bienvenido de vuelta',
        signInToContinue: 'Inicia sesión en tu cuenta para continuar',
        orContinueWithEmail: 'o continúa con email',
        signIn: 'Iniciar sesión',
        createNewAccount: 'Crear nueva cuenta',
        forgotPassword: '¿Olvidaste tu contraseña?',
        byContinuing: 'Al continuar, aceptas nuestros',
        termsOfService: 'Términos de Servicio',
        privacyPolicy: 'Política de Privacidad',
        sendResetLink: 'Enviar enlace de restablecimiento',
        cancel: 'Cancelar',
        signUp: 'Registrarse',
        backToSignIn: 'Volver a iniciar sesión',
        joinSuna: 'Unirse a Dobby',
        createAccountAndStart: 'Crea tu cuenta y comienza a usar IA',
        checkYourEmail: 'Revisa tu email',
        confirmationSent: 'Enviamos un enlace de confirmación a:',
        activateAccount: 'Haz clic en el enlace en tu email para activar tu cuenta. Si no ves el email, revisa tu carpeta de spam.',
        emailAddress: 'Dirección de email',
        password: 'Contraseña',
        confirmPassword: 'Confirmar contraseña',
        creatingAccount: 'Creando cuenta...',
        signingIn: 'Iniciando sesión...',
        resetPassword: 'Restablecer contraseña',
        backToHome: 'Volver al inicio',
        enterEmailToReset: 'Ingresa tu dirección de email y te enviaremos un email para restablecer tu contraseña.',
        invalidEmail: 'Por favor ingresa una dirección de email válida',
        passwordTooShort: 'La contraseña debe tener al menos 6 caracteres',
        passwordsDontMatch: 'Las contraseñas no coinciden',
        accountCreatedCheckEmail: '¡Cuenta creada! Por favor revisa tu email para completar el registro.',
        checkEmailForReset: 'Por favor revisa tu email para el enlace de restablecimiento de contraseña',
        passwordUpdated: 'Contraseña actualizada exitosamente',
      },
      common: {
        close: 'Cerrar',
        and: 'y',
        loading: 'Cargando...',
      },
      community: {
        gallery: 'Galería de la Comunidad',
        by: 'Por {{name}}',
        anonymous: 'Anónimo',
        communitySub: 'Únete a nuestra creciente comunidad de código abierto.',
        none: 'Aún no hay publicaciones de la comunidad.',
        pagination: {
          previous: 'Anterior',
          next: 'Siguiente'
        }
      },
    }
  },
};

function getCookieLang() {
  if (typeof document !== 'undefined') {
    // Client: read cookie
    const match = document.cookie.match(/(?:^|; )i18next=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

let initialized = false;

export function initI18n(langFromHeader?: string) {
  if (initialized) return i18n;
  let lng = langFromHeader || getCookieLang() || 'en';
  if (typeof window !== 'undefined') {
    // Fallback to localStorage if cookie not set
    lng = getCookieLang() || localStorage.getItem('i18nextLng') || 'en';
  }
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false
      }
    });
  initialized = true;
  return i18n;
}

export default i18n; 