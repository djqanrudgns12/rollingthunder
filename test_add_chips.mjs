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
  console.log("Testing if add_chips exists...");
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/add_chips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}` 
    },
    body: JSON.stringify({
      p_user_id: '6fb43860-fdda-4826-a971-7bd2983f49a9',
      p_amount: 1,
      p_reason: 'test'
    })
  });
  
  const text = await claimRes.text();
  console.log('Status:', claimRes.status);
  console.log('Response:', text);
}

run();
