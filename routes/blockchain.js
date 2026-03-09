const express = require('express');

module.exports = function (ledger, blockchainService) {
  const router = express.Router();

  // Get full chain (local)
  router.get('/chain', (req, res) => {
    res.json({
      success: true,
      data: {
        chain: ledger.getChain(),
        length: ledger.getChain().length
      }
    });
  });

  // Validate chain integrity (local)
  router.get('/validate', (req, res) => {
    const isValid = ledger.isChainValid();
    res.json({
      success: true,
      data: {
        valid: isValid,
        message: isValid ? 'Blockchain is valid and immutable.' : 'Blockchain integrity compromised!'
      }
    });
  });

  // Verify a single blockchain transaction
  async function verifyTx(req, res) {
    try {
      const receipt = await blockchainService.verifyTransaction(req.params.txHash);
      if (!receipt) {
        return res.status(404).json({ success: false, error: 'Transaction not found or unconfirmed' });
      }
      res.json({
        success: true,
        data: {
          verified: true,
          status: receipt.status === 1 ? 'SUCCESS' : 'FAILURE',
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  router.get('/tx/:txHash', verifyTx);

  // Get blockchain statistics
  router.get('/stats', (req, res) => {
    const chain = ledger.getChain();
    const stats = {
      totalBlocks: chain.length,
      latestTimestamp: chain[chain.length - 1].timestamp,
      chainValid: ledger.isChainValid(),
      transactionTypes: {}
    };

    chain.forEach(block => {
      const type = block.data.type;
      stats.transactionTypes[type] = (stats.transactionTypes[type] || 0) + 1;
    });

    res.json({ success: true, data: stats });
  });

  return router;
};
