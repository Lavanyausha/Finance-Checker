/* ═══════════════════════════════════════════════════
   FINANCE TRACKER — Application Logic
   ═══════════════════════════════════════════════════ */

// ── Constants ──────────────────────────────────────
const API_BASE = '';
const CATEGORIES = ['Food', 'Travel', 'Bills', 'Salary', 'Others'];
const CATEGORY_COLORS = {
  Food: '#f97316',
  Travel: '#3b82f6',
  Bills: '#ef4444',
  Salary: '#22c55e',
  Others: '#a855f7'
};

// ── State ──────────────────────────────────────────
let transactions = [];
let currentUser = null;
let deleteTargetId = null;
let expenseChart = null;
let barChart = null;

// ── Format helpers ─────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ── Toast notification ─────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.className = `toast ${type}`;
  toastIcon.textContent = icons[type] || '';
  toastMsg.textContent = message;

  // Clear previous timeout
  if (toast._timeout) clearTimeout(toast._timeout);

  toast._timeout = setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.animation = '';
    }, 300);
  }, 3000);
}

// ════════════════════════════════════════════════════
// API FUNCTIONS
// ════════════════════════════════════════════════════

async function fetchTransactions() {
  const res = await fetch(`${API_BASE}/api/transactions`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

async function createTransaction(data) {
  const res = await fetch(`${API_BASE}/api/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create transaction');
  return res.json();
}

async function updateTransaction(id, data) {
  const res = await fetch(`${API_BASE}/api/transaction/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

async function deleteTransaction(id) {
  const res = await fetch(`${API_BASE}/api/transaction/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
  return res.json();
}

async function fetchSummary(month) {
  const res = await fetch(`${API_BASE}/api/summary/${month}`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

// ════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════

function navigateTo(pageName) {
  // Hide all pages
  document.querySelectorAll('#app-shell .page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  // Show target page
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.remove('hidden');
    targetPage.classList.add('active');
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  // Close mobile sidebar
  closeMobileSidebar();

  // Load page-specific data
  switch (pageName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'add-transaction':
      initAddTransactionPage();
      break;
    case 'history':
      loadHistory();
      break;
    case 'reports':
      loadReports();
      break;
  }
}

// ════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const loginError = document.getElementById('loginError');

  loginError.textContent = '';

  if (!username || !password) {
    loginError.textContent = 'Please enter both username and password.';
    return;
  }

  currentUser = username;

  // Update user display
  document.getElementById('userDisplay').textContent = username;
  document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();
  document.getElementById('mobileUserDisplay').textContent = username.charAt(0).toUpperCase();

  // Switch to app shell
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').classList.remove('hidden');

  navigateTo('dashboard');
  showToast(`Welcome back, ${username}!`, 'success');
}

function handleLogout() {
  currentUser = null;

  // Reset login form
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').textContent = '';

  // Switch views
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('page-login').style.display = '';
  document.getElementById('page-login').classList.add('active');

  showToast('Signed out successfully', 'info');
}

// ════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════

async function loadDashboard() {
  try {
    transactions = await fetchTransactions();

    const totalIncome = transactions
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    // Update cards
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);

    const balanceEl = document.getElementById('balance');
    balanceEl.textContent = formatCurrency(balance);
    balanceEl.classList.toggle('negative', balance < 0);

    // Recent transactions (last 5, sorted by date desc)
    const recent = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    renderRecentTable(recent);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderRecentTable(data) {
  const tbody = document.getElementById('recentTableBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions yet. Add your first one!</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="type-badge ${t.type.toLowerCase()}">${t.type === 'Income' ? '↑' : '↓'} ${t.type}</span></td>
      <td><span class="category-badge" data-cat="${t.category}">${t.category}</span></td>
      <td><span class="amount ${t.type === 'Income' ? 'income-amount' : 'expense-amount'}">${t.type === 'Income' ? '+' : '-'}${formatCurrency(t.amount)}</span></td>
    </tr>
  `).join('');
}

// ════════════════════════════════════════════════════
// ADD TRANSACTION
// ════════════════════════════════════════════════════

function initAddTransactionPage() {
  // Set max date to today
  const dateInput = document.getElementById('date');
  dateInput.setAttribute('max', getTodayString());

  // Clear messages
  document.getElementById('errorMessage').textContent = '';
  document.getElementById('successMessage').textContent = '';
}

function validateTransactionForm(type, amount, category, date, errorElId) {
  const errorEl = document.getElementById(errorElId);
  errorEl.textContent = '';

  if (!type) {
    errorEl.textContent = 'Please select a transaction type.';
    return false;
  }

  if (!amount || isNaN(amount)) {
    errorEl.textContent = 'Amount must be a valid number.';
    return false;
  }

  if (Number(amount) <= 0) {
    errorEl.textContent = 'Amount must be greater than 0.';
    return false;
  }

  if (!Number.isFinite(Number(amount))) {
    errorEl.textContent = 'Please enter a valid amount.';
    return false;
  }

  if (!category) {
    errorEl.textContent = 'Please select a category.';
    return false;
  }

  if (!date) {
    errorEl.textContent = 'Please select a date.';
    return false;
  }

  const selectedDate = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (selectedDate > today) {
    errorEl.textContent = 'Future dates are not allowed.';
    return false;
  }

  return true;
}

async function handleAddTransaction(e) {
  e.preventDefault();

  const type = document.getElementById('type').value;
  const amount = document.getElementById('amount').value;
  const category = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  const successEl = document.getElementById('successMessage');
  const errorEl = document.getElementById('errorMessage');

  successEl.textContent = '';

  if (!validateTransactionForm(type, amount, category, date, 'errorMessage')) {
    return;
  }

  try {
    const addBtn = document.getElementById('addBtn');
    addBtn.disabled = true;
    addBtn.innerHTML = '<span>Adding...</span>';

    await createTransaction({
      type,
      amount: Number(amount),
      category,
      date
    });

    // Reset form
    document.getElementById('transactionForm').reset();
    errorEl.textContent = '';
    successEl.textContent = 'Transaction added successfully!';

    addBtn.disabled = false;
    addBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
      <span>Add Transaction</span>
    `;

    showToast('Transaction added successfully!', 'success');

    // Clear success message after 3 seconds
    setTimeout(() => {
      successEl.textContent = '';
    }, 3000);
  } catch (err) {
    console.error('Add transaction error:', err);
    errorEl.textContent = 'Failed to add transaction. Please try again.';
    document.getElementById('addBtn').disabled = false;
    document.getElementById('addBtn').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
      <span>Add Transaction</span>
    `;
    showToast('Failed to add transaction', 'error');
  }
}

// ════════════════════════════════════════════════════
// TRANSACTION HISTORY
// ════════════════════════════════════════════════════

async function loadHistory() {
  try {
    transactions = await fetchTransactions();
    populateMonthFilter();
    applyFilters();
  } catch (err) {
    console.error('History load error:', err);
    showToast('Failed to load transactions', 'error');
  }
}

function populateMonthFilter() {
  const monthSet = new Set();
  transactions.forEach(t => {
    if (t.date) {
      monthSet.add(t.date.substring(0, 7));
    }
  });

  const months = [...monthSet].sort().reverse();
  const filterMonth = document.getElementById('filterMonth');
  const reportMonth = document.getElementById('reportMonth');

  const monthOptions = months.map(m => {
    const [year, month] = m.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  }).join('');

  filterMonth.innerHTML = `<option value="">All Months</option>${monthOptions}`;
  reportMonth.innerHTML = `<option value="">All Time</option>${monthOptions}`;
}

function applyFilters() {
  const categoryFilter = document.getElementById('filterCategory').value;
  const monthFilter = document.getElementById('filterMonth').value;

  let filtered = [...transactions];

  if (categoryFilter) {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }

  if (monthFilter) {
    filtered = filtered.filter(t => t.date && t.date.startsWith(monthFilter));
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  renderHistoryTable(filtered);
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('transactionTableBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No transactions match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => `
    <tr data-id="${t.id}">
      <td>${formatDate(t.date)}</td>
      <td><span class="type-badge ${t.type.toLowerCase()}">${t.type === 'Income' ? '↑' : '↓'} ${t.type}</span></td>
      <td><span class="category-badge" data-cat="${t.category}">${t.category}</span></td>
      <td><span class="amount ${t.type === 'Income' ? 'income-amount' : 'expense-amount'}">${t.type === 'Income' ? '+' : '-'}${formatCurrency(t.amount)}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit-btn" data-id="${t.id}" title="Edit">
            ✏️ Edit
          </button>
          <button class="action-btn delete-btn" data-id="${t.id}" title="Delete">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ════════════════════════════════════════════════════
// EDIT TRANSACTION
// ════════════════════════════════════════════════════

function openEditModal(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  document.getElementById('editId').value = transaction.id;
  document.getElementById('editType').value = transaction.type;
  document.getElementById('editAmount').value = transaction.amount;
  document.getElementById('editCategory').value = transaction.category;
  document.getElementById('editDate').value = transaction.date;
  document.getElementById('editDate').setAttribute('max', getTodayString());
  document.getElementById('editErrorMessage').textContent = '';

  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

async function handleEditTransaction(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById('editId').value);
  const type = document.getElementById('editType').value;
  const amount = document.getElementById('editAmount').value;
  const category = document.getElementById('editCategory').value;
  const date = document.getElementById('editDate').value;

  if (!validateTransactionForm(type, amount, category, date, 'editErrorMessage')) {
    return;
  }

  try {
    const updateBtn = document.getElementById('updateBtn');
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    await updateTransaction(id, {
      type,
      amount: Number(amount),
      category,
      date
    });

    closeEditModal();
    showToast('Transaction updated successfully!', 'success');

    // Refresh the current page data
    await loadHistory();
  } catch (err) {
    console.error('Update error:', err);
    document.getElementById('editErrorMessage').textContent = 'Failed to update transaction.';
    showToast('Failed to update transaction', 'error');
  } finally {
    const updateBtn = document.getElementById('updateBtn');
    updateBtn.disabled = false;
    updateBtn.textContent = 'Update Transaction';
  }
}

// ════════════════════════════════════════════════════
// DELETE TRANSACTION
// ════════════════════════════════════════════════════

function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

async function handleDeleteTransaction() {
  if (!deleteTargetId) return;

  try {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';

    await deleteTransaction(deleteTargetId);

    closeDeleteModal();
    showToast('Transaction deleted successfully!', 'success');

    // Refresh the current page data
    await loadHistory();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete transaction', 'error');
    closeDeleteModal();
  } finally {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete';
  }
}

// ════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════

async function loadReports() {
  try {
    transactions = await fetchTransactions();
    populateMonthFilter();

    const selectedMonth = document.getElementById('reportMonth').value;

    let reportData;
    if (selectedMonth) {
      reportData = await fetchSummary(selectedMonth);
    } else {
      // Calculate from all transactions
      reportData = calculateAllTimeSummary();
    }

    renderCharts(reportData);
    renderReportSummary(reportData);
  } catch (err) {
    console.error('Reports load error:', err);
    showToast('Failed to load reports', 'error');
  }
}

function calculateAllTimeSummary() {
  const totalIncome = transactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryBreakdown = {};
  transactions.filter(t => t.type === 'Expense').forEach(t => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Number(t.amount);
  });

  return {
    month: 'All Time',
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryBreakdown,
    transactionCount: transactions.length
  };
}

function renderCharts(data) {
  const chartEl = document.getElementById('expenseChart');
  const chartEmpty = document.getElementById('chartEmpty');

  // Destroy existing charts
  if (expenseChart) {
    expenseChart.destroy();
    expenseChart = null;
  }
  if (barChart) {
    barChart.destroy();
    barChart = null;
  }

  const categories = Object.keys(data.categoryBreakdown || {});
  const values = Object.values(data.categoryBreakdown || {});

  // Pie/Doughnut chart
  if (categories.length === 0) {
    chartEl.style.display = 'none';
    chartEmpty.classList.remove('hidden');
  } else {
    chartEl.style.display = 'block';
    chartEmpty.classList.add('hidden');

    const colors = categories.map(c => CATEGORY_COLORS[c] || '#94a3b8');

    expenseChart = new Chart(chartEl, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#1a1f2e',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              padding: 16,
              font: { family: 'Inter', size: 13, weight: 500 },
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((context.parsed / total) * 100).toFixed(1);
                return ` ${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  // Bar chart — Income vs Expense
  const barEl = document.getElementById('barChart');
  barChart = new Chart(barEl, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [data.totalIncome, data.totalExpense],
        backgroundColor: ['rgba(52, 211, 153, 0.7)', 'rgba(248, 113, 113, 0.7)'],
        borderColor: ['#34d399', '#f87171'],
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Inter', weight: 600 },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: function(context) {
              return ` ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'Inter', weight: 600 } }
        },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter' },
            callback: function(value) {
              return '₹' + value.toLocaleString('en-IN');
            }
          }
        }
      }
    }
  });
}

function renderReportSummary(data) {
  const statsEl = document.getElementById('reportStats');
  const balance = data.totalIncome - data.totalExpense;

  statsEl.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Total Income</span>
      <span class="stat-value income-stat">${formatCurrency(data.totalIncome)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Total Expense</span>
      <span class="stat-value expense-stat">${formatCurrency(data.totalExpense)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Net Balance</span>
      <span class="stat-value balance-stat ${balance < 0 ? 'negative' : ''}">${formatCurrency(balance)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Transactions</span>
      <span class="stat-value">${data.transactionCount}</span>
    </div>
  `;
}

// ════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ════════════════════════════════════════════════════

function toggleMobileSidebar() {
  const sidebar = document.getElementById('navbar');
  const overlay = document.querySelector('.sidebar-overlay');

  sidebar.classList.toggle('open');

  if (!overlay) {
    const el = document.createElement('div');
    el.className = 'sidebar-overlay active';
    el.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(el);
  } else {
    overlay.classList.toggle('active');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('navbar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

// ════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Navigation
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', toggleMobileSidebar);

  // Add Transaction form
  document.getElementById('transactionForm').addEventListener('submit', handleAddTransaction);

  // Filters
  document.getElementById('filterCategory').addEventListener('change', applyFilters);
  document.getElementById('filterMonth').addEventListener('change', applyFilters);
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterMonth').value = '';
    applyFilters();
  });

  // Report month filter
  document.getElementById('reportMonth').addEventListener('change', loadReports);

  // Edit modal
  document.getElementById('editForm').addEventListener('submit', handleEditTransaction);
  document.getElementById('closeModal').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

  // Delete modal
  document.getElementById('confirmDeleteBtn').addEventListener('click', handleDeleteTransaction);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);

  // Close modals on overlay click
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeEditModal();
  });
  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });

  // History table action delegation (Edit & Delete buttons)
  document.getElementById('transactionTableBody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      openEditModal(id);
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      openDeleteModal(id);
    }
  });

  // Close modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
    }
  });

  // Set max date on add transaction date input
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.setAttribute('max', getTodayString());
  }
});
