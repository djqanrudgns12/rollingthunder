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
  console.log("Fetching all user_missions...");
  const res = await fetch(`${supabaseUrl}/rest/v1/user_missions?select=id,user_id,mission_id,progress,completed,is_collected`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("All user missions:", data);
  
  const missionsRes = await fetch(`${supabaseUrl}/rest/v1/missions?select=id,type,title,goal_amount,reward_chips`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const missionsData = await missionsRes.json();
  console.log("Missions:", missionsData);
}

run();
