import 'server-only';

const dictionaries = {
  en: () => import('../../../locales/en/common.json').then((module) => module.default),
  de: () => import('../../../locales/de/common.json').then((module) => module.default),
  es: () => import('../../../locales/es/common.json').then((module) => module.default),
  fr: () => import('../../../locales/fr/common.json').then((module) => module.default),
  it: () => import('../../../locales/it/common.json').then((module) => module.default),
  'pt-BR': () => import('../../../locales/pt-BR/common.json').then((module) => module.default),
  'pt-PT': () => import('../../../locales/pt-PT/common.json').then((module) => module.default),
  zh: () => import('../../../locales/zh/common.json').then((module) => module.default),
  'zh-TW': () => import('../../../locales/zh-TW/common.json').then((module) => module.default),
  ja: () => import('../../../locales/ja/common.json').then((module) => module.default),
  ko: () => import('../../../locales/ko/common.json').then((module) => module.default),
  ar: () => import('../../../locales/ar/common.json').then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  const loader = dictionaries[locale as keyof typeof dictionaries] || dictionaries.en;
  return loader();
}; 