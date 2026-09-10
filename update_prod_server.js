const fs = require('fs');
const path = require('path');

// 1. UPDATE SERVER.JS
const serverCode = `const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb, writeDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function generateRefCode() {
  return Math.random().toString(36).substring(2, 8);
}

// ----------------- USER AUTH ----------------- //

app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, w_password, ref_by } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ code: 400, msg: 'Please fill in all required fields' });
  }

  const db = readDb();
  const existing = db.users.find(u => u.phone === phone.trim());
  if (existing) {
    return res.status(400).json({ code: 400, msg: 'Phone number already registered. Please login.' });
  }

  const newId = Math.floor(10000 + Math.random() * 90000);
  const refCode = generateRefCode();
  const welcomeBonus = db.settings.welcomeBonus || 0;

  const newUser = {
    id: newId,
    name: name.trim(),
    phone: phone.trim(),
    password: password,
    wPassword: w_password || password,
    refCode: refCode,
    refBy: ref_by || 'ADMIN',
    balance: welcomeBonus,
    totalEarnings: 0,
    totalRecharge: 0,
    totalWithdraw: 0,
    status: 'active',
    bankDetails: {
      accountName: name.trim(),
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: ''
    },
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);

  return res.json({
    code: 200,
    msg: 'Registration successful!',
    user: newUser,
    redirect: '/'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.phone === phone.trim() && u.password === password);

  if (!user) {
    return res.status(400).json({ code: 400, msg: 'Invalid phone number or password' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ code: 403, msg: 'Your account has been suspended by administration.' });
  }

  return res.json({ code: 200, msg: 'Login successful!', user, redirect: '/' });
});

app.get('/api/auth/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });
  return res.json({ code: 200, user });
});

app.post('/api/user/bank', (req, res) => {
  const { userId, accountName, bankName, accountNumber, ifsc, upiId } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  user.bankDetails = {
    accountName: accountName || user.bankDetails.accountName,
    bankName: bankName || user.bankDetails.bankName,
    accountNumber: accountNumber || user.bankDetails.accountNumber,
    ifsc: ifsc || user.bankDetails.ifsc,
    upiId: upiId || user.bankDetails.upiId
  };

  writeDb(db);
  return res.json({ code: 200, msg: 'Bank details saved successfully', user });
});

// ----------------- PRODUCTS & ORDERS ----------------- //

app.get('/api/products', (req, res) => {
  const db = readDb();
  return res.json({ code: 200, products: db.products, settings: db.settings });
});

app.post('/api/orders/buy', (req, res) => {
  const { userId, productId } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  const product = db.products.find(p => p.id === parseInt(productId));

  if (!user || !product) return res.status(404).json({ code: 404, msg: 'User or Plan not found' });
  if (product.isComingSoon) return res.status(400).json({ code: 400, msg: 'This plan is coming soon!' });

  if (user.balance < product.price) {
    return res.status(400).json({
      code: 400,
      msg: \`Insufficient real balance! You need ₹\${product.price}. Your balance is ₹\${user.balance}. Please recharge using the PhonePe QR.\`,
      needRecharge: true
    });
  }

  // Deduct real balance
  user.balance -= product.price;

  const orderId = 'ORD' + Date.now();
  const newOrder = {
    id: orderId,
    userId: user.id,
    productId: product.id,
    productName: product.name,
    planTitle: product.planTitle,
    price: product.price,
    dailyIncome: product.dailyIncome,
    totalIncome: product.totalIncome,
    duration: product.duration,
    daysCompleted: 1,
    totalEarned: product.dailyIncome,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.orders.push(newOrder);

  // Credit Day 1 daily income
  user.balance += product.dailyIncome;
  user.totalEarnings += product.dailyIncome;

  db.transactions.push({
    id: 'TX' + Date.now(),
    userId: user.id,
    type: 'plan_buy',
    amount: -product.price,
    status: 'completed',
    details: \`Purchased \${product.planTitle} (\${product.name})\`,
    createdAt: new Date().toISOString()
  });

  db.transactions.push({
    id: 'TX' + (Date.now() + 1),
    userId: user.id,
    type: 'daily_profit',
    amount: product.dailyIncome,
    status: 'completed',
    details: \`Day 1 return from \${product.planTitle}\`,
    createdAt: new Date().toISOString()
  });

  // Level 1 Referral commission (15%)
  if (user.refBy && user.refBy !== 'ADMIN') {
    const referrer = db.users.find(u => u.refCode === user.refBy || u.phone === user.refBy);
    if (referrer) {
      const comm = Math.round(product.price * 0.15);
      referrer.balance += comm;
      referrer.totalEarnings += comm;
      db.transactions.push({
        id: 'TX' + (Date.now() + 2),
        userId: referrer.id,
        type: 'commission',
        amount: comm,
        status: 'completed',
        details: \`15% Partner Commission from User \${user.id} (\${product.planTitle})\`,
        createdAt: new Date().toISOString()
      });
    }
  }

  writeDb(db);
  return res.json({
    code: 200,
    msg: \`Plan purchased successfully! First day return ₹\${product.dailyIncome} added to your wallet.\`,
    user,
    order: newOrder
  });
});

app.get('/api/orders/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const userOrders = db.orders.filter(o => o.userId === userId);
  return res.json({ code: 200, orders: userOrders });
});

// ----------------- REAL QR RECHARGE & WITHDRAW ----------------- //

// User submits UTR after paying to PhonePe QR
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, amount, utr, method } = req.body;
  const depAmt = parseFloat(amount);

  if (!depAmt || depAmt <= 0) {
    return res.status(400).json({ code: 400, msg: 'Please enter a valid recharge amount' });
  }

  if (!utr || utr.trim().length < 6) {
    return res.status(400).json({ code: 400, msg: 'Please enter the valid 12-digit UTR from your payment app' });
  }

  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  // PENDING review for Admin
  const tx = {
    id: 'DEP' + Date.now(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    type: 'deposit',
    amount: depAmt,
    utr: utr.trim(),
    status: 'pending',
    details: \`Recharge via PhonePe QR (UTR: \${utr.trim()})\`,
    createdAt: new Date().toISOString()
  };

  db.transactions.push(tx);
  writeDb(db);

  return res.json({
    code: 200,
    msg: \`Payment submitted for verification! UTR: \${utr.trim()}. Once verified by Admin, ₹\${depAmt} will be added to your balance.\`,
    user,
    transaction: tx
  });
});

// User submits withdrawal request
app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, amount, wPassword } = req.body;
  const wAmt = parseFloat(amount);
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));

  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  const minW = db.settings.minWithdrawal || 120;
  const maxW = db.settings.maxWithdrawal || 20000;

  if (wAmt < minW || wAmt > maxW) {
    return res.status(400).json({ code: 400, msg: \`Withdrawal amount must be between ₹\${minW} and ₹\${maxW}\` });
  }

  if (user.balance < wAmt) {
    return res.status(400).json({ code: 400, msg: \`Insufficient balance! Your balance is ₹\${user.balance}\` });
  }

  if (user.wPassword && wPassword && user.wPassword !== wPassword) {
    return res.status(400).json({ code: 400, msg: 'Incorrect withdrawal password' });
  }

  if (!user.bankDetails || (!user.bankDetails.accountNumber && !user.bankDetails.upiId)) {
    return res.status(400).json({
      code: 400,
      msg: 'Please bind your Bank Account or UPI ID first in your Profile.'
    });
  }

  // Deduct balance and queue for Admin approval
  user.balance -= wAmt;

  const tx = {
    id: 'WTH' + Date.now(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    type: 'withdraw',
    amount: wAmt,
    status: 'pending',
    bankDetails: user.bankDetails,
    details: \`Withdrawal to \${user.bankDetails.upiId || user.bankDetails.accountNumber} (\${user.bankDetails.bankName || 'UPI'})\`,
    createdAt: new Date().toISOString()
  };

  db.transactions.push(tx);
  writeDb(db);

  return res.json({
    code: 200,
    msg: \`Withdrawal request for ₹\${wAmt} submitted! Admin will transfer funds to \${user.bankDetails.upiId || user.bankDetails.accountNumber} during payout hours (\${db.settings.payoutHours}).\`,
    user,
    transaction: tx
  });
});

app.get('/api/wallet/history/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const txs = db.transactions.filter(t => t.userId === userId).reverse();
  return res.json({ code: 200, transactions: txs });
});

// ----------------- TEAM ----------------- //

app.get('/api/team/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  const level1 = db.users.filter(u => u.refBy === user.refCode || u.refBy === user.phone);
  const level1Codes = level1.map(u => u.refCode);
  const level2 = db.users.filter(u => level1Codes.includes(u.refBy));
  const level2Codes = level2.map(u => u.refCode);
  const level3 = db.users.filter(u => level2Codes.includes(u.refBy));

  const commissions = db.transactions
    .filter(t => t.userId === user.id && t.type === 'commission')
    .reduce((sum, t) => sum + t.amount, 0);

  return res.json({
    code: 200,
    refCode: user.refCode,
    totalMembers: level1.length + level2.length + level3.length,
    totalCommission: commissions,
    tiers: [
      { name: 'Level 1', rate: '15%', count: level1.length, members: level1.map(m => ({ id: m.id, name: m.name, phone: m.phone, balance: m.balance })) },
      { name: 'Level 2', rate: '7%', count: level2.length, members: level2.map(m => ({ id: m.id, name: m.name, phone: m.phone, balance: m.balance })) },
      { name: 'Level 3', rate: '3%', count: level3.length, members: level3.map(m => ({ id: m.id, name: m.name, phone: m.phone, balance: m.balance })) }
    ]
  });
});

// ----------------- COMPLETE PRODUCTION ADMIN PORTAL ----------------- //

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const adminUser = db.settings.adminUsername || 'admin';
  const adminPass = db.settings.adminPassword || 'Admin@KitKat2026';

  if (username === adminUser && password === adminPass) {
    return res.json({ code: 200, msg: 'Admin login authorized!', token: 'ADMIN_AUTH_TOKEN_2026' });
  } else {
    return res.status(401).json({ code: 401, msg: 'Invalid Admin username or password' });
  }
});

// Admin Full Data (Users, Deposits, Withdrawals, Stats)
app.get('/api/admin/data', (req, res) => {
  const db = readDb();
  const pendingDeposits = db.transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawals = db.transactions.filter(t => t.type === 'withdraw' && t.status === 'pending');

  const totalDepositAmount = db.transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawAmount = db.transactions
    .filter(t => t.type === 'withdraw' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  return res.json({
    code: 200,
    stats: {
      totalUsers: db.users.length,
      pendingDepositsCount: pendingDeposits.length,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      totalDepositAmount,
      totalWithdrawAmount,
      totalOrders: db.orders.length
    },
    data: db
  });
});

// Admin approves deposit (credits real user balance)
app.post('/api/admin/deposit/approve', (req, res) => {
  const { txId } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'deposit');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: \`Already \${tx.status}\` });

  const user = db.users.find(u => u.id === tx.userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  user.balance += tx.amount;
  user.totalRecharge += tx.amount;
  tx.status = 'completed';
  tx.approvedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: \`Recharge of ₹\${tx.amount} APPROVED! ₹\${tx.amount} added to \${user.name} (Phone: \${user.phone})\` });
});

// Admin rejects deposit
app.post('/api/admin/deposit/reject', (req, res) => {
  const { txId, reason } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'deposit');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: \`Already \${tx.status}\` });

  tx.status = 'rejected';
  tx.rejectedReason = reason || 'Payment not verified / Invalid UTR';
  tx.rejectedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: \`Deposit of ₹\${tx.amount} rejected.\` });
});

// Admin marks withdrawal as Paid
app.post('/api/admin/withdraw/approve', (req, res) => {
  const { txId, payoutRef } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'withdraw');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: \`Already \${tx.status}\` });

  const user = db.users.find(u => u.id === tx.userId);
  if (user) {
    user.totalWithdraw += tx.amount;
  }

  tx.status = 'completed';
  tx.payoutRef = payoutRef || 'Transferred by Admin';
  tx.approvedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: \`Withdrawal of ₹\${tx.amount} marked as Paid/Transferred successfully!\` });
});

// Admin rejects withdrawal and refunds money back to user wallet
app.post('/api/admin/withdraw/reject', (req, res) => {
  const { txId, reason } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'withdraw');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: \`Already \${tx.status}\` });

  const user = db.users.find(u => u.id === tx.userId);
  if (user) {
    user.balance += tx.amount; // Refund balance!
  }

  tx.status = 'rejected';
  tx.rejectedReason = reason || 'Bank details incorrect';
  tx.rejectedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: \`Withdrawal rejected. ₹\${tx.amount} refunded back to user wallet.\` });
});

// Admin direct balance modification
app.post('/api/admin/balance', (req, res) => {
  const { userId, amount, action } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  const delta = parseFloat(amount);
  if (action === 'add') {
    user.balance += delta;
  } else {
    user.balance = Math.max(0, user.balance - delta);
  }

  writeDb(db);
  return res.json({ code: 200, msg: \`User balance updated to ₹\${user.balance}\`, user });
});

// Admin change user status (active / banned)
app.post('/api/admin/user/status', (req, res) => {
  const { userId, status } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  user.status = status;
  writeDb(db);
  return res.json({ code: 200, msg: \`User status updated to \${status}\` });
});

// Admin view specific user's team downline
app.get('/api/admin/user/:id/team', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  const team = db.users.filter(u => u.refBy === user.refCode || u.refBy === user.phone);
  return res.json({ code: 200, user, team });
});

// Admin update settings (UPI ID, payee name, password, telegram, etc.)
app.post('/api/admin/settings', (req, res) => {
  const { siteName, brandTitle, slogan, launchDate, welcomeBonus, partnerIncome, payoutHours, minWithdrawal, maxWithdrawal, telegramLink, upiId, payeeName, adminPassword } = req.body;
  const db = readDb();

  db.settings = {
    ...db.settings,
    siteName: siteName || db.settings.siteName,
    brandTitle: brandTitle || db.settings.brandTitle,
    slogan: slogan || db.settings.slogan,
    launchDate: launchDate || db.settings.launchDate,
    welcomeBonus: welcomeBonus !== undefined ? parseFloat(welcomeBonus) : db.settings.welcomeBonus,
    partnerIncome: partnerIncome || db.settings.partnerIncome,
    payoutHours: payoutHours || db.settings.payoutHours,
    minWithdrawal: minWithdrawal !== undefined ? parseFloat(minWithdrawal) : db.settings.minWithdrawal,
    maxWithdrawal: maxWithdrawal !== undefined ? parseFloat(maxWithdrawal) : db.settings.maxWithdrawal,
    telegramLink: telegramLink || db.settings.telegramLink,
    upiId: upiId || db.settings.upiId,
    payeeName: payeeName || db.settings.payeeName,
    adminPassword: adminPassword || db.settings.adminPassword || 'Admin@KitKat2026'
  };

  writeDb(db);
  return res.json({ code: 200, msg: 'Settings updated successfully', settings: db.settings });
});

// Routing
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(\`KitKat Platform Server running at http://localhost:\${PORT}\`);
});
\`;

fs.writeFileSync(path.join(__dirname, 'server.js'), serverCode, 'utf8');
console.log('server.js updated with production features!');
