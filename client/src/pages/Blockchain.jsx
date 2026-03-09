import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { formatDate, getBlockIcon } from '../components/OrderCard';
import api from '../api';

export default function Blockchain() {
    const toast = useToast();
    const [chain, setChain] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadBlockchain(); }, []);

    async function loadBlockchain() {
        try {
            setLoading(true);
            const [chainData, statsData] = await Promise.all([api.getChain(), api.getStats()]);
            setChain(chainData.chain || []);
            setStats(statsData);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleValidate() {
        try {
            const result = await api.validateChain();
            toast(result.message, result.valid ? 'success' : 'error');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    if (loading) return <div><div className="spinner" /><p className="loading-text">Loading blockchain...</p></div>;

    const blocks = [...chain].reverse();

    return (
        <div className="fade-in">
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card slide-up">
                        <div className="stat-icon indigo">⛓️</div>
                        <div className="stat-value">{stats.totalBlocks}</div>
                        <div className="stat-label">Total Blocks</div>
                    </div>
                    <div className="stat-card slide-up" style={{ animationDelay: '80ms' }}>
                        <div className="stat-icon emerald">✅</div>
                        <div className="stat-value">{stats.chainValid ? 'Valid' : 'Invalid!'}</div>
                        <div className="stat-label">Chain Integrity</div>
                    </div>
                    <div className="stat-card slide-up" style={{ animationDelay: '160ms' }}>
                        <div className="stat-icon cyan">📊</div>
                        <div className="stat-value">{Object.keys(stats.transactionTypes || {}).length}</div>
                        <div className="stat-label">Transaction Types</div>
                    </div>
                    <div className="stat-card slide-up" style={{ animationDelay: '240ms' }}>
                        <div className="stat-icon amber">🕐</div>
                        <div className="stat-value" style={{ fontSize: '0.95rem' }}>{formatDate(stats.latestTimestamp)}</div>
                        <div className="stat-label">Last Block</div>
                    </div>
                </div>
            )}

            <div className="section">
                <div className="section-header">
                    <h2>⛓️ Blockchain Ledger</h2>
                    <button className="btn btn-outline btn-sm" onClick={handleValidate}>🔍 Validate Chain</button>
                </div>
                <div className="blockchain-chain">
                    {blocks.map((block, i) => (
                        <div key={block.index}>
                            {i > 0 && <div className="block-connector" />}
                            <div className={`block-card ${block.index === 0 ? 'genesis' : ''} slide-up`} style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="block-header">
                                    <span className="block-index">Block #{block.index}</span>
                                    <span className="block-timestamp">{formatDate(block.timestamp)}</span>
                                </div>
                                <div className="block-type">
                                    {getBlockIcon(block.data?.type)} {block.data?.type || 'GENESIS'}
                                    {block.data?.orderId && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>{block.data.orderId}</span>
                                    )}
                                    {block.data?.status && (
                                        <span className={`status-badge ${block.data.status}`} style={{ marginLeft: '0.5rem' }}>{block.data.status}</span>
                                    )}
                                    {block.data?.onChainTxHash && (
                                        <span className="blockchain-badge" style={{ marginLeft: '0.5rem' }}>⬡ On-chain</span>
                                    )}
                                </div>
                                <div className="block-hash"><span>Hash:</span> {block.hash}</div>
                                <div className="block-hash"><span>Prev:</span> {block.previousHash}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
