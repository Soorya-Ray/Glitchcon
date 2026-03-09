import { useAuth } from '../contexts/AuthContext';

const STATUS_ICONS = {
    GENESIS: '🌐', ORDER_CREATED: '📦', PAYMENT_LOCKED: '🔒',
    DRIVER_ASSIGNED: '🚚', PROOF_SUBMITTED: '📸', DELIVERY_CONFIRMED: '✅',
    PAYMENT_RELEASED: '💰', DISPUTE_RAISED: '⚠️', DISPUTE_RESOLVED: '⚖️',
};

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return dateStr; }
}

export function formatStatus(status) {
    return (status || '').replace(/_/g, ' ');
}

export function getBlockIcon(type) {
    return STATUS_ICONS[type] || '📄';
}

export default function OrderCard({ order, onAction }) {
    const { user } = useAuth();
    const role = user?.role;

    function renderActions() {
        const actions = [];

        if (role === 'customer') {
            if (order.status === 'CREATED') {
                actions.push(<button key="pay" className="btn btn-primary btn-sm" onClick={() => onAction('pay', order.orderId)}>💳 Pay & Lock Escrow</button>);
                actions.push(<button key="delete" className="btn btn-danger btn-sm" onClick={() => onAction('delete', order.orderId)}>🗑 Delete Order</button>);
            }
            if (order.status === 'LOCKED')
                actions.push(<button key="assign" className="btn btn-outline btn-sm" onClick={() => onAction('assign', order.orderId)}>🚚 Assign Driver</button>);
            if (order.status === 'PROOF_SUBMITTED') {
                actions.push(<button key="confirm" className="btn btn-success btn-sm" onClick={() => onAction('confirm', order.orderId)}>✅ Confirm Delivery</button>);
                actions.push(<button key="dispute" className="btn btn-danger btn-sm" onClick={() => onAction('dispute', order.orderId)}>⚠️ Raise Dispute</button>);
            }
        }

        if (role === 'driver' && order.status === 'IN_TRANSIT')
            actions.push(<button key="proof" className="btn btn-primary btn-sm" onClick={() => onAction('proof', order.orderId)}>📸 Submit Proof</button>);

        if (role === 'admin' && order.status === 'DISPUTED')
            actions.push(<button key="resolve" className="btn btn-primary btn-sm" onClick={() => onAction('resolve', order.orderId)}>⚖️ Resolve Dispute</button>);

        actions.push(<button key="history" className="btn btn-outline btn-sm" onClick={() => onAction('history', order.orderId)}>🔗 Blockchain Log</button>);

        return actions;
    }

    return (
        <div className="order-card slide-up">
            <div className="order-card-header">
                <span className="order-id">{order.orderId}</span>
                <span className={`status-badge ${order.status}`}>{formatStatus(order.status)}</span>
            </div>
            <div className="order-card-body">
                <div className="order-details-grid">
                    <div className="order-detail">
                        <div className="detail-label">Description</div>
                        <div className="detail-value">{order.description || 'N/A'}</div>
                    </div>
                    <div className="order-detail">
                        <div className="detail-label">Amount</div>
                        <div className="detail-value amount">₹{(order.amount || 0).toLocaleString()}</div>
                    </div>
                    <div className="order-detail">
                        <div className="detail-label">Customer</div>
                        <div className="detail-value">{order.customerName || order.customerId}</div>
                    </div>
                    <div className="order-detail">
                        <div className="detail-label">Supplier</div>
                        <div className="detail-value">{order.supplierName || order.supplierId}</div>
                    </div>
                    <div className="order-detail">
                        <div className="detail-label">Pickup</div>
                        <div className="detail-value">{order.pickup || 'N/A'}</div>
                    </div>
                    <div className="order-detail">
                        <div className="detail-label">Delivery</div>
                        <div className="detail-value">{order.delivery || 'N/A'}</div>
                    </div>
                    {order.driverName && (
                        <div className="order-detail">
                            <div className="detail-label">Driver</div>
                            <div className="detail-value">🚚 {order.driverName}</div>
                        </div>
                    )}
                    <div className="order-detail">
                        <div className="detail-label">Created</div>
                        <div className="detail-value">{formatDate(order.createdAt)}</div>
                    </div>
                </div>

                {order.deliveryProof && (
                    <div className="proof-details" style={{ marginTop: '0.75rem' }}>
                        <h4 style={{ color: 'var(--accent-cyan)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>📸 Delivery Proof</h4>
                        <div className="proof-row"><span className="proof-label">GPS</span><span className="proof-value">{order.deliveryProof.gpsLat?.toFixed(4)}, {order.deliveryProof.gpsLng?.toFixed(4)}</span></div>
                        <div className="proof-row"><span className="proof-label">Notes</span><span className="proof-value">{order.deliveryProof.notes || 'N/A'}</span></div>
                        <div className="proof-row"><span className="proof-label">Hash</span><span className="proof-value text-mono" style={{ fontSize: '0.68rem', wordBreak: 'break-all' }}>{order.deliveryProof.hash?.slice(0, 32)}...</span></div>
                    </div>
                )}

                {order.disputeReason && (
                    <div className="dispute-evidence" style={{ marginTop: '0.75rem' }}>
                        <h4>⚠️ Dispute Reason</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{order.disputeReason}</p>
                    </div>
                )}

                {order.resolution && (
                    <div className="proof-details" style={{ marginTop: '0.75rem', background: 'rgba(168,85,247,0.05)', borderColor: 'rgba(168,85,247,0.15)' }}>
                        <h4 style={{ color: 'var(--accent-purple)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>⚖️ Resolution</h4>
                        <div className="proof-row"><span className="proof-label">Decision</span><span className="proof-value">{order.resolution.decision}</span></div>
                        {order.resolution.supplierAmount !== undefined && (
                            <div className="proof-row"><span className="proof-label">Supplier Gets</span><span className="proof-value">₹{order.resolution.supplierAmount.toLocaleString()}</span></div>
                        )}
                        {order.resolution.refundAmount !== undefined && (
                            <div className="proof-row"><span className="proof-label">Refund</span><span className="proof-value">₹{order.resolution.refundAmount.toLocaleString()}</span></div>
                        )}
                    </div>
                )}

                {order.onChainTxHash && (
                    <div className="blockchain-badge" style={{ marginTop: '0.5rem' }}>
                        ⬡ On-chain: {order.onChainTxHash.slice(0, 20)}...
                    </div>
                )}
            </div>
            <div className="order-card-actions">
                {renderActions()}
            </div>
        </div>
    );
}
