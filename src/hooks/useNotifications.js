import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('destinataire_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setUnreadCount((data || []).filter(n => !n.lu).length)
  }, [profile?.id])

  useEffect(() => {
    fetchNotifications()
    if (!profile?.id) return
    // Temps réel : écouter les nouvelles notifications
    const channel = supabase
      .channel('notifications-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `destinataire_id=eq.${profile.id}`,
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id, fetchNotifications])

  async function markAsRead(id) {
    await supabase.from('notifications')
      .update({ lu: true, lu_a: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await supabase.from('notifications')
      .update({ lu: true, lu_a: new Date().toISOString() })
      .eq('destinataire_id', profile.id).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markAsRead, markAllAsRead, refetch: fetchNotifications }
}

// ── Envoi de notifications N+1 / N+2 ─────────────────────────────────────────

/**
 * Envoie une notification au coordinateur responsable (N+1)
 * et au président (N+2) selon le type d'événement
 */
export async function notifyHierarchy(type, titre, message, lien, expediteur_id, souhait_id = null) {
  const destinataires = []

  // Récupérer N+1 : coordinateur du souhait ou tous les coordinateurs
  if (souhait_id) {
    const { data: souhait } = await supabase
      .from('souhaits')
      .select('coordinateur_id')
      .eq('id', souhait_id)
      .single()
    if (souhait?.coordinateur_id) {
      destinataires.push({ id: souhait.coordinateur_id, priorite: 'haute' })
    }
  } else {
    const { data: coords } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'coordinateur')
      .eq('actif', true)
    coords?.forEach(c => destinataires.push({ id: c.id, priorite: 'normale' }))
  }

  // Récupérer N+2 : président(s) et admins
  const { data: presidents } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['president', 'admin'])
    .eq('actif', true)
  presidents?.forEach(p => {
    if (!destinataires.find(d => d.id === p.id)) {
      destinataires.push({ id: p.id, priorite: 'haute' })
    }
  })

  if (destinataires.length === 0) return

  const inserts = destinataires.map(d => ({
    destinataire_id: d.id,
    expediteur_id,
    type,
    titre,
    message,
    lien,
    priorite: d.priorite,
  }))

  await supabase.from('notifications').insert(inserts)
}
