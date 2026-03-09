require('@nomicfoundation/hardhat-ethers');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.19',
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './hardhat/cache',
    artifacts: './hardhat/artifacts'
  },
  networks: {
    hardhat: {},
    localhost: {
      url: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'
    }
  }
};
