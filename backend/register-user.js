/**
 * Quick user registration script
 * Usage: node backend/register-user.js <email> <password> <name>
 */

const API_BASE_URL = 'http://localhost:3000/api';

async function registerUser(email, password, name) {
  try {
    console.log(`\n📝 Registering new user: ${email}`);

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        name
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! User registered:\n');
      console.log(`Email: ${data.user.email}`);
      console.log(`Name: ${data.user.name}`);
      console.log(`User ID: ${data.user.id}`);
      console.log('\n🔑 You can now login with these credentials in the extension!\n');
    } else {
      const error = await response.json();
      console.error('\n❌ Registration failed:');
      console.error(error.message || error);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\nUsage: node backend/register-user.js <email> <password> <name>');
  console.log('\nExample:');
  console.log('  node backend/register-user.js john@example.com SecurePass123 "John Doe"');
  console.log('');
  process.exit(1);
}

const [email, password, name] = args;

registerUser(email, password, name);
