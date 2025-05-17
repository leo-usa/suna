module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: [
      'en',
      'de',
      'es',
      'fr',
      'it',
      'pt-BR',
      'pt-PT',
      'zh',
      'zh-TW',
      'ja',
      'ko',
      'ar',
    ],
  },
  localePath: typeof window === 'undefined' ? require('path').resolve('./locales') : '/locales',
}; 