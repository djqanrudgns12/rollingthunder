const test = require('node:test');
const assert = require('node:assert');
const { createClient } = require('@supabase/supabase-js');

// We need the service role key to use admin APIs for testing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test('Guest Sync DB Trigger (handle_new_user) Test', async () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Skipping test: Missing Supabase URL or Service Key.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const testEmail = `test_guest_sync_${Date.now()}@test.local`;
  let userId;

  try {
    // 1. Create a user via Admin API with guest metadata
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'password123',
      email_confirm: true,
      user_metadata: {
        username: 'test_sync_user',
        name: 'Test Sync',
        guest_chips: '12345',
        guest_inventory: ['skin_pixel', 'avatar_normal_1', 'piece_premium'],
        guest_equipped: {
          skin: 'skin_pixel',
          avatar: 'avatar_normal_1'
        }
      }
    });

    assert.ok(!error, `User creation failed: ${error?.message}`);
    userId = data.user.id;

    // Wait a brief moment for the DB trigger to finish (triggers are usually synchronous in the transaction, but just in case)
    await new Promise(r => setTimeout(r, 500));

    // 2. Fetch the profile to check chips and equipped columns
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    assert.ok(!profileError, `Profile fetch failed: ${profileError?.message}`);
    assert.strictEqual(Number(profile.chips_balance), 12345, 'Chips balance not synced correctly');
    assert.strictEqual(profile.equipped_skin, 'skin_pixel', 'Equipped skin not synced correctly');
    assert.strictEqual(profile.equipped_avatar, 'avatar_normal_1', 'Equipped avatar not synced correctly');
    assert.strictEqual(profile.equipped_border, null, 'Equipped border should be null');

    // 3. Fetch user_inventory to check items
    const { data: inventory, error: inventoryError } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId);

    assert.ok(!inventoryError, `Inventory fetch failed: ${inventoryError?.message}`);
    assert.strictEqual(inventory.length, 3, 'Inventory should have 3 items');
    
    const itemCodes = inventory.map(i => i.item_code);
    assert.ok(itemCodes.includes('skin_pixel'), 'Inventory missing skin_pixel');
    assert.ok(itemCodes.includes('avatar_normal_1'), 'Inventory missing avatar_normal_1');
    assert.ok(itemCodes.includes('piece_premium'), 'Inventory missing piece_premium');
    
    // Check item_type parsing
    const skinItem = inventory.find(i => i.item_code === 'skin_pixel');
    assert.strictEqual(skinItem.item_type, 'skin', 'Item type parsed incorrectly');

    console.log('✅ 테스트 성공: 게스트 메타데이터가 DB 프로필 및 인벤토리로 완벽하게 마이그레이션 되었습니다.');
  } finally {
    // 4. Cleanup test user
    if (userId) {
      await supabase.auth.admin.deleteUser(userId);
    }
  }
});
