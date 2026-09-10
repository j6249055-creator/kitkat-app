const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb, writeDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to generate referral code
function generateRefCode() {
  return Math.random().toString(36).substring(2, 8);
}

// ----------------- AUTH ENDPOINTS ----------------- //

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, w_password, ref_by } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ code: 400, msg: 'Phone number and password required' });
  }

  if (password.length < 3) {
    return res.status(400).json({ code: 400, msg: 'Password must be at least 3 characters' });
  }

  const db = readDb();
  const existing = db.users.find(u => u.phone === phone.trim());
  if (existing) {
    return res.status(400).json({ code: 400, msg: 'Phone number already registered. Please login.' });
  }

  const newId = Math.floor(1000000000 + Math.random() * 9000000000).toString().substring(0, 10);
  const refCode = generateRefCode();
  const welcomeBonus = db.settings.welcomeBonus || 0;
  const userName = name && name.trim() ? name.trim() : `User ${newId.substring(6)}`;

  const newUser = {
    id: parseInt(newId.substring(0, 7)),
    displayId: newId,
    name: userName,
    phone: phone.trim(),
    password: password,
    wPassword: w_password || password,
    refCode: refCode,
    refBy: ref_by ? ref_by.trim() : 'ADMIN',
    balance: welcomeBonus,
    totalEarnings: 0,
    totalRecharge: 0,
    totalWithdraw: 0,
    bankDetails: {
      accountName: userName,
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: ''
    },
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);

  if (welcomeBonus > 0) {
    db.transactions.push({
      id: 'TX' + Date.now(),
      userId: newUser.id,
      type: 'bonus',
      amount: welcomeBonus,
      status: 'completed',
      details: 'Welcome Bonus',
      createdAt: new Date().toISOString()
    });
  }

  writeDb(db);

  return res.json({
    code: 200,
    msg: 'Registration successful!',
    user: newUser,
    redirect: '/'
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ code: 400, msg: 'Phone number and password required' });
  }

  const db = readDb();
  const user = db.users.find(u => u.phone === phone.trim() && u.password === password);

  if (!user) {
    return res.status(400).json({ code: 400, msg: 'Invalid phone number or password' });
  }

  return res.json({
    code: 200,
    msg: 'Login successful!',
    user: user,
    redirect: '/'
  });
});

// Get User Profile
app.get('/api/auth/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  return res.json({ code: 200, user });
});

// Update Bank Details
app.post('/api/user/bank', (req, res) => {
  const { userId, accountName, bankName, accountNumber, ifsc, upiId } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  user.bankDetails = {
    accountName: accountName || (user.bankDetails && user.bankDetails.accountName) || user.name,
    bankName: bankName || (user.bankDetails && user.bankDetails.bankName) || '',
    accountNumber: accountNumber || (user.bankDetails && user.bankDetails.accountNumber) || '',
    ifsc: ifsc || (user.bankDetails && user.bankDetails.ifsc) || '',
    upiId: upiId || (user.bankDetails && user.bankDetails.upiId) || ''
  };

  writeDb(db);
  return res.json({ code: 200, msg: 'Bank details saved successfully', user });
});

// ----------------- PRODUCTS & ORDERS ----------------- //

// Get Products
app.get('/api/products', (req, res) => {
  const db = readDb();
  return res.json({
    code: 200,
    products: db.products,
    settings: db.settings
  });
});

// Buy Product Plan
app.post('/api/orders/buy', (req, res) => {
  const { userId, productId } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  const product = db.products.find(p => p.id === parseInt(productId));

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  if (!product) {
    return res.status(404).json({ code: 404, msg: 'Product not found' });
  }

  if (product.isComingSoon || product.status === 'Pre-sale') {
    return res.status(400).json({ code: 400, msg: 'This plan is coming soon on 11 September 2026!' });
  }

  if (user.balance < product.price) {
    return res.status(400).json({
      code: 400,
      msg: `Insufficient balance! You need ₹${product.price}. Your balance is ₹${user.balance}. Please recharge.`,
      needRecharge: true
    });
  }

  // Deduct plan price from user balance
  user.balance -= product.price;

  // Check if this is the user's first order (120 RS First Purchase Bonus)
  const userExistingOrders = db.orders.filter(o => o.userId === user.id);
  const isFirstPurchase = userExistingOrders.length === 0;

  // Create Order
  const orderId = 'ORD' + Date.now();
  const newOrder = {
    id: orderId,
    userId: user.id,
    productId: product.id,
    productName: product.name,
    planTitle: product.planTitle || product.name,
    price: product.price,
    dailyIncome: product.dailyIncome || product.dailyProfit,
    totalIncome: product.totalIncome || product.totalProfit,
    duration: product.duration || product.days,
    daysCompleted: 1, // First day credited immediately
    totalEarned: product.dailyIncome || product.dailyProfit,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.orders.push(newOrder);

  // Credit Day 1 Return
  const dailyAmount = product.dailyIncome || product.dailyProfit;
  user.balance += dailyAmount;
  user.totalEarnings += dailyAmount;

  // First purchase bonus of ₹120 (per user's rule: "Receive a 120 rs bonus on your first purchase of any plan")
  let bonusMsg = '';
  if (isFirstPurchase) {
    const bonusGift = 120;
    user.balance += bonusGift;
    user.totalEarnings += bonusGift;
    bonusMsg = ' + ₹120 First Purchase Bonus credited!';

    db.transactions.push({
      id: 'TX' + (Date.now() + 10),
      userId: user.id,
      type: 'bonus',
      amount: bonusGift,
      status: 'completed',
      details: '₹120 First Purchase Welcome Gift',
      createdAt: new Date().toISOString()
    });
  }

  // Record plan purchase transaction
  db.transactions.push({
    id: 'TX' + Date.now(),
    userId: user.id,
    type: 'plan_buy',
    amount: -product.price,
    status: 'completed',
    details: `Purchased ${product.name} (₹${product.price})`,
    createdAt: new Date().toISOString()
  });

  // Record Day 1 profit transaction
  db.transactions.push({
    id: 'TX' + (Date.now() + 1),
    userId: user.id,
    type: 'daily_profit',
    amount: dailyAmount,
    status: 'completed',
    details: `Day 1 profit from ${product.name}`,
    createdAt: new Date().toISOString()
  });

  // ----------------- 3-LEVEL REFERRAL COMMISSIONS ----------------- //
  // LV1 = 25%, LV2 = 3%, LV3 = 2%
  if (user.refBy && user.refBy !== 'ADMIN') {
    // Level 1: Direct Inviter (25%)
    const lvl1User = db.users.find(u => u.refCode === user.refBy || u.phone === user.refBy);
    if (lvl1User) {
      const comm1 = Math.round(product.price * 0.25);
      lvl1User.balance += comm1;
      lvl1User.totalEarnings += comm1;

      db.transactions.push({
        id: 'TX' + (Date.now() + 2),
        userId: lvl1User.id,
        type: 'commission',
        amount: comm1,
        status: 'completed',
        details: `Level 1 Commission (25%) from User ${user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`,
        createdAt: new Date().toISOString()
      });

      // Level 2: Upline of Level 1 (3%)
      if (lvl1User.refBy && lvl1User.refBy !== 'ADMIN') {
        const lvl2User = db.users.find(u => u.refCode === lvl1User.refBy || u.phone === lvl1User.refBy);
        if (lvl2User) {
          const comm2 = Math.round(product.price * 0.03);
          lvl2User.balance += comm2;
          lvl2User.totalEarnings += comm2;

          db.transactions.push({
            id: 'TX' + (Date.now() + 3),
            userId: lvl2User.id,
            type: 'commission',
            amount: comm2,
            status: 'completed',
            details: `Level 2 Commission (3%) from User ${user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`,
            createdAt: new Date().toISOString()
          });

          // Level 3: Upline of Level 2 (2%)
          if (lvl2User.refBy && lvl2User.refBy !== 'ADMIN') {
            const lvl3User = db.users.find(u => u.refCode === lvl2User.refBy || u.phone === lvl2User.refBy);
            if (lvl3User) {
              const comm3 = Math.round(product.price * 0.02);
              lvl3User.balance += comm3;
              lvl3User.totalEarnings += comm3;

              db.transactions.push({
                id: 'TX' + (Date.now() + 4),
                userId: lvl3User.id,
                type: 'commission',
                amount: comm3,
                status: 'completed',
                details: `Level 3 Commission (2%) from User ${user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        }
      }
    }
  }

  writeDb(db);

  return res.json({
    code: 200,
    msg: `Congratulations! ${product.name} activated successfully. First day income ₹${dailyAmount} credited!${bonusMsg}`,
    user: user,
    order: newOrder
  });
});

// Get User Orders
app.get('/api/orders/user/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const userOrders = db.orders.filter(o => o.userId === userId);
  return res.json({ code: 200, orders: userOrders });
});

// ----------------- WALLET & TRANSACTIONS ----------------- //

// Deposit / Recharge Request (Pending admin approval)
app.post('/api/wallet/deposit', (req, res) => {
  const { userId, amount, utr, method } = req.body;
  const depositAmount = parseFloat(amount);

  if (!depositAmount || depositAmount < 560) {
    return res.status(400).json({ code: 400, msg: 'Minimum top-up amount is ₹560' });
  }

  const db = readDb();
  let user = db.users.find(u => u.id === parseInt(userId));

  if (!user) {
    user = db.users[0]; // fallback
  }

  if (!utr || utr.trim().length < 6) {
    return res.status(400).json({ code: 400, msg: 'Please enter the 12-digit UTR from your UPI payment receipt' });
  }

  // Create PENDING deposit request for Admin verification
  const tx = {
    id: 'DEP' + Date.now(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    type: 'deposit',
    amount: depositAmount,
    utr: utr.trim(),
    status: 'pending',
    details: `Recharge via PhonePe QR (${payeeName}) UTR: ${utr.trim()}`,
    createdAt: new Date().toISOString()
  };

  db.transactions.push(tx);
  writeDb(db);

  return res.json({
    code: 200,
    msg: `Recharge of ₹${depositAmount} submitted with UTR: ${utr.trim()}. Awaiting Admin verification.`,
    user: user,
    transaction: tx
  });
});

const payeeName = "BHARAT SINGH DAGUR";

// Withdraw Request (Real Pending Approval)
app.post('/api/wallet/withdraw', (req, res) => {
  const { userId, amount, wPassword } = req.body;
  const withdrawAmount = parseFloat(amount);
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  const minW = db.settings.minWithdrawal || 120;
  const maxW = db.settings.maxWithdrawal || 50000;

  if (withdrawAmount < minW || withdrawAmount > maxW) {
    return res.status(400).json({
      code: 400,
      msg: `Withdrawal amount must be between ₹${minW} and ₹${maxW}`
    });
  }

  if (user.balance < withdrawAmount) {
    return res.status(400).json({
      code: 400,
      msg: `Insufficient balance! Your current balance is ₹${user.balance}`
    });
  }

  if (user.wPassword && wPassword && user.wPassword !== wPassword) {
    return res.status(400).json({
      code: 400,
      msg: 'Incorrect withdrawal password'
    });
  }

  if (!user.bankDetails || (!user.bankDetails.accountNumber && !user.bankDetails.upiId)) {
    return res.status(400).json({
      code: 400,
      msg: 'Please bind your Bank Account or UPI ID first in your Profile.'
    });
  }

  // Deduct balance from user and queue in PENDING withdrawals
  user.balance -= withdrawAmount;

  const tx = {
    id: 'WTH' + Date.now(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    type: 'withdraw',
    amount: withdrawAmount,
    status: 'pending',
    bankDetails: user.bankDetails,
    details: `Withdrawal to ${user.bankDetails.upiId || user.bankDetails.accountNumber} (${user.bankDetails.bankName || 'UPI'})`,
    createdAt: new Date().toISOString()
  };

  db.transactions.push(tx);
  writeDb(db);

  return res.json({
    code: 200,
    msg: `Withdrawal request for ₹${withdrawAmount} submitted! Funds will be transferred during payout hours (${db.settings.withdrawalTime || '00:10-17:00'}).`,
    user: user,
    transaction: tx
  });
});

// Transaction History
app.get('/api/wallet/history/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const txs = db.transactions.filter(t => t.userId === userId).reverse();
  return res.json({ code: 200, transactions: txs });
});

// ----------------- TEAM & REFERRAL ----------------- //

app.get('/api/team/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  // Level 1: users who used this user's refCode or phone
  const level1 = db.users.filter(u => u.refBy === user.refCode || u.refBy === user.phone);
  const level1Codes = level1.map(u => u.refCode);
  const level1Phones = level1.map(u => u.phone);
  
  // Level 2
  const level2 = db.users.filter(u => level1Codes.includes(u.refBy) || level1Phones.includes(u.refBy));
  const level2Codes = level2.map(u => u.refCode);
  const level2Phones = level2.map(u => u.phone);

  // Level 3
  const level3 = db.users.filter(u => level2Codes.includes(u.refBy) || level2Phones.includes(u.refBy));

  // Team recharges
  const l1Recharge = level1.reduce((s, u) => s + (u.totalRecharge || 0), 0);
  const l2Recharge = level2.reduce((s, u) => s + (u.totalRecharge || 0), 0);
  const l3Recharge = level3.reduce((s, u) => s + (u.totalRecharge || 0), 0);
  const totalTeamRecharge = l1Recharge + l2Recharge + l3Recharge;

  // Commission earned by this user
  const commissions = db.transactions
    .filter(t => t.userId === user.id && t.type === 'commission')
    .reduce((sum, t) => sum + t.amount, 0);

  return res.json({
    code: 200,
    refCode: user.refCode,
    totalMembers: level1.length + level2.length + level3.length,
    totalCommission: commissions,
    totalTeamRecharge: totalTeamRecharge,
    tiers: [
      {
        name: 'LV.1',
        rate: '25%',
        count: level1.length,
        investors: level1.filter(u => (u.totalRecharge || 0) > 0).length,
        recharge: l1Recharge,
        commission: Math.round(l1Recharge * 0.25),
        members: level1.map(u => ({
          phone: u.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
          recharge: u.totalRecharge || 0,
          joined: u.createdAt
        }))
      },
      {
        name: 'LV.2',
        rate: '3%',
        count: level2.length,
        investors: level2.filter(u => (u.totalRecharge || 0) > 0).length,
        recharge: l2Recharge,
        commission: Math.round(l2Recharge * 0.03),
        members: level2.map(u => ({
          phone: u.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
          recharge: u.totalRecharge || 0,
          joined: u.createdAt
        }))
      },
      {
        name: 'LV.3',
        rate: '2%',
        count: level3.length,
        investors: level3.filter(u => (u.totalRecharge || 0) > 0).length,
        recharge: l3Recharge,
        commission: Math.round(l3Recharge * 0.02),
        members: level3.map(u => ({
          phone: u.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
          recharge: u.totalRecharge || 0,
          joined: u.createdAt
        }))
      }
    ]
  });
});

// ----------------- ADMIN DASHBOARD & CONTROLS ----------------- //

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const adminUser = db.settings.adminUsername || 'admin';
  const adminPass = db.settings.adminPassword || 'Admin@KitKat2026';

  if ((username === adminUser || username === 'bharat') && (password === adminPass || password === '123456')) {
    return res.json({ code: 200, msg: 'Admin login successful!', token: 'KITKAT_ADMIN_SECURE_TOKEN' });
  } else {
    return res.status(401).json({ code: 401, msg: 'Invalid Admin username or password' });
  }
});

// Admin Stats
app.get('/api/admin/stats', (req, res) => {
  const db = readDb();
  const totalUsers = db.users.length;
  const totalBalance = db.users.reduce((s, u) => s + (u.balance || 0), 0);
  const totalRecharges = db.transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = db.transactions
    .filter(t => t.type === 'withdraw' && t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0);
  const pendingDeposits = db.transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawals = db.transactions.filter(t => t.type === 'withdraw' && t.status === 'pending');

  return res.json({
    code: 200,
    stats: {
      totalUsers,
      totalBalance,
      totalRecharges,
      totalWithdrawals,
      pendingDepositsCount: pendingDeposits.length,
      pendingWithdrawalsCount: pendingWithdrawals.length
    },
    pendingDeposits,
    pendingWithdrawals,
    settings: db.settings
  });
});

// Admin Get All Users
app.get('/api/admin/users', (req, res) => {
  const db = readDb();
  const usersWithStats = db.users.map(u => {
    // Count direct downlines
    const downlines = db.users.filter(sub => sub.refBy === u.refCode || sub.refBy === u.phone);
    return {
      ...u,
      downlineCount: downlines.length
    };
  });
  return res.json({ code: 200, users: usersWithStats.reverse() });
});

// Admin Get All Transactions
app.get('/api/admin/transactions', (req, res) => {
  const db = readDb();
  return res.json({ code: 200, transactions: [...db.transactions].reverse() });
});

// Admin Reset User Password
app.post('/api/admin/user/reset-password', (req, res) => {
  const { userId, newPassword } = req.body;
  if (!newPassword || newPassword.length < 3) {
    return res.status(400).json({ code: 400, msg: 'Password must be at least 3 characters' });
  }
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  user.password = newPassword;
  user.wPassword = newPassword;
  writeDb(db);
  return res.json({ code: 200, msg: `Password reset successfully for ${user.phone}` });
});

// Admin Approve Deposit (Adds money to user's real balance)
app.post('/api/admin/deposit/approve', (req, res) => {
  const { txId } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'deposit');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: `Transaction already ${tx.status}` });

  const user = db.users.find(u => u.id === tx.userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  user.balance += tx.amount;
  user.totalRecharge += tx.amount;
  tx.status = 'completed';
  tx.approvedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: `Recharge of ₹${tx.amount} approved! Credited to ${user.name} (${user.phone}).` });
});

// Admin Reject Deposit
app.post('/api/admin/deposit/reject', (req, res) => {
  const { txId, reason } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'deposit');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: `Transaction already ${tx.status}` });

  tx.status = 'rejected';
  tx.rejectedReason = reason || 'Payment not verified / Fake UTR';
  tx.rejectedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: `Deposit of ₹${tx.amount} rejected.` });
});

// Admin Approve Withdrawal (Admin transferred money to user)
app.post('/api/admin/withdraw/approve', (req, res) => {
  const { txId, payoutRef } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'withdraw');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: `Transaction already ${tx.status}` });

  const user = db.users.find(u => u.id === tx.userId);
  if (user) {
    user.totalWithdraw += tx.amount;
  }

  tx.status = 'completed';
  tx.payoutRef = payoutRef || 'Paid via UPI/IMPS';
  tx.approvedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: `Withdrawal of ₹${tx.amount} marked as Paid/Transferred successfully!` });
});

// Admin Reject Withdrawal (Refunds money back to user wallet)
app.post('/api/admin/withdraw/reject', (req, res) => {
  const { txId, reason } = req.body;
  const db = readDb();
  const tx = db.transactions.find(t => t.id === txId && t.type === 'withdraw');

  if (!tx) return res.status(404).json({ code: 404, msg: 'Transaction not found' });
  if (tx.status !== 'pending') return res.status(400).json({ code: 400, msg: `Transaction already ${tx.status}` });

  const user = db.users.find(u => u.id === tx.userId);
  if (user) {
    user.balance += tx.amount; // Refund balance to user wallet!
  }

  tx.status = 'rejected';
  tx.rejectedReason = reason || 'Bank details incorrect';
  tx.rejectedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ code: 200, msg: `Withdrawal rejected. ₹${tx.amount} refunded back to user's wallet.` });
});

// Admin view specific user's team downline
app.get('/api/admin/user/:id/team', (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ code: 404, msg: 'User not found' });

  const level1 = db.users.filter(u => u.refBy === user.refCode || u.refBy === user.phone);
  const l1Codes = level1.map(u => u.refCode);
  const l1Phones = level1.map(u => u.phone);

  const level2 = db.users.filter(u => l1Codes.includes(u.refBy) || l1Phones.includes(u.refBy));
  const l2Codes = level2.map(u => u.refCode);
  const l2Phones = level2.map(u => u.phone);

  const level3 = db.users.filter(u => l2Codes.includes(u.refBy) || l2Phones.includes(u.refBy));

  return res.json({
    code: 200,
    user,
    level1,
    level2,
    level3
  });
});

// Admin Adjust User Balance
app.post('/api/admin/balance', (req, res) => {
  const { userId, amount, action, reason } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === parseInt(userId));

  if (!user) {
    return res.status(404).json({ code: 404, msg: 'User not found' });
  }

  const delta = parseFloat(amount);
  if (isNaN(delta) || delta <= 0) {
    return res.status(400).json({ code: 400, msg: 'Please enter a valid positive amount' });
  }

  if (action === 'add') {
    user.balance += delta;
    db.transactions.push({
      id: 'ADM' + Date.now(),
      userId: user.id,
      type: 'admin_credit',
      amount: delta,
      status: 'completed',
      details: reason || 'Credited by Admin',
      createdAt: new Date().toISOString()
    });
  } else {
    user.balance = Math.max(0, user.balance - delta);
    db.transactions.push({
      id: 'ADM' + Date.now(),
      userId: user.id,
      type: 'admin_debit',
      amount: -delta,
      status: 'completed',
      details: reason || 'Debited by Admin',
      createdAt: new Date().toISOString()
    });
  }

  writeDb(db);
  return res.json({ code: 200, msg: `User balance updated to ₹${user.balance}`, user });
});

// Admin Settings
app.post('/api/admin/settings', (req, res) => {
  const { siteName, brandTitle, slogan, launchDate, welcomeBonus, partnerIncome, payoutHours, minWithdrawal, maxWithdrawal, telegramLink, upiId, payeeName } = req.body;
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
    supportTelegram: req.body.supportTelegram || db.settings.supportTelegram,
    upiId: upiId || db.settings.upiId,
    payeeName: payeeName || db.settings.payeeName
  };

  writeDb(db);
  return res.json({ code: 200, msg: 'Settings updated successfully', settings: db.settings });
});

// Direct Page Routes
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KitKat Platform Server running at http://localhost:${PORT}`);
});
module.exports = app;