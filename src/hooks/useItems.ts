import { useEffect, useState } from 'react'
import { itemsRepo } from '@/repos/items'
import { supabase } from '@/lib/supabase'
import { itemBus } from '@/lib/events'
import type { Item } from '@/types/db'

export function useItemsByPhase(phaseId: string | null, enabled: boolean = true) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!phaseId || !enabled) {
      // When gated off, don't fetch or subscribe. On a project page with many
      // phases we want only the expanded phases to open a realtime channel,
      // otherwise we'd open 20–30 concurrent subscriptions per project load.
      return
    }
    let mounted = true
    setLoading(true)
    // Always fetch both archived and non-archived; callers filter client-side.
    // This keeps the realtime channel identity stable when a user toggles
    // "Show archived" — otherwise re-subscribing with the same channel name
    // deduplicates and we lose live updates until a full reload.
    itemsRepo
      .listByPhase(phaseId, true)
      .then((data) => mounted && setItems(data))
      .finally(() => mounted && setLoading(false))

    const refetch = async () => {
      if (!mounted) return
      const data = await itemsRepo.listByPhase(phaseId, true)
      if (mounted) setItems(data)
    }

    const channel = supabase
      .channel(`items:phase:${phaseId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `phase_id=eq.${phaseId}` },
        () => {
          void refetch()
        }
      )
      .subscribe()

    // Local fallback: same-tab writes refresh the list immediately even if
    // Supabase realtime delivery lags or the table isn't in the publication.
    // We refetch when an event mentions this phase, OR when an item update
    // doesn't (the row may have been moved out of this phase).
    const offBus = itemBus.on((detail) => {
      if (detail.kind === 'created' && detail.item.phase_id === phaseId) {
        void refetch()
      } else if (detail.kind === 'updated') {
        void refetch()
      } else if (detail.kind === 'deleted' && detail.phaseId === phaseId) {
        void refetch()
      }
    })

    return () => {
      mounted = false
      offBus()
      supabase.removeChannel(channel)
    }
  }, [phaseId, enabled])

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

    // Same-tab fallback: any item write may flip pinned; just refetch.
    const offBus = itemBus.on(() => {
      if (mounted) void load()
    })

    return () => {
      mounted = false
      offBus()
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return { items, loading }
}
