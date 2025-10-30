/**
 * Test Simplified Registration (No Name Field)
 */

const RAILWAY_URL = 'https://booksmart-backend-production-fe49.up.railway.app';

async function test() {
  console.log('\n✨ Testing Simplified Registration\n');

  const timestamp = Date.now();
  const email = `simple+${timestamp}@test.local`;
  const password = 'TestPass123!';
  const name = email.split('@')[0]; // Auto-generated from email

  console.log('Test Data:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name (auto): ${name}\n`);

  // Register
  const registerRes = await fetch(`${RAILWAY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  const registerData = await registerRes.json();

  if (!registerRes.ok) {
    console.log('❌ Registration failed:');
    console.log(JSON.stringify(registerData, null, 2));
    return;
  }

  console.log('✅ Registration successful!');
  console.log(`   User ID: ${registerData.user.id}`);
  console.log(`   Email: ${registerData.user.email}`);
  console.log(`   Name: ${registerData.user.user_metadata?.name || 'Not set'}`);
  console.log(`   Token: ${registerData.session.access_token.substring(0, 20)}...\n`);

  // Try to login
  const loginRes = await fetch(`${RAILWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();

  if (!loginRes.ok) {
    console.log('❌ Login failed:');
    console.log(JSON.stringify(loginData, null, 2));
    return;
  }

  console.log('✅ Login successful!');
  console.log(`   Token received: ${loginData.session.access_token.substring(0, 20)}...\n`);

  console.log('🎉 Simplified registration working perfectly!\n');
  console.log('Users can now register with just:');
  console.log('  • Email');
  console.log('  • Password');
  console.log('\nNo name field required! ✨\n');
}

test().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
