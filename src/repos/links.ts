import { supabase } from '@/lib/supabase'
import type { ItemLink } from '@/types/db'

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

  async link(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) throw new Error('cannot link item to itself')
    const user_id = await currentUserId()
    const { error } = await supabase
      .from('item_links')
      .insert({ from_item_id: fromId, to_item_id: toId, user_id })
    if (error) throw error
  },

  async unlink(fromId: string, toId: string): Promise<void> {
    const { error } = await supabase
      .from('item_links')
      .delete()
      .match({ from_item_id: fromId, to_item_id: toId })
    if (error) throw error
  }
}
