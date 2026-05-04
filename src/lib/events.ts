// Lightweight in-process event bus so writes via repos can notify hooks on
// the same client without depending on Supabase realtime delivery. Realtime
// covers cross-tab sync; this bus covers the (much more common) same-tab
// path where the user just captured/edited something and is staring at the
// page expecting it to update.

import type { Item } from '@/types/db'

type ItemEventDetail =
  | { kind: 'created'; item: Item }
  | { kind: 'updated'; item: Item }
  | { kind: 'deleted'; id: string; phaseId?: string }

const target = new EventTarget()
const ITEM_EVENT = 'pcc:item'

export const itemBus = {
  emitCreated(item: Item) {
    target.dispatchEvent(
      new CustomEvent<ItemEventDetail>(ITEM_EVENT, {
        detail: { kind: 'created', item },
      })
    )
  },
  emitUpdated(item: Item) {
    target.dispatchEvent(
      new CustomEvent<ItemEventDetail>(ITEM_EVENT, {
        detail: { kind: 'updated', item },
      })
    )
  },
  emitDeleted(id: string, phaseId?: string) {
    target.dispatchEvent(
      new CustomEvent<ItemEventDetail>(ITEM_EVENT, {
        detail: { kind: 'deleted', id, phaseId },
      })
    )
  },
  on(handler: (detail: ItemEventDetail) => void): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent<ItemEventDetail>).detail)
    }
    target.addEventListener(ITEM_EVENT, listener)
    return () => target.removeEventListener(ITEM_EVENT, listener)
  },
}
