const BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('escrow_token');
}

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data.data !== undefined ? data.data : data;
}

const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Users (admin)
  getUsers: () => request('/auth/users'),
  getActiveUsers: () => request('/auth/users/active'),
  promoteUser: (id) => request(`/auth/users/${id}/promote`, { method: 'POST' }),
  demoteUser: (id, newRole) =>
    request(`/auth/users/${id}/demote`, { method: 'POST', body: JSON.stringify({ newRole }) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${id}`),
  getDrivers: () => request('/orders/utils/drivers'),
  createOrder: (data, requestId) =>
    request('/orders', {
      method: 'POST',
      headers: requestId ? { 'x-idempotency-key': requestId } : undefined,
      body: JSON.stringify({ ...data, requestId }),
    }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
  payOrder: (id, paymentIntentId) =>
    request(`/orders/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
    }),
  assignDriver: (id, driverId) =>
    request(`/orders/${id}/assign`, { method: 'POST', body: JSON.stringify({ driverId }) }),
  confirmDelivery: (id) =>
    request(`/orders/${id}/confirm`, { method: 'POST' }),
  raiseDispute: (id, reason) =>
    request(`/orders/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resolveDispute: (id, decision, amount) =>
    request(`/orders/${id}/resolve`, { method: 'POST', body: JSON.stringify({ decision, amount }) }),
  getOrderHistory: (id) => request(`/orders/${id}/history`),

  // Delivery proof (multipart/form-data)
  submitProof: async (id, formData) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/orders/${id}/proof`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit proof');
    return data.data !== undefined ? data.data : data;
  },

  // Blockchain
  getChain: () => request('/blockchain/chain'),
  validateChain: () => request('/blockchain/validate'),
  getStats: () => request('/blockchain/stats'),

  // Payments
  getStripeConfig: () => request('/payments/config'),
  createPaymentIntent: (orderId, amount) =>
    request('/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }),
};

export default api;
