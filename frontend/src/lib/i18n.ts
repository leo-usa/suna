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
      },
      billing: {
        status: 'Billing Status',
        usageThisMonth: 'Agent Usage This Month',
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
      },
      sidebar: {
        agents: 'Agents',
        newAgent: 'New Agent',
        tooltipNewAgent: 'Create a new agent',
      },
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
      },
      billing: {
        status: 'Facturación',
        usageThisMonth: 'Uso del agente este mes',
        manage: 'Administrar suscripción',
        minutes: 'minutos',
        localMode: 'Running in local development mode - billing features are disabled',
        noLimits: 'Agent usage limits are not enforced in this environment',
        errorLoading: 'Error loading billing status',
        loading: 'Loading...',
        subscription: 'Suscripción',
        prepaidTab: 'Prepago (WeChat & AliPay soportado)',
      },
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
      },
      billing: {
        status: '账单状态',
        usageThisMonth: '本月代理用量',
        manage: '管理订阅',
        minutes: '分钟',
        localMode: '本地开发模式下，计费功能已禁用',
        noLimits: '本环境下不限制代理用量',
        errorLoading: '加载账单状态出错',
        loading: '加载中...',
        subscription: '订阅',
        prepaidTab: '预付（支持微信，支付宝）',
        topUp: '充值时长',
        prepaidCredits: '预付费时长',
        selectAmount: '选择时长套餐',
        selectPayment: '选择支付方式',
        cancel: '取消',
        payNow: '立即支付',
        chooseAmount: '请选择充值时长和支付方式',
        '1hour': '1小时',
        '5hours': '5小时',
        '10hours': '10小时',
        alipay: '支付宝',
        wechatpay: '微信支付',
        card: '信用卡/借记卡',
        errorRedirect: '跳转到支付页面失败',
      },
      authReset: {
        passwordResetComplete: '密码重置完成',
        success: '你的密码已成功更新。你现在可以使用新密码登录。',
        goToSignIn: '前往登录',
        backToSignIn: '返回登录',
        resetPassword: '重置密码',
        createNewPassword: '为你的账户创建新密码',
        newPassword: '新密码',
        confirmNewPassword: '确认新密码',
        updatingPassword: '正在更新密码...',
        returnToSignIn: '返回登录',
      },
      auth: {
        welcomeBack: '欢迎回来',
        signInToContinue: '登录你的账户以继续',
        orContinueWithEmail: '或使用邮箱继续',
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
        joinSuna: '加入 Suna',
        createAccountAndStart: '创建你的账户并开始使用 AI',
        checkYourEmail: '请查收你的邮箱',
        confirmationSent: '我们已向以下邮箱发送确认链接：',
        activateAccount: '点击邮件中的链接以激活你的账户。如果没有收到邮件，请检查垃圾箱。',
        emailAddress: '邮箱地址',
        password: '密码',
        confirmPassword: '确认密码',
        creatingAccount: '正在创建账户...',
        signingIn: '正在登录...',
        resetPassword: '重置密码',
        backToHome: '返回首页',
        enterEmailToReset: '请输入你的邮箱地址，我们会发送一封重置密码的邮件给你。',
      },
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
        webCrawl: {
          success: '成功',
          failed: '失败',
          openUrl: '打开网址',
          unknown: '未知',
          crawling: '正在抓取网页…',
          fetching: '正在从{{domain}}获取内容',
          pageContent: '页面内容',
          noContent: '未提取到内容',
          restricted: '网页可能受限或为空',
          completed: '{{tool}}已成功完成',
          failedOperation: '{{tool}}操作失败',
          executing: '正在执行',
        },
        status: '账单状态',
        usageThisMonth: '本月代理用量',
        manage: '管理订阅',
        minutes: '分钟',
      },
      dashboard: {
        greeting: '你好',
        subtitle: '你今天想让 Suna 做什么？',
        inputPlaceholder: '描述你需要帮助的内容……',
        openMenu: '打开菜单',
      },
      agents: {
        title: '你的智能体',
        subtitle: '创建和管理你的 AI 智能体',
        newAgent: '新建智能体',
        emptyTitle: '还没有智能体',
        emptyDescription: '创建你的第一个智能体，开始自动化任务并获得 AI 帮助。',
        createFirst: '创建你的第一个智能体',
        continue: '继续对话',
        noDescription: '暂无描述',
      },
      teamBilling: {
        error: '错误',
        loading: '加载中...',
        accessDenied: '拒绝访问',
        noPermission: '你没有权限访问此页面。',
        title: '团队账单',
        manage: '管理你的团队订阅和账单详情。',
      },
      teamMembers: {
        loading: '加载中...',
        error: '错误',
        accessDenied: '拒绝访问',
        noPermission: '你没有权限访问此页面。',
        title: '团队成员',
        manage: '管理你的团队成员和邀请。',
        invitations: '邀请',
        inviteNew: '邀请新成员加入你的团队。',
        members: '成员',
        manageExisting: '管理现有团队成员。',
      },
      teamSettings: {
        loading: '加载中...',
        accountNotFound: '未找到账户',
        title: '团队设置',
        manageDetails: '管理你的团队账户详情。',
        account: '账户',
        members: '成员',
        billing: '账单',
        teamName: '团队名称',
        updateTeamName: '更新你的团队名称。',
        teamUrl: '团队网址',
        updateTeamUrl: '更新你的团队网址标识。',
      },
      teamInvitations: {
        roleLabel: '团队角色',
        rolePlaceholder: '成员类型',
        'role.owner': '所有者',
        'role.member': '成员',
        creating: '正在创建...',
        create: '创建邀请',
      },
      toolView: {
        completed: '成功完成',
        failed: '执行失败',
        processing: '处理中...',
        output: '输出',
        executing: '正在执行',
      },
      fileOperation: {
        created: '文件创建成功',
        rewritten: '文件重写成功',
        deleted: '文件删除成功',
        failed: '文件操作失败',
        processing: '正在处理文件操作…',
        fileDeleted: '文件已删除',
        permanentlyRemoved: '该文件已被永久删除',
        deleting: '正在删除文件…',
        unknownFilePath: '未知文件路径',
        deletedButUnknown: '文件已被删除，但无法确定路径',
        code: '代码',
        preview: '预览',
        openInBrowser: '在浏览器中打开',
        creating: '正在创建文件…',
        rewriting: '正在重写文件…',
      },
      webScrape: {
        success: '成功',
        failed: '失败',
        openUrl: '打开网址',
        unknown: '未知',
        scraping: '正在抓取网页…',
        fetching: '正在从{{domain}}获取内容',
        pageContent: '页面内容',
        noContent: '未提取到内容',
        restricted: '网页可能受限或为空',
        completed: '{{tool}}已成功完成',
        failedOperation: '{{tool}}操作失败',
        executing: '正在执行',
      },
      webSearch: {
        success: '成功',
        failed: '失败',
        completed: '{{tool}}已成功完成',
        failedOperation: '{{tool}}操作失败',
        executing: '正在执行',
        searching: '正在搜索网页…',
        mightTakeAMoment: '这可能需要一些时间',
        foundResults: '找到 {{count}} 个结果',
        noResults: '未找到结果',
        tryRefining: '请尝试优化你的搜索关键词',
        unknownQuery: '未知查询',
      },
      notFound: {
        error404: '404 错误',
        pageNotFound: '页面未找到',
        description: '你要找的页面不存在或已被移动。',
        returnHome: '返回首页',
      },
      authReset: {
        passwordResetComplete: '密码重置完成',
        success: '你的密码已成功更新。你现在可以使用新密码登录。',
        goToSignIn: '前往登录',
        backToSignIn: '返回登录',
        resetPassword: '重置密码',
        createNewPassword: '为你的账户创建新密码',
        newPassword: '新密码',
        confirmNewPassword: '确认新密码',
        updatingPassword: '正在更新密码...',
        returnToSignIn: '返回登录',
      },
      chatInput: {
        placeholder: '描述你需要帮助的内容……',
        attachFile: '附加文件',
        stop: '停止',
        working: 'Kortix Suna 正在工作……',
      },
      threadHeader: {
        viewFiles: '查看任务文件',
        copyLink: '复制链接',
        toggleComputer: '切换电脑预览（CMD+I）',
        downloadAll: '下载所有项目文件。请及时下载你的文件——如果沙盒被删除，文件将丢失。',
      },
      fileViewer: {
        workspaceFiles: '工作区文件',
        goHome: '返回主目录',
        home: '主目录',
        dirEmpty: '目录为空',
        upload: '上传',
        loadingFile: '正在加载文件…',
        errorLoading: '文件加载出错',
        retry: '重试',
        backToFiles: '返回文件列表',
        download: '下载',
        exportPdf: '导出为 PDF',
        portrait: '纵向',
        landscape: '横向',
      },
      userMenu: {
        personalAccount: '个人账户',
        teams: '团队',
        addTeam: '添加团队',
        createTeam: '创建新团队',
        createTeamDesc: '创建团队以便与他人协作。',
        billing: '账单',
        theme: '主题',
        logout: '退出登录',
      },
      rightPanel: {
        title: 'Suna 的电脑',
        createFile: '创建文件',
        success: '成功',
        failed: '失败',
        output: '输出',
        executing: '正在执行',
        processing: '处理中...',
        completed: '已成功完成',
        failedOperation: '操作失败',
        unableToDisplay: '无法显示工具详情。',
        stepOf: '第 {{current}} 步，共 {{total}} 步',
        createfile: '创建文件',
        noToolCallDetails: '暂无工具调用详情',
        previous: '上一步',
        next: '下一步',
      },
      toolTitles: {
        webScrape: '网页抓取',
        scrapeWebpage: '网页抓取',
        webSearch: '网页搜索',
        crawlWebpage: '网页爬取',
        executeCommand: '执行命令',
        strReplace: '字符串替换',
        createFile: '创建文件',
        fullFileRewrite: '重写文件',
        deleteFile: '删除文件',
        browserNavigate: '浏览器导航',
        browserClick: '浏览器点击',
        browserExtract: '浏览器提取',
        browserFill: '浏览器填写',
        browserWait: '浏览器等待',
      },
      sidebar: {
        agents: '智能体',
        newAgent: '新建智能体',
        tooltipNewAgent: '新建智能体',
        menu: '菜单',
        dashboard: '控制台',
        settings: {
          billing: '账单',
        },
        members: '成员',
        invitations: '邀请',
        logout: '退出登录',
        account: '账户',
        profile: '个人资料',
        userMenu: '用户菜单',
        more: '更多',
        copyLink: '复制链接',
        copyLinkSuccess: '链接已复制',
        openInNewTab: '在新标签页中打开',
        delete: '删除',
        deleting: '正在删除…',
        deleteConfirm: '确定要删除此项目及其沙盒吗？此操作无法撤销。',
        deleteSuccess: '项目删除成功',
        deleteError: '删除项目失败',
        enterpriseDemo: '企业演示',
        enterpriseDemoDesc: '为您的公司定制 AI 员工',
        scheduleDemo: '预约演示',
        joinTeam: '加入我们团队！🚀',
        learnMore: '了解更多',
        customAIEmployees: '为您的企业定制 AI 员工',
        customAIEmployeesDesc: '基于您员工的数据为企业创建专属 AI 员工。',
        record: '记录',
        train: '训练',
        automate: '自动化',
        recordDesc: '我们记录员工的工作以了解其流程和任务。',
        trainDesc: 'AI 基于收集到的数据学习任务和决策过程。',
        automateDesc: 'AI 代理自动化原本由人类完成的任务，并持续学习和改进。',
        keyBenefits: '主要优势',
        benefitReduceCost: '降低运营成本',
        benefitIncreaseEfficiency: '提升工作效率',
        benefitImproveAccuracy: '提高任务准确性',
        benefitScale: '无缝扩展运营',
        benefit247: '全天候生产力',
        addWeChatEN: 'Add DrLeoPang in WeChat',
        addWeChatCN: '加庞博士微信：DrLeoPang',
      },
      billing: {
        status: '账单状态',
        usageThisMonth: '本月代理用量',
        manage: '管理订阅',
        minutes: '分钟',
        localMode: '本地开发模式下，计费功能已禁用',
        noLimits: '本环境下不限制代理用量',
        errorLoading: '加载账单状态出错',
        loading: '加载中...',
        subscription: '订阅',
        prepaidTab: '预付（支持微信，支付宝）',
        topUp: '充值时长',
        prepaidCredits: '预付费时长',
        selectAmount: '选择时长套餐',
        selectPayment: '选择支付方式',
        cancel: '取消',
        payNow: '立即支付',
        chooseAmount: '请选择充值时长和支付方式',
        '1hour': '1小时',
        '5hours': '5小时',
        '10hours': '10小时',
        alipay: '支付宝',
        wechatpay: '微信支付',
        card: '信用卡/借记卡',
        errorRedirect: '跳转到支付页面失败',
      },
      auth: {
        welcomeBack: '欢迎回来',
        signInToContinue: '登录你的账户以继续',
        orContinueWithEmail: '或使用邮箱继续',
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
        joinSuna: '加入 Suna',
        createAccountAndStart: '创建你的账户并开始使用 AI',
        checkYourEmail: '请查收你的邮箱',
        confirmationSent: '我们已向以下邮箱发送确认链接：',
        activateAccount: '点击邮件中的链接以激活你的账户。如果没有收到邮件，请检查垃圾箱。',
        emailAddress: '邮箱地址',
        password: '密码',
        confirmPassword: '确认密码',
        creatingAccount: '正在创建账户...',
        signingIn: '正在登录...',
        resetPassword: '重置密码',
        backToHome: '返回首页',
        enterEmailToReset: '请输入你的邮箱地址，我们会发送一封重置密码的邮件给你。',
      },
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
      }
    }
  }
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