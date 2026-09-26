const fs = require('fs');
const buf = Buffer.concat([
  Buffer.from('\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00', 'binary'),
  Buffer.from('RSA-2048\x00AES-256-GCM\x00ECDSA-P256\x00ML-KEM-768\x002.16.840.1.101.3.4.4.2\x00SHA-256\x00', 'utf8')
]);
fs.writeFileSync('d:/SIH/SIH26/PQC/scratch/test_inputs/binary_test/libcryptotest.so', buf);
console.log('Created binary test file successfully.');
