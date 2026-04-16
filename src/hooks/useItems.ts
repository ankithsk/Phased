import { useEffect, useState } from 'react'
import { itemsRepo } from '@/repos/items'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/db'

export function useItemsByPhase(phaseId: string | null, includeArchived = false) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!phaseId) {
      setItems([])
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    itemsRepo
      .listByPhase(phaseId, includeArchived)
      .then((data) => mounted && setItems(data))
      .finally(() => mounted && setLoading(false))

    const channel = supabase
      .channel(`items:phase:${phaseId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `phase_id=eq.${phaseId}` },
        async () => {
          if (!mounted) return
          const data = await itemsRepo.listByPhase(phaseId, includeArchived)
          if (mounted) setItems(data)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [phaseId, includeArchived])

  return { items, loading }
}

export function usePinnedItems(projectId: string | null) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) {
      setItems([])
      setLoading(false)
      return
    }
    let mounted = true
    const load = () =>
      itemsRepo.listPinnedByProject(projectId).then((data) => mounted && setItems(data))
    load().finally(() => mounted && setLoading(false))

    // Re-fetch on any item change (can't filter pinned via realtime filter easily).
    const channel = supabase
      .channel(`pinned:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        if (mounted) load()
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return { items, loading }
}
