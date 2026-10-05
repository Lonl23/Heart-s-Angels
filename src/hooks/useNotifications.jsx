import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { activerPush, permissionPush } from '@/lib/push'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [chargement, setChargement] = useState(false)
  const [pushEtat, setPushEtat] = useState(permissionPush())

  const uid = session?.user?.id

  async function charger() {
    if (!uid) { setItems([]); return }
    setChargement(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, type, titre, message, lien, priorite, lu, created_at')
      .eq('destinataire_id', uid)
      .order('created_at', { ascending: false })
      .limit(40)
    setItems(data || [])
    setChargement(false)
  }

  useEffect(() => {
    if (!uid) { setItems([]); return }
    charger()
    const ch = supabase
      .channel('ha-notifs-' + uid)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${uid}` },
        (payload) => {
          const row = payload.new
          if (!row?.id) return
          setItems((cur) => (cur.some(x => x.id === row.id) ? cur : [row, ...cur].slice(0, 40)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${uid}` },
        (payload) => {
          const row = payload.new
          if (!row?.id) return
          setItems((cur) => cur.map(x => x.id === row.id ? { ...x, ...row } : x))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid])

  useEffect(() => {
    if (!uid || !profile || profile.role === 'partenaire') return
    let stop = false
    activerPush((lien) => {
      if (typeof lien === 'string' && lien.startsWith('/')) nav(lien)
    }).then((r) => {
      if (stop) return
      if (r?.ok) setPushEtat('granted')
      else if (r?.raison === 'refuse') setPushEtat('denied')
    })
    return () => { stop = true }
  }, [uid, profile?.id])

  const nonLues = items.filter(n => !n.lu)
  const nbNonLues = nonLues.length

  async function marquerLues(ids) {
    const liste = ids === undefined ? null : ids
    await supabase.rpc('marquer_notifications_lues', { p_ids: liste })
    const now = new Date().toISOString()
    setItems(cur => cur.map(n => (liste === null || liste.includes(n.id) ? { ...n, lu: true, lu_a: now } : n)))
  }

  async function demanderPush() {
    const r = await activerPush((lien) => {
      if (typeof lien === 'string' && lien.startsWith('/')) nav(lien)
    })
    setPushEtat(r?.ok ? 'granted' : (r?.raison === 'refuse' ? 'denied' : permissionPush()))
    return r
  }

  const value = useMemo(() => ({
    items, nonLues, nbNonLues, chargement, pushEtat,
    charger, marquerLues, demanderPush,
  }), [items, chargement, pushEtat])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications doit être utilisé dans <NotificationsProvider>')
  return ctx
}
