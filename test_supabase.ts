import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

console.log('URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('maps').select('id, items').eq('id', 'roulette_of_fate')
  if (error) {
    console.error('Error:', error)
    return
  }
  console.log('Data:', JSON.stringify(data, null, 2))
}

test()
