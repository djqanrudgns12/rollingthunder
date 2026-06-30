import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://meiqecigjicnstjukhlz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1laXFlY2lnamljbnN0anVraGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDQ3MTUsImV4cCI6MjA5NzcyMDcxNX0.cHu8kYBiy2XvXowi4Xt5qi5yyu2XUlwPz2RlO2QiATY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('Fetching maps from Supabase...');
  const { data, error } = await supabase.from('maps').select('id, name, created_at');
  if (error) {
    console.error('Error fetching maps:', error);
  } else {
    console.log('Maps in DB:', data);
  }
}

checkDb();
