import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

async function run() {
  console.log("Finding uncollected missions...");
  const res = await fetch(`${supabaseUrl}/rest/v1/user_missions?completed=eq.true&is_collected=eq.false&select=*,mission:missions(*)`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const missions = await res.json();
  if (!missions || missions.length === 0) {
    console.log("No uncollected missions found!");
    return;
  }
  
  const target = missions[0];
  console.log("Found target:", target);
  
  console.log("Attempting to claim reward for user", target.user_id, "record", target.id);
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_mission_reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}` // Using anon key might not work if RPC requires specific auth.uid(), but SECURITY DEFINER bypasses RLS for the tables. Let's see if we get RLS error or the P0001 error.
    },
    body: JSON.stringify({
      p_user_id: target.user_id,
      p_table_type: 'mission',
      p_record_id: target.id
    })
  });
  
  const text = await claimRes.text();
  console.log('Claim Status:', claimRes.status);
  console.log('Claim Response:', text);
}

run();
