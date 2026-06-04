'use client'

import { useI18n, type Locale } from '@/lib/i18n'

const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'si', label: 'සිංහල',  short: 'සි' },
  { code: 'ta', label: 'தமிழ்',  short: 'த'  },
]

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
      {LOCALES.map(({ code, label, short }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          title={label}
          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
            locale === code
              ? 'bg-[#1A73E8] text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {short}
        </button>
      ))}
    </div>
  )
}
