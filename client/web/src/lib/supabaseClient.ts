import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// Spelled `../lib/env` rather than `./env` on purpose: jest maps `*/lib/env` to a
// CommonJS-safe stand-in, and the sibling spelling would slip past that mapper.
import { supabaseAnonKey, supabaseUrl } from '../lib/env'

let supabaseClient: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured.')
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }

  return supabaseClient
}
