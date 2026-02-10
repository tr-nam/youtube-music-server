// generate-password.js
const bcrypt = require('bcryptjs');

if (process.argv.length < 3) {
    console.log('\n📝 Password Hash Generator\n');
    console.log('Usage: node generate-password.js <password>\n');
    console.log('Example:');
    console.log('  node generate-password.js "mySecurePassword123"\n');
    process.exit(1);
}

const password = process.argv[2];
const hash = bcrypt.hashSync(password, 10);

console.log('\n✅ Password Hash Generated\n');
console.log('Hash:', hash);
console.log('\n📋 Add to auth.js:\n');
console.log(`const USERS = {`);
console.log(`    'username': '${hash}'`);
console.log(`};\n`);
