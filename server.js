const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults({
  static: path.join(__dirname, 'public')
});

server.use(middlewares);
server.use(jsonServer.bodyParser);

// ──────────────────────────────────────────────
// POST /api/transaction — Add a new transaction
// ──────────────────────────────────────────────
server.post('/api/transaction', (req, res) => {
  const db = router.db;
  const transactions = db.get('transactions');
  const all = transactions.value();
  const maxId = all.length > 0 ? Math.max(...all.map(t => t.id)) : 0;

  const transaction = {
    id: maxId + 1,
    type: req.body.type,
    amount: Number(req.body.amount),
    category: req.body.category,
    date: req.body.date
  };

  transactions.push(transaction).write();
  res.status(201).json(transaction);
});

// ──────────────────────────────────────────────
// GET /api/transactions — Get all transactions
// ──────────────────────────────────────────────
server.get('/api/transactions', (req, res) => {
  const db = router.db;
  const transactions = db.get('transactions').value();
  res.json(transactions);
});

// ──────────────────────────────────────────────
// PUT /api/transaction/:id — Update a transaction
// ──────────────────────────────────────────────
server.put('/api/transaction/:id', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id);
  const record = db.get('transactions').find({ id });

  if (!record.value()) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  record.assign({
    type: req.body.type || record.value().type,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : record.value().amount,
    category: req.body.category || record.value().category,
    date: req.body.date || record.value().date
  }).write();

  res.json(record.value());
});

// ──────────────────────────────────────────────
// DELETE /api/transaction/:id — Delete a transaction
// ──────────────────────────────────────────────
server.delete('/api/transaction/:id', (req, res) => {
  const db = router.db;
  const id = parseInt(req.params.id);
  const record = db.get('transactions').find({ id }).value();

  if (!record) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  db.get('transactions').remove({ id }).write();
  res.json({ message: 'Transaction deleted successfully' });
});

// ──────────────────────────────────────────────
// GET /api/summary/:month — Monthly summary
// ──────────────────────────────────────────────
server.get('/api/summary/:month', (req, res) => {
  const db = router.db;
  const month = req.params.month; // Format: YYYY-MM
  const transactions = db.get('transactions').value();

  const filtered = transactions.filter(t => t.date && t.date.startsWith(month));

  const totalIncome = filtered
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = filtered
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const categoryBreakdown = {};
  filtered.filter(t => t.type === 'Expense').forEach(t => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Number(t.amount);
  });

  res.json({
    month,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryBreakdown,
    transactionCount: filtered.length
  });
});

// Default json-server router (for direct db access as fallback)
server.use(router);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   💰 Finance Tracker Server Running!     ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║   🌐 App:  http://localhost:${PORT}           ║`);
  console.log(`  ║   📡 API:  http://localhost:${PORT}/api       ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
