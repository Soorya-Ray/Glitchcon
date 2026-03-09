const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const EscrowContractABI = [
  'function recordTransaction(string calldata orderId, uint8 newStatus) external',
  'function getOrderStatus(string calldata orderId) external view returns (uint8)',
  'event OrderStatusChanged(string indexed orderId, uint8 oldStatus, uint8 newStatus, uint256 timestamp)'
];

const STATUS_MAP = {
  CREATED: 0,
  LOCKED: 1,
  IN_TRANSIT: 2,
  PROOF_SUBMITTED: 3,
  CONFIRMED: 4,
  SETTLED: 5,
  DISPUTED: 6,
  RESOLVED: 7
};

class HardhatService {
  constructor() {
    this.rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    this.privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY ||
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    this.contractAddress = this._resolveContractAddress();
    this.enabled = false;

    this._init();
  }

  _resolveContractAddress() {
    const envAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
    if (envAddress) return envAddress;

    const deploymentAddress = this._readLocalDeploymentAddress();
    if (deploymentAddress) {
      console.log('Using contract address from hardhat/deployment.local.json');
      return deploymentAddress;
    }

    console.warn('No BLOCKCHAIN_CONTRACT_ADDRESS/CONTRACT_ADDRESS found in env or hardhat/deployment.local.json');
    return null;
  }

  _readLocalDeploymentAddress() {
    const deploymentPath = path.join(__dirname, '..', 'hardhat', 'deployment.local.json');
    if (!fs.existsSync(deploymentPath)) return null;

    try {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      return deployment.contractAddress || null;
    } catch (err) {
      console.warn(`Failed to parse ${deploymentPath}: ${err.message}`);
      return null;
    }
  }

  _init() {
    if (!this.contractAddress) {
      console.warn('Hardhat blockchain service is disabled: missing BLOCKCHAIN_CONTRACT_ADDRESS (or deployment.local.json).');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      this.contract = new ethers.Contract(this.contractAddress, EscrowContractABI, this.wallet);
      this.enabled = true;
      console.log(`Connected to Hardhat RPC at ${this.rpcUrl}`);
    } catch (err) {
      this.enabled = false;
      console.error(`Hardhat blockchain init failed: ${err.message}`);
    }
  }

  _ensureEnabled() {
    if (!this.enabled) {
      throw new Error('Hardhat blockchain service is not configured. Deploy contract and set BLOCKCHAIN_CONTRACT_ADDRESS.');
    }
  }

  async recordTransaction(orderId, status) {
    this._ensureEnabled();

    const statusCode = STATUS_MAP[status];
    if (statusCode === undefined) throw new Error(`Invalid status: ${status}`);

    const tx = await this.contract.recordTransaction(orderId, statusCode);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async verifyTransaction(txHash) {
    this._ensureEnabled();

    const receipt = await this.provider.getTransactionReceipt(txHash);
    return receipt || null;
  }
}

module.exports = new HardhatService();
