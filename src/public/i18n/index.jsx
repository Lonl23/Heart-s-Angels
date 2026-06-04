import { createContext, useContext, useState, useEffect } from 'react'
import fr from './fr.js'
import nl from './nl.js'
import en from './en.js'
import de from './de.js'

const LANGS = { fr, nl, en, de }
const LANG_NAMES = { fr: 'Français', nl: 'Nederlands', en: 'English', de: 'Deutsch' }

const I18nContext = createContext(null)

function detectLang() {
  const saved = localStorage.getItem('ha_lang')
  if (saved && LANGS[saved]) return saved
  const browser = navigator.language?.slice(0, 2)
  if (LANGS[browser]) return browser
  return 'fr'
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  function setLang(l) {
    localStorage.setItem('ha_lang', l)
    setLangState(l)
  }

  const t = LANGS[lang] || LANGS.fr

  // Accès imbriqué : t('home.hero.title')
  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj)
  }

  function tr(path) {
    return get(t, path) ?? get(LANGS.fr, path) ?? path
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t: tr, langs: LANG_NAMES, raw: t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}