import { seedDatabase } from './src/seed';

// Test the seed script with environment variable or default
const databaseUrl =
  process.env.DATABASE_URL || 'postgres://myuser:mypassword@localhost:5432/mydatabase';

console.log('🧪 Testing seed script...');
console.log('📡 Database URL:', databaseUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

seedDatabase(databaseUrl)
  .then(() => {
    console.log('✅ Seed test completed successfully');
  })
  .catch(error => {
    console.error('❌ Seed test failed:', error);
  });
