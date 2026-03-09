import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Blockchain from './pages/Blockchain';
import Users from './pages/Users';
import LandingPage from './pages/LandingPage';
import Modal from './components/Modal';
import StripePaymentForm from './components/StripePaymentForm';
import DriverCard from './components/DriverCard';
import { formatDate, getBlockIcon } from './components/OrderCard';
import api from './api';

function makeRequestId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `req-${Date.now()}-${rand}`;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function ProtectedApp({ view }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [refreshFn, setRefreshFn] = useState(null);

  const [proofForm, setProofForm] = useState({ gpsLat: '28.6139', gpsLng: '77.2090', notes: 'Delivered at front gate. Signed by recipient.' });
  const [disputeReason, setDisputeReason] = useState('');
  const [resolveDecision, setResolveDecision] = useState('RELEASE');
  const [resolveAmount, setResolveAmount] = useState('');
  const [orderForm, setOrderForm] = useState({ supplierId: 'USR-S001', description: '', amount: '', pickupAddress: 'Warehouse A, New Delhi', deliveryAddress: 'Office B, Mumbai' });
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [history, setHistory] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentFlow, setPaymentFlow] = useState({
    orderId: '',
    amount: '',
    clientSecret: '',
    status: ''
  });
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [newOrderRequestId, setNewOrderRequestId] = useState(makeRequestId());

  async function handleOrderAction(action, orderId, refresh) {
    if (refresh) setRefreshFn(() => refresh);

    switch (action) {
      case 'pay':
        try {
          const order = await api.getOrder(orderId);
          const amount = Number(order.amount || 0);
          if (!amount || amount <= 0) {
            toast('Order amount is invalid for payment', 'error');
            return;
          }

          const intent = await api.createPaymentIntent(orderId, amount);
          if (!stripePromise) {
            const cfg = await api.getStripeConfig();
            setStripePromise(loadStripe(cfg.publishableKey));
          }
          setPaymentFlow({
            orderId,
            amount: String(amount),
            clientSecret: intent.clientSecret || '',
            status: intent.status || ''
          });
          setCurrentOrderId(orderId);
          setModal('pay');
        } catch (err) { toast(err.message, 'error'); }
        break;

      case 'confirm':
        try {
          await api.confirmDelivery(orderId);
          toast('Delivery confirmed! Payment released to supplier.', 'success');
          if (refresh) refresh();
        } catch (err) { toast(err.message, 'error'); }
        break;

      case 'assign':
        try {
          const driverList = await api.getDrivers();
          const sortedDrivers = [...driverList].sort((a, b) => {
            const aScore = a.reputation_score == null ? -1 : Number(a.reputation_score);
            const bScore = b.reputation_score == null ? -1 : Number(b.reputation_score);
            return bScore - aScore;
          });
          setDrivers(sortedDrivers);
          setSelectedDriver(sortedDrivers[0]?.id || '');
          setCurrentOrderId(orderId);
          setModal('assign');
        } catch (err) { toast(err.message, 'error'); }
        break;

      case 'proof':
        setCurrentOrderId(orderId);
        setProofForm({ gpsLat: '28.6139', gpsLng: '77.2090', notes: 'Delivered at front gate. Signed by recipient.' });
        setModal('proof');
        break;

      case 'dispute':
        setCurrentOrderId(orderId);
        setDisputeReason('');
        setModal('dispute');
        break;

      case 'resolve':
        setCurrentOrderId(orderId);
        setResolveDecision('RELEASE');
        setResolveAmount('');
        setModal('resolve');
        break;

      case 'history':
        try {
          const h = await api.getOrderHistory(orderId);
          setHistory(h);
          setCurrentOrderId(orderId);
          setModal('history');
        } catch (err) { toast(err.message, 'error'); }
        break;

      case 'newOrder':
        setOrderForm({ supplierId: 'USR-S001', description: '', amount: '', pickupAddress: 'Warehouse A, New Delhi', deliveryAddress: 'Office B, Mumbai' });
        setNewOrderRequestId(makeRequestId());
        setModal('newOrder');
        break;

      case 'delete':
        try {
          const ok = window.confirm('Delete this unpaid order? This action cannot be undone.');
          if (!ok) return;
          await api.deleteOrder(orderId);
          toast(`Order deleted: ${orderId}`, 'success');
          if (refresh) refresh();
        } catch (err) { toast(err.message, 'error'); }
        break;

      default:
        break;
    }
  }

  async function submitAssign() {
    try {
      const driverToAssign = selectedDriver || (drivers.length > 0 ? drivers[0].id : null);
      if (!driverToAssign) {
        toast('No driver selected', 'error');
        return;
      }
      const result = await api.assignDriver(currentOrderId, driverToAssign);
      setModal(null);
      toast(`Driver assigned: ${result.driverName || driverToAssign}`, 'success');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitPayLock(paymentIntentId) {
    try {
      if (!paymentIntentId) {
        toast('paymentIntentId is required', 'error');
        return;
      }
      const result = await api.payOrder(paymentFlow.orderId, paymentIntentId);
      setModal(null);
      toast(`Payment locked in escrow! Ref: ${result.paymentRef}`, 'success');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitProof() {
    try {
      const formData = new FormData();
      formData.append('gpsLat', proofForm.gpsLat);
      formData.append('gpsLng', proofForm.gpsLng);
      formData.append('notes', proofForm.notes);
      const fileInput = document.getElementById('proof-image-input');
      if (fileInput?.files[0]) formData.append('image', fileInput.files[0]);
      const result = await api.submitProof(currentOrderId, formData);
      setModal(null);
      toast(`Proof submitted! Hash: ${result.proofHash?.slice(0, 16)}...`, 'success');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitDispute() {
    if (!disputeReason.trim()) {
      toast('Please provide a reason', 'error');
      return;
    }
    try {
      await api.raiseDispute(currentOrderId, disputeReason);
      setModal(null);
      toast('Dispute raised. Funds frozen in escrow.', 'info');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitResolve() {
    try {
      const amt = resolveDecision === 'PARTIAL' ? resolveAmount : null;
      if (resolveDecision === 'PARTIAL' && (!amt || amt <= 0)) {
        toast('Enter a valid amount', 'error');
        return;
      }
      await api.resolveDispute(currentOrderId, resolveDecision, amt);
      setModal(null);
      toast(`Dispute resolved: ${resolveDecision}`, 'success');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitNewOrder() {
    if (isCreatingOrder) return;
    try {
      setIsCreatingOrder(true);
      const result = await api.createOrder(orderForm, newOrderRequestId);
      setModal(null);
      toast(`Order created: ${result.orderId || result?.order?.orderId}`, 'success');
      if (refreshFn) refreshFn();
    } catch (err) { toast(err.message, 'error'); }
    finally { setIsCreatingOrder(false); }
  }

  function renderView() {
    switch (view) {
      case 'dashboard': return <Dashboard onOrderAction={handleOrderAction} />;
      case 'orders': return <Orders onOrderAction={handleOrderAction} />;
      case 'blockchain': return <Blockchain />;
      case 'users': return <Users />;
      default: return <Dashboard onOrderAction={handleOrderAction} />;
    }
  }

  const navItems = [
    { key: 'dashboard', path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'orders', path: '/orders', icon: '📦', label: 'Orders' },
    ...(user?.role === 'admin' ? [{ key: 'users', path: '/users', icon: '👥', label: 'Users' }] : []),
    { key: 'blockchain', path: '/blockchain', icon: '⛓️', label: 'Blockchain' },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">🔗</div>
            <div>
              <h2>EscrowChain</h2>
              <span>Blockchain Payment System</span>
            </div>
          </div>

          <nav className="header-nav">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`nav-btn ${view === item.key ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>

          <div className="header-right">
            <div className="user-badge">
              <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{user?.name}</div>
                <span className={`role-tag ${user?.role}`}>{user?.role}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {renderView()}
      </main>

      {modal === 'assign' && (
        <Modal title="Assign Driver" onClose={() => setModal(null)} footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitAssign}>Assign Driver</button>
          </>
        }>
          {drivers.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem 0' }}>
              <h3>No Drivers Available</h3>
              <p>Try again in a moment.</p>
            </div>
          ) : (
            <div className="driver-card-list">
              {drivers.map(driver => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  isSelected={selectedDriver === driver.id}
                  onSelect={setSelectedDriver}
                />
              ))}
            </div>
          )}
        </Modal>
      )}

      {modal === 'pay' && (
        <Modal title="Complete Payment & Lock Escrow" onClose={() => setModal(null)} footer={
          <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
        }>
          <div className="form-group">
            <label>Order ID</label>
            <input className="form-input" value={paymentFlow.orderId} readOnly />
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input className="form-input" value={`₹${paymentFlow.amount}`} readOnly />
          </div>
          {stripePromise && paymentFlow.clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret: paymentFlow.clientSecret }}>
              <StripePaymentForm
                clientSecret={paymentFlow.clientSecret}
                onSuccess={submitPayLock}
                onError={(message) => toast(message, 'error')}
                buttonLabel="Pay With Card & Lock Escrow"
              />
            </Elements>
          ) : (
            <div className="loading-text">Preparing secure Stripe checkout...</div>
          )}
          <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
            Payment is confirmed in-app via Stripe, then escrow is locked automatically.
            Current intent status: <b>{paymentFlow.status || 'unknown'}</b>.
          </div>
        </Modal>
      )}

      {modal === 'proof' && (
        <Modal title="Submit Delivery Proof" onClose={() => setModal(null)} footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitProof}>📸 Submit Proof</button>
          </>
        }>
          <div className="form-group">
            <label>GPS Latitude</label>
            <input type="number" step="0.0001" className="form-input" value={proofForm.gpsLat} onChange={e => setProofForm({ ...proofForm, gpsLat: e.target.value })} />
          </div>
          <div className="form-group">
            <label>GPS Longitude</label>
            <input type="number" step="0.0001" className="form-input" value={proofForm.gpsLng} onChange={e => setProofForm({ ...proofForm, gpsLng: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Delivery Notes</label>
            <textarea className="form-input" value={proofForm.notes} onChange={e => setProofForm({ ...proofForm, notes: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Photo Proof (optional)</label>
            <input type="file" className="form-input" id="proof-image-input" accept="image/*" />
          </div>
        </Modal>
      )}

      {modal === 'dispute' && (
        <Modal title="Raise Dispute" onClose={() => setModal(null)} footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={submitDispute}>⚠️ Raise Dispute</button>
          </>
        }>
          <div className="form-group">
            <label>Reason for Dispute</label>
            <textarea className="form-input" style={{ minHeight: '120px' }} value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="Describe the issue with the delivery..." />
          </div>
          <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.82rem', color: 'var(--accent-rose)' }}>
            ⚠️ Raising a dispute will freeze the escrowed funds until an administrator reviews the case.
          </div>
        </Modal>
      )}

      {modal === 'resolve' && (
        <Modal title="Resolve Dispute" onClose={() => setModal(null)} footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitResolve}>⚖️ Resolve</button>
          </>
        }>
          <div className="form-group">
            <label>Resolution Decision</label>
            <select className="form-input" value={resolveDecision} onChange={e => setResolveDecision(e.target.value)}>
              <option value="RELEASE">RELEASE — Pay supplier in full</option>
              <option value="REFUND">REFUND — Refund customer in full</option>
              <option value="PARTIAL">PARTIAL — Split payment</option>
            </select>
          </div>
          {resolveDecision === 'PARTIAL' && (
            <div className="form-group">
              <label>Supplier Amount (₹)</label>
              <input type="number" className="form-input" value={resolveAmount} onChange={e => setResolveAmount(e.target.value)} min="0" />
            </div>
          )}
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="Blockchain History" onClose={() => setModal(null)}>
          <div style={{ marginBottom: '1rem' }}>
            <span className="order-id" style={{ fontSize: '0.9rem' }}>{currentOrderId}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: '0.5rem' }}>{history.length} transactions</span>
          </div>
          <div className="timeline">
            {history.map((block, i) => (
              <div key={block.index} className={`timeline-item ${i === history.length - 1 ? 'active' : ''}`}>
                <div className="tl-type">{getBlockIcon(block.data?.type)} {block.data?.type || 'Unknown'}</div>
                <div className="tl-time">{formatDate(block.timestamp)} · Block #{block.index}</div>
                <div className="tl-hash">🔑 {block.hash?.slice(0, 40)}...</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'newOrder' && (
        <Modal title="Create New Order" onClose={() => setModal(null)} footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitNewOrder} disabled={isCreatingOrder}>{isCreatingOrder ? 'Creating...' : '📦 Create Order'}</button>
          </>
        }>
          <div className="form-group">
            <label>Supplier</label>
            <select className="form-input" value={orderForm.supplierId} onChange={e => setOrderForm({ ...orderForm, supplierId: e.target.value })}>
              <option value="USR-S001">TransCo Logistics</option>
              <option value="USR-S002">QuickShip India</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input className="form-input" value={orderForm.description} onChange={e => setOrderForm({ ...orderForm, description: e.target.value })} placeholder="e.g. Electronics shipment" required />
          </div>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input type="number" className="form-input" value={orderForm.amount} onChange={e => setOrderForm({ ...orderForm, amount: e.target.value })} placeholder="5000" min="100" required />
          </div>
          <div className="form-group">
            <label>Pickup Address</label>
            <input className="form-input" value={orderForm.pickupAddress} onChange={e => setOrderForm({ ...orderForm, pickupAddress: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Delivery Address</label>
            <input className="form-input" value={orderForm.deliveryAddress} onChange={e => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><ProtectedApp view="dashboard" /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><ProtectedApp view="orders" /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><ProtectedApp view="users" /></ProtectedRoute>} />
      <Route path="/blockchain" element={<ProtectedRoute><ProtectedApp view="blockchain" /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
