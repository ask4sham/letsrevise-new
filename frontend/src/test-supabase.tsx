import { supabase } from './lib/supabaseClient';

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  // Test 1: Check if we can access auth
  const { data: authData, error: authError } = await supabase.auth.getSession();
  console.log('Auth test:', authData ? 'Connected' : 'Failed', authError);
  
  // Test 2: Try to list users (will fail without proper permissions)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  
  console.log('Database test:', users ? 'Connected' : 'Failed', usersError);
}

testSupabase();