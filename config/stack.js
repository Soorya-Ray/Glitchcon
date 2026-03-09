function requireEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateProductionStack() {
  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];

  const blockchainRequired = process.env.NODE_ENV === 'production'
    || process.env.REQUIRE_BLOCKCHAIN_TX === 'true';

  if (blockchainRequired) {
    const hasRpc = !!process.env.BLOCKCHAIN_RPC_URL;
    const hasPrivateKey = !!process.env.BLOCKCHAIN_PRIVATE_KEY;
    const hasContractAddress = !!process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

    if (!hasRpc) required.push('BLOCKCHAIN_RPC_URL');
    if (!hasPrivateKey) required.push('BLOCKCHAIN_PRIVATE_KEY');
    if (!hasContractAddress) required.push('BLOCKCHAIN_CONTRACT_ADDRESS');
  }

  for (const key of required) {
    requireEnv(key);
  }
}

module.exports = {
  requireEnv,
  validateProductionStack,
};
