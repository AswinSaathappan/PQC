const crypto = require('crypto');

// 1. Quantum Vulnerable: RSA key generation and signing
function generateRsa() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return { publicKey, privateKey };
}

// 2. Quantum Vulnerable: ECDSA with prime256v1
function generateEcdsa() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return ecdh;
}

// 3. Symmetric / Quantum-Weakened: AES-256-GCM
function encryptAes(text, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 4. Post-Quantum Cryptography: ML-KEM-768 / Kyber768
const OID_ML_KEM_768 = "2.16.840.1.101.3.4.4.2";
console.log("Using post-quantum algorithm ML-KEM-768 with OID", OID_ML_KEM_768);
