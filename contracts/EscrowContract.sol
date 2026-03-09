// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EscrowContract
 * @dev Manages the state machine for the Escrow Payment System on an EVM chain
 */
contract EscrowContract {
    enum Status { CREATED, LOCKED, IN_TRANSIT, PROOF_SUBMITTED, CONFIRMED, SETTLED, DISPUTED, RESOLVED }

    struct Order {
        string orderId;
        address customer;
        address supplier;
        address driver;
        uint256 amount;
        Status status;
        uint256 updatedAt;
    }

    mapping(string => Order) public orders;
    address public admin;

    event OrderStatusChanged(string indexed orderId, Status oldStatus, Status newStatus, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    function recordTransaction(string calldata orderId, uint8 newStatus) external onlyAdmin {
        Status currentStatus = orders[orderId].status;
        Status nextStatus = Status(newStatus);
        
        // If it's a new order
        if (bytes(orders[orderId].orderId).length == 0) {
            orders[orderId] = Order({
                orderId: orderId,
                customer: address(0), 
                supplier: address(0), 
                driver: address(0),
                amount: 0,
                status: nextStatus,
                updatedAt: block.timestamp
            });
        } else {
            orders[orderId].status = nextStatus;
            orders[orderId].updatedAt = block.timestamp;
        }

        emit OrderStatusChanged(orderId, currentStatus, nextStatus, block.timestamp);
    }

    function getOrderStatus(string calldata orderId) external view returns (Status) {
        require(bytes(orders[orderId].orderId).length > 0, "Order does not exist");
        return orders[orderId].status;
    }
}
