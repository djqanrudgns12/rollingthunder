import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

async function run() {
  const userId = '6fb43860-fdda-4826-a971-7bd2983f49a9';
  const recordId = 'fce3af1c-c89d-4250-bd26-f674318af8d5'; // '출석 체크' mission

  console.log("Attempting to claim reward...");
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_mission_reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}` 
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_table_type: 'mission',
      p_record_id: recordId
    })
  });
  
  const text = await claimRes.text();
  console.log('Claim Status:', claimRes.status);
  console.log('Claim Response:', text);
}

run();
