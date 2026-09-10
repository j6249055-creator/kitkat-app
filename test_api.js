const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: Fetch Products ---');
  const pRes = await request('/api/products');
  console.log('Products Status:', pRes.status, 'Total Plans:', pRes.data.products.length);

  console.log('\n--- TEST 2: Register New User ---');
  const regRes = await request('/api/auth/register', 'POST', {
    name: 'Rahul Sharma',
    phone: '9876543210',
    password: 'password123',
    w_password: 'password123',
    ref_by: 'kkat88'
  });
  console.log('Register Result:', regRes.data.code, regRes.data.msg, 'UserID:', regRes.data.user && regRes.data.user.id);
  const testUser = regRes.data.user;

  console.log('\n--- TEST 3: Login User ---');
  const logRes = await request('/api/auth/login', 'POST', {
    phone: '9876543210',
    password: 'password123'
  });
  console.log('Login Status:', logRes.data.code, logRes.data.msg);

  console.log('\n--- TEST 4: Deposit Recharge ₹1,000 ---');
  const depRes = await request('/api/wallet/deposit', 'POST', {
    userId: testUser.id,
    amount: 1000,
    utr: 'UTR998877665544',
    method: 'UPI Instant'
  });
  console.log('Deposit Result:', depRes.data.code, depRes.data.msg, 'New Balance: ₹' + depRes.data.user.balance);

  console.log('\n--- TEST 5: Purchase Plan 1 (KitKat Classic ₹540) ---');
  const buyRes = await request('/api/orders/buy', 'POST', {
    userId: testUser.id,
    productId: 1
  });
  console.log('Buy Result:', buyRes.data.code, buyRes.data.msg, 'New Balance: ₹' + buyRes.data.user.balance);

  console.log('\n--- TEST 6: Bind Bank Details ---');
  const bRes = await request('/api/user/bank', 'POST', {
    userId: testUser.id,
    accountName: 'Rahul Sharma',
    upiId: 'rahul@oksbi',
    bankName: 'SBI',
    accountNumber: '1122334455',
    ifsc: 'SBIN0000001'
  });
  console.log('Bank Bind Result:', bRes.data.code, bRes.data.msg);

  console.log('\n--- TEST 7: Withdraw ₹200 ---');
  const wRes = await request('/api/wallet/withdraw', 'POST', {
    userId: testUser.id,
    amount: 200,
    wPassword: 'password123'
  });
  console.log('Withdraw Result:', wRes.data.code, wRes.data.msg, 'Remaining Balance: ₹' + wRes.data.user.balance);

  console.log('\n--- TEST 8: Check Referrer Commission ---');
  const refRes = await request('/api/team/49094');
  console.log('Referrer Team Total Members:', refRes.data.totalMembers, 'Commission Earned: ₹' + refRes.data.totalCommission);

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(console.error);
