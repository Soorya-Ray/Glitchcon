class EscrowChaincode {
  constructor(ledger, blockchainService) {
    this.ledger = ledger;
    this.blockchainService = blockchainService;
    this.worldState = new Map(); // orderId -> order state
    this.strictBlockchain = process.env.NODE_ENV === 'test'
      ? false
      : process.env.REQUIRE_BLOCKCHAIN_TX !== 'false';
  }

  // Valid state transitions
  static TRANSITIONS = {
    CREATED: ['LOCKED'],
    LOCKED: ['IN_TRANSIT'],
    IN_TRANSIT: ['PROOF_SUBMITTED'],
    PROOF_SUBMITTED: ['CONFIRMED', 'DISPUTED'],
    CONFIRMED: ['SETTLED'],
    DISPUTED: ['RESOLVED'],
  };

  _validateTransition(currentStatus, newStatus) {
    const allowed = EscrowChaincode.TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(`Invalid state transition: ${currentStatus} → ${newStatus}`);
    }
  }

  _getOrder(orderId) {
    const order = this.worldState.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found on ledger`);
    return order;
  }

  async _recordOnChainTx(orderId, status) {
    if (!this.blockchainService || typeof this.blockchainService.recordTransaction !== 'function') {
      if (this.strictBlockchain) {
        throw new Error('Blockchain service not available');
      }
      return null;
    }

    try {
      return await this.blockchainService.recordTransaction(orderId, status);
    } catch (err) {
      if (this.strictBlockchain) {
        throw new Error(`Blockchain TX failed for ${orderId} (${status}): ${err.message}`);
      }
      console.error(`Skipping blockchain TX for ${orderId}: ${err.message}`);
      return null;
    }
  }

  async _updateState(orderId, updates, txType) {
    const order = this.worldState.get(orderId) || {};
    const updated = { ...order, ...updates, updatedAt: new Date().toISOString() };

    // Write to external EVM node (Hardhat by default)
    updated.onChainTxHash = await this._recordOnChainTx(orderId, updated.status);

    this.worldState.set(orderId, updated);

    // Record on local ledger
    const block = this.ledger.addBlock({
      type: txType,
      orderId,
      status: updated.status,
      details: updates,
      onChainTxHash: updated.onChainTxHash,
      timestamp: updated.updatedAt
    });

    return { order: updated, block };
  }

  async createOrder({ orderId, customerId, supplierId, amount, description, pickup, delivery }) {
    if (this.worldState.has(orderId)) {
      throw new Error(`Order ${orderId} already exists`);
    }

    const order = {
      orderId,
      customerId,
      supplierId,
      driverId: null,
      amount: parseFloat(amount),
      description,
      pickup,
      delivery,
      status: 'CREATED',
      paymentRef: null,
      deliveryProof: null,
      disputeReason: null,
      resolution: null,
      onChainTxHash: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Write to external EVM node (Hardhat by default)
    order.onChainTxHash = await this._recordOnChainTx(orderId, order.status);

    this.worldState.set(orderId, order);

    const block = this.ledger.addBlock({
      type: 'ORDER_CREATED',
      orderId,
      status: 'CREATED',
      details: { customerId, supplierId, amount, description, pickup, delivery },
      onChainTxHash: order.onChainTxHash,
      timestamp: order.createdAt
    });

    return { order, block };
  }

  deleteOrder(orderId, customerId) {
    const order = this._getOrder(orderId);
    if (order.customerId !== customerId) {
      throw new Error('Only the order customer can delete this order');
    }
    if (order.status !== 'CREATED') {
      throw new Error(`Only CREATED orders can be deleted. Current status: ${order.status}`);
    }

    this.worldState.delete(orderId);

    const block = this.ledger.addBlock({
      type: 'ORDER_DELETED',
      orderId,
      status: 'DELETED',
      details: {
        deletedBy: customerId,
        previousStatus: order.status
      },
      onChainTxHash: null,
      timestamp: new Date().toISOString()
    });

    return { deleted: true, orderId, block };
  }

  async lockPayment(orderId, paymentRef) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'LOCKED');

    return this._updateState(orderId, {
      status: 'LOCKED',
      paymentRef
    }, 'PAYMENT_LOCKED');
  }

  async assignDriver(orderId, driverId) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'IN_TRANSIT');

    return this._updateState(orderId, {
      status: 'IN_TRANSIT',
      driverId
    }, 'DRIVER_ASSIGNED');
  }

  async submitDeliveryProof(orderId, proofData) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'PROOF_SUBMITTED');

    const proofHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(proofData))
      .digest('hex');

    return this._updateState(orderId, {
      status: 'PROOF_SUBMITTED',
      deliveryProof: {
        ...proofData,
        hash: proofHash,
        submittedAt: new Date().toISOString()
      }
    }, 'PROOF_SUBMITTED');
  }

  async confirmDelivery(orderId, customerId) {
    const order = this._getOrder(orderId);
    if (order.customerId !== customerId) {
      throw new Error('Only the order customer can confirm delivery');
    }
    this._validateTransition(order.status, 'CONFIRMED');

    await this._updateState(orderId, {
      status: 'CONFIRMED'
    }, 'DELIVERY_CONFIRMED');

    // Auto-trigger payment release
    const releaseResult = await this.releasePayment(orderId);
    return releaseResult;
  }

  async releasePayment(orderId) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'SETTLED');

    return this._updateState(orderId, {
      status: 'SETTLED',
      settledAt: new Date().toISOString()
    }, 'PAYMENT_RELEASED');
  }

  async raiseDispute(orderId, reason) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'DISPUTED');

    return this._updateState(orderId, {
      status: 'DISPUTED',
      disputeReason: reason,
      disputedAt: new Date().toISOString()
    }, 'DISPUTE_RAISED');
  }

  async resolveDispute(orderId, decision, amount = null) {
    const order = this._getOrder(orderId);
    this._validateTransition(order.status, 'RESOLVED');

    // decision: 'RELEASE' | 'REFUND' | 'PARTIAL'
    const resolution = {
      decision,
      resolvedAt: new Date().toISOString()
    };

    if (decision === 'PARTIAL' && amount !== null) {
      resolution.supplierAmount = parseFloat(amount);
      resolution.refundAmount = order.amount - parseFloat(amount);
    } else if (decision === 'RELEASE') {
      resolution.supplierAmount = order.amount;
      resolution.refundAmount = 0;
    } else if (decision === 'REFUND') {
      resolution.supplierAmount = 0;
      resolution.refundAmount = order.amount;
    }

    return this._updateState(orderId, {
      status: 'RESOLVED',
      resolution
    }, 'DISPUTE_RESOLVED');
  }

  getOrderState(orderId) {
    return this._getOrder(orderId);
  }

  getOrderHistory(orderId) {
    return this.ledger.getBlocksByOrderId(orderId);
  }

  getAllOrders() {
    return Array.from(this.worldState.values());
  }

  getOrdersByUser(userId, role) {
    const orders = this.getAllOrders();
    switch (role) {
      case 'customer':
        return orders.filter(o => o.customerId === userId);
      case 'supplier':
        return orders.filter(o => o.supplierId === userId);
      case 'driver':
        return orders.filter(o => o.driverId === userId);
      case 'admin':
        return orders;
      default:
        return [];
    }
  }
}

module.exports = EscrowChaincode;
