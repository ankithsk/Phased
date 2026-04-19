import { supabase } from '@/lib/supabase'
import type { ItemLink, LinkRelation } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const linksRepo = {
  async listForItem(itemId: string): Promise<ItemLink[]> {
    const { data, error } = await supabase
      .from('item_links')
      .select('*')
      .or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`)
    if (error) throw error
    return data ?? []
  },

  async link(
    fromId: string,
    toId: string,
    relation: LinkRelation = 'links'
  ): Promise<void> {
    if (fromId === toId) throw new Error('cannot link item to itself')

    if (relation === 'links') {
      // Generic links are bidirectional in intent; prevent creating the same
      // relationship twice even if the user picked the opposite direction.
      const { data: existing } = await supabase
        .from('item_links')
        .select('from_item_id')
        .eq('relation', 'links')
        .or(
          `and(from_item_id.eq.${fromId},to_item_id.eq.${toId}),and(from_item_id.eq.${toId},to_item_id.eq.${fromId})`
        )
        .limit(1)
      if (existing && existing.length > 0) return
    } else {
      // 'blocks' is directional. Only dedupe the exact same direction —
      // A blocks B and B blocks A are different relationships (one may be
      // wrong, but the user gets to correct that themselves).
      const { data: existing } = await supabase
        .from('item_links')
        .select('from_item_id')
        .eq('relation', 'blocks')
        .eq('from_item_id', fromId)
        .eq('to_item_id', toId)
        .limit(1)
      if (existing && existing.length > 0) return
    }

    const user_id = await currentUserId()
    const { error } = await supabase.from('item_links').insert({
      from_item_id: fromId,
      to_item_id: toId,
      relation,
      user_id
    })
    if (error) throw error
  },

  async unlink(
    fromId: string,
    toId: string,
    relation: LinkRelation = 'links'
  ): Promise<void> {
    if (relation === 'blocks') {
      // Directional: delete only the exact (from, to) row.
      const { error } = await supabase
        .from('item_links')
        .delete()
        .match({ from_item_id: fromId, to_item_id: toId, relation: 'blocks' })
      if (error) throw error
      return
    }
    // Generic links: stored in a single direction but bidirectional in intent.
    const { error } = await supabase
      .from('item_links')
      .delete()
      .eq('relation', 'links')
      .or(
        `and(from_item_id.eq.${fromId},to_item_id.eq.${toId}),and(from_item_id.eq.${toId},to_item_id.eq.${fromId})`
      )
    if (error) throw error
  }
}
