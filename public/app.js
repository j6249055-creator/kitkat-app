// KitKat Platform Frontend Script
let currentUser = null;
let currentProducts = [];
let siteSettings = {};
let currentCategory = 'long_term';
let currentTeamData = null;
let currentTeamLevel = 1;
let selectedRechargeAmount = 560;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadProducts();
  await loadTeamData();

  // Show Launch Flyer Modal if not seen in session
  if (!sessionStorage.getItem('kitkat_launch_popup_seen')) {
    setTimeout(() => {
      openModal('launchModal');
      sessionStorage.setItem('kitkat_launch_popup_seen', 'true');
    }, 400);
  }
});

// Toast notification
function showToast(msg) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// Check Authenticated User
async function checkAuth() {
  const stored = localStorage.getItem('kitkat_user');
  if (!stored) {
    window.location.href = '/login';
    return;
  }

  try {
    currentUser = JSON.parse(stored);
  } catch (e) {
    window.location.href = '/login';
    return;
  }

  // Fetch live updated user state from backend
  try {
    const res = await fetch(`/api/auth/user/${currentUser.id}`);
    const data = await res.json();
    if (data.code === 200) {
      currentUser = data.user;
      localStorage.setItem('kitkat_user', JSON.stringify(currentUser));
    }
  } catch (e) {
    console.warn('Backend offline or network error:', e);
  }

  updateUserUI();
}

// Update User UI elements across all tabs
function updateUserUI() {
  if (!currentUser) return;

  // Masked phone format (e.g. 740****838)
  const phone = currentUser.phone || '7017398044';
  const maskedPhone = phone.length >= 7 
    ? phone.substring(0, 3) + '****' + phone.substring(phone.length - 3)
    : phone;

  // Display ID
  const displayId = currentUser.displayId || ('ID : ' + currentUser.id);
  const profileIdElem = document.getElementById('profileUserIdDisplay');
  if (profileIdElem) profileIdElem.innerText = displayId.startsWith('ID :') ? displayId : ('ID : ' + displayId);

  const teamPhoneElem = document.getElementById('teamUserMaskedPhone');
  if (teamPhoneElem) teamPhoneElem.innerText = maskedPhone;

  // Balances
  const balanceStr = Number(currentUser.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.querySelectorAll('.val-user-balance').forEach(el => el.innerText = balanceStr);

  const incomeStr = Number(currentUser.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const incomeElem = document.getElementById('valUserTotalIncome');
  if (incomeElem) incomeElem.innerText = incomeStr;

  const rechargeStr = Number(currentUser.totalRecharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const rechargeElem = document.getElementById('valUserTotalRecharge');
  if (rechargeElem) rechargeElem.innerText = rechargeStr;

  // Bank Info in Withdraw View
  const bankElem = document.getElementById('withdrawBankDetailsText');
  if (bankElem) {
    const b = currentUser.bankDetails || {};
    if (b.upiId) {
      bankElem.innerHTML = `<strong>UPI ID:</strong> ${b.upiId}<br><span style="color:#6b7280;">Holder: ${b.accountName || currentUser.name}</span>`;
    } else if (b.accountNumber) {
      bankElem.innerHTML = `<strong>Bank:</strong> ${b.bankName || 'Bank Account'}<br><strong>A/C:</strong> ${b.accountNumber} (IFSC: ${b.ifsc || '-'})`;
    } else {
      bankElem.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ No bank account or UPI bound. Click Edit Account above to bind.</span>`;
    }
  }

  // Pre-fill Bank Modal inputs
  if (currentUser.bankDetails) {
    const b = currentUser.bankDetails;
    if (document.getElementById('bankAccountName')) document.getElementById('bankAccountName').value = b.accountName || currentUser.name;
    if (document.getElementById('bankUpiId')) document.getElementById('bankUpiId').value = b.upiId || '';
    if (document.getElementById('bankAccountNumber')) document.getElementById('bankAccountNumber').value = b.accountNumber || '';
    if (document.getElementById('bankIfsc')) document.getElementById('bankIfsc').value = b.ifsc || '';
  }

  // Share Links & QR
  const shareLink = `${window.location.origin}/login?ref=${currentUser.refCode}`;
  const displayRefLink = document.getElementById('displayRefLink');
  if (displayRefLink) displayRefLink.innerText = shareLink;

  const displayRefCode = document.getElementById('displayRefCode');
  if (displayRefCode) displayRefCode.innerText = currentUser.refCode;

  // Generate QR Code on Canvas
  const qrWrap = document.getElementById('shareQrCanvasWrap');
  if (qrWrap && typeof QRCode !== 'undefined') {
    qrWrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    qrWrap.appendChild(canvas);
    QRCode.toCanvas(canvas, shareLink, {
      width: 190,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }, err => { if (err) console.error(err); });
  }
}

// Fetch Products from Backend
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.code === 200) {
      currentProducts = data.products || [];
      siteSettings = data.settings || {};
      renderProducts();
    }
  } catch (e) {
    console.error('Error loading products:', e);
  }
}

// Switch Category: Long-term income / VIP income
function switchCategoryTab(cat) {
  currentCategory = cat;
  document.getElementById('tabLongTermBtn').classList.toggle('active', cat === 'long_term');
  document.getElementById('tabVipBtn').classList.toggle('active', cat === 'vip');
  renderProducts();
}

// Render Products
function renderProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;

  const filtered = currentProducts;

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280;font-weight:700;">Loading KitKat Long-Term plans...</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isPreSale = p.status === 'Pre-sale' || p.isComingSoon;
    const btnHtml = isPreSale 
      ? `<button class="btn-buy-now pre-sale" disabled>Pre-sale</button>`
      : `<button class="btn-buy-now" onclick="buyProduct(${p.id})">
           <span>Buy now</span>
           <iconify-icon icon="solar:cart-large-bold"></iconify-icon>
         </button>`;

    const dailyProfit = p.dailyIncome || p.dailyProfit;
    const totalProfit = p.totalIncome || p.totalProfit;
    const durationDays = p.duration || p.days;

    return `
      <div class="product-card">
        <div class="product-card-header">${p.name}</div>
        <div class="product-body-grid">
          <!-- Left Red Box -->
          <div class="product-img-box">
            <div class="quota-pill-badge">Quota ${p.quota || '0/20'}</div>
            <img src="/img/kitkat_pack.jpg" alt="${p.name}">
          </div>

          <!-- Right Details -->
          <div class="product-details-rows">
            <div class="detail-row">
              <div class="detail-label-group">
                <span class="detail-bullet"></span>
                <span>Price</span>
              </div>
              <div class="detail-val">₹ ${Number(p.price).toLocaleString()}</div>
            </div>

            <div class="detail-row">
              <div class="detail-label-group">
                <span class="detail-bullet"></span>
                <span>Daily profit</span>
              </div>
              <div class="detail-val">₹ ${Number(dailyProfit).toLocaleString()}</div>
            </div>

            <div class="detail-row">
              <div class="detail-label-group">
                <span class="detail-bullet"></span>
                <span>Day</span>
              </div>
              <div class="detail-val">${durationDays}</div>
            </div>

            <div class="detail-row">
              <div class="detail-label-group">
                <span class="detail-bullet"></span>
                <span>Total profit</span>
              </div>
              <div class="detail-val">₹ ${Number(totalProfit).toLocaleString()}</div>
            </div>
          </div>
        </div>

        ${btnHtml}
      </div>
    `;
  }).join('');
}

// Buy Plan Action
async function buyProduct(productId) {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }

  const product = currentProducts.find(p => p.id === productId);
  if (!product) return;

  if (currentUser.balance < product.price) {
    if (confirm(`Insufficient balance! You need ₹${product.price}. Your balance is ₹${currentUser.balance.toFixed(2)}.\n\nWould you like to recharge now?`)) {
      openRechargeView(product.price);
    }
    return;
  }

  if (!confirm(`Confirm purchase of ${product.name} for ₹${product.price}?\n\nDaily Profit: ₹${product.dailyIncome || product.dailyProfit}\nDuration: ${product.duration || product.days} Days`)) {
    return;
  }

  try {
    const res = await fetch('/api/orders/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, productId })
    });

    const data = await res.json();
    if (data.code === 200) {
      currentUser = data.user;
      localStorage.setItem('kitkat_user', JSON.stringify(currentUser));
      updateUserUI();
      showToast(data.msg);
      updateCartBadge();
    } else {
      showToast(data.msg || 'Purchase failed');
      if (data.needRecharge) {
        setTimeout(() => openRechargeView(product.price), 1500);
      }
    }
  } catch (e) {
    showToast('Network error during purchase');
  }
}

// Update Cart Badge with active orders count
async function updateCartBadge() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/orders/user/${currentUser.id}`);
    const d = await res.json();
    if (d.code === 200) {
      const badge = document.getElementById('headerCartCount');
      if (badge) badge.innerText = d.orders.length;
    }
  } catch (e) {}
}

// Navigation Bar Switching
function switchNav(tab) {
  // Update nav item highlights
  document.querySelectorAll('.nav-bar-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById('nav' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activeNav) activeNav.classList.add('active');

  // Hide all view tabs
  document.querySelectorAll('.app-view-tab').forEach(el => el.style.display = 'none');

  // Show target view
  const targetView = document.getElementById('view-' + tab);
  if (targetView) targetView.style.display = 'block';

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Tab specific refreshes
  if (tab === 'team') loadTeamData();
  if (tab === 'profile') updateUserUI();
}

// Open Recharge View
function openRechargeView(suggestedAmount) {
  document.querySelectorAll('.app-view-tab').forEach(el => el.style.display = 'none');
  document.getElementById('view-recharge').style.display = 'block';

  if (suggestedAmount && suggestedAmount >= 560) {
    selectedRechargeAmount = suggestedAmount;
    document.getElementById('inputRechargeAmount').value = suggestedAmount;
  }
  updatePayButton();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Open Withdraw View
function openWithdrawView() {
  document.querySelectorAll('.app-view-tab').forEach(el => el.style.display = 'none');
  document.getElementById('view-withdraw').style.display = 'block';
  updateUserUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Quick Chip Selection in Recharge
function selectRechargeChip(amt, elem) {
  document.querySelectorAll('.chip-amount-btn').forEach(c => c.classList.remove('active'));
  elem.classList.add('active');
  selectedRechargeAmount = amt;
  document.getElementById('inputRechargeAmount').value = amt;
  updatePayButton();
}

function updatePayButton() {
  const val = parseInt(document.getElementById('inputRechargeAmount').value) || 0;
  selectedRechargeAmount = val;
  document.getElementById('btnPaySubmit').innerText = `Pay ${val}`;
}

// Channel Selection in Recharge
function selectChannel(elem) {
  document.querySelectorAll('.channel-row').forEach(r => {
    r.classList.remove('selected');
    r.querySelector('.channel-checkbox').innerText = '';
  });
  elem.classList.add('selected');
  elem.querySelector('.channel-checkbox').innerText = '✓';
}

// Redirect to Cashier Page (Screenshot 1 & 2 Matching Fast Wallet)
function goToCashier() {
  const amt = parseInt(document.getElementById('inputRechargeAmount').value) || selectedRechargeAmount;
  if (amt < 560) {
    showToast('Minimum recharge amount is ₹560');
    return;
  }
  window.location.href = `/pay?amount=${amt}`;
}

// Submit Withdrawal
async function submitWithdrawal() {
  if (!currentUser) return;

  const amt = parseFloat(document.getElementById('inputWithdrawAmount').value);
  if (isNaN(amt) || amt < 120) {
    showToast('Minimum withdrawal amount is ₹120');
    return;
  }

  if (currentUser.balance < amt) {
    showToast(`Insufficient balance! Your balance is ₹${currentUser.balance.toFixed(2)}`);
    return;
  }

  const b = currentUser.bankDetails || {};
  if (!b.upiId && !b.accountNumber) {
    showToast('Please bind your Bank Account or UPI ID first.');
    openModal('bankModal');
    return;
  }

  try {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, amount: amt })
    });

    const data = await res.json();
    if (data.code === 200) {
      currentUser = data.user;
      localStorage.setItem('kitkat_user', JSON.stringify(currentUser));
      updateUserUI();
      document.getElementById('inputWithdrawAmount').value = '';
      showToast(data.msg);
    } else {
      showToast(data.msg || 'Withdrawal failed');
    }
  } catch (e) {
    showToast('Network error during withdrawal');
  }
}

// Fetch & Render Team Data (Screenshot 2 Matching)
async function loadTeamData() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/team/${currentUser.id}`);
    const data = await res.json();
    if (data.code === 200) {
      currentTeamData = data;
      document.getElementById('teamTotalRechargeNum').innerText = '₹ ' + (data.totalTeamRecharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      document.getElementById('teamTotalMembersNum').innerText = data.totalMembers || 0;
      document.getElementById('teamTotalCommissionNum').innerText = '₹ ' + (data.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      renderTeamTierMetrics();
    }
  } catch (e) {
    console.error('Error loading team:', e);
  }
}

function switchTeamLevelTab(lvl) {
  currentTeamLevel = lvl;
  document.getElementById('tabLv1Btn').classList.toggle('active', lvl === 1);
  document.getElementById('tabLv2Btn').classList.toggle('active', lvl === 2);
  document.getElementById('tabLv3Btn').classList.toggle('active', lvl === 3);
  document.getElementById('labelViewAllLv').innerText = `View all LV.${lvl} Subordinates`;
  renderTeamTierMetrics();
  renderSubordinatesList();
}

function renderTeamTierMetrics() {
  if (!currentTeamData || !currentTeamData.tiers) return;
  const tier = currentTeamData.tiers[currentTeamLevel - 1] || {};
  document.getElementById('tierTeamSizeNum').innerText = tier.count || 0;
  document.getElementById('tierInvestorsNum').innerText = tier.investors || 0;
  document.getElementById('tierRechargeNum').innerText = '₹ ' + (tier.recharge || 0).toLocaleString();
  document.getElementById('tierCommissionNum').innerText = '₹ ' + (tier.commission || 0).toLocaleString();
}

function toggleDownlineList() {
  const wrap = document.getElementById('subordinatesListWrap');
  if (wrap.style.display === 'none') {
    renderSubordinatesList();
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

function renderSubordinatesList() {
  const container = document.getElementById('subordinatesListContent');
  if (!currentTeamData || !currentTeamData.tiers) return;
  const tier = currentTeamData.tiers[currentTeamLevel - 1];
  const members = (tier && tier.members) || [];

  if (members.length === 0) {
    container.innerHTML = `<div style="background:#fff;padding:16px;border-radius:10px;text-align:center;color:#6b7280;font-size:13px;font-weight:600;">No Level ${currentTeamLevel} members registered yet.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:12px;box-shadow:var(--shadow-sm);">
      <div style="display:grid;grid-template-columns:1fr 1fr;padding:8px;font-size:12px;font-weight:800;color:#6b7280;border-bottom:1px solid #f1f5f9;">
        <span>Member</span>
        <span style="text-align:right;">Recharged</span>
      </div>
      ${members.map(m => `
        <div style="display:grid;grid-template-columns:1fr 1fr;padding:10px 8px;font-size:13px;border-bottom:1px solid #f8fafc;">
          <span style="font-weight:700;color:#111;">${m.phone}</span>
          <span style="text-align:right;font-weight:800;color:var(--red-primary);">₹ ${m.recharge.toLocaleString()}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Copy Referral Link & Code
function copyRefLink() {
  const link = document.getElementById('displayRefLink').innerText;
  copyText(link, 'Invitation link copied!');
}

function copyRefCode() {
  const code = document.getElementById('displayRefCode').innerText;
  copyText(code, 'Invitation code copied!');
}

function copyText(str, successMsg) {
  navigator.clipboard.writeText(str).then(() => {
    showToast(successMsg);
  }).catch(() => {
    const temp = document.createElement('textarea');
    temp.value = str;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    showToast(successMsg);
  });
}

// Save Bank Details
async function saveBankDetails() {
  if (!currentUser) return;
  const payload = {
    userId: currentUser.id,
    accountName: document.getElementById('bankAccountName').value.trim(),
    upiId: document.getElementById('bankUpiId').value.trim(),
    accountNumber: document.getElementById('bankAccountNumber').value.trim(),
    ifsc: document.getElementById('bankIfsc').value.trim()
  };

  try {
    const res = await fetch('/api/user/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    if (d.code === 200) {
      currentUser = d.user;
      localStorage.setItem('kitkat_user', JSON.stringify(currentUser));
      updateUserUI();
      closeModal('bankModal');
      showToast('Account details saved successfully!');
    }
  } catch (e) {
    showToast('Error saving bank details');
  }
}

// View Active Orders (Devices)
async function openUserOrders() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/orders/user/${currentUser.id}`);
    const d = await res.json();
    if (d.code === 200) {
      const list = d.orders || [];
      const container = document.getElementById('userOrdersListContainer');
      if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:24px;color:#6b7280;font-size:13px;font-weight:600;">No active plans yet. Purchase a plan to start earning daily income!</div>`;
      } else {
        container.innerHTML = list.map(o => `
          <div style="background:#fdf2f2;border:1px solid #fecaca;border-radius:12px;padding:14px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="color:var(--red-primary);font-size:14.5px;">${o.planTitle || o.productName}</strong>
              <span style="background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;">Active</span>
            </div>
            <div style="font-size:12.5px;color:#4b5563;line-height:1.6;">
              <div>Invested: <strong>₹${o.price.toLocaleString()}</strong></div>
              <div>Daily Income: <strong style="color:#10b981;">₹${(o.dailyIncome || 0).toLocaleString()}</strong></div>
              <div>Duration: <strong>${o.duration || 360} Days</strong> (Total Profit: ₹${(o.totalIncome || 0).toLocaleString()})</div>
              <div>Total Earned So Far: <strong style="color:var(--red-primary);">₹${(o.totalEarned || 0).toLocaleString()}</strong></div>
            </div>
          </div>
        `).join('');
      }
      openModal('ordersModal');
    }
  } catch (e) {
    showToast('Could not load orders');
  }
}

// View Transaction History
async function showHistory(type) {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/wallet/history/${currentUser.id}`);
    const d = await res.json();
    if (d.code === 200) {
      let list = d.transactions || [];
      if (type) {
        list = list.filter(t => t.type === type);
      }

      const titles = {
        'daily_profit': 'Daily Income Records',
        'withdraw': 'Withdrawal Records',
        'deposit': 'Recharge Records'
      };
      document.getElementById('historyModalTitle').innerText = titles[type] || 'Transaction History';

      const container = document.getElementById('historyListContainer');
      if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:24px;color:#6b7280;font-size:13px;font-weight:600;">No records found.</div>`;
      } else {
        container.innerHTML = list.map(t => {
          const isCredit = t.amount > 0;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9;">
              <div>
                <div style="font-weight:700;font-size:13px;color:#1e293b;">${t.details || t.type}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:900;font-size:14px;color:${isCredit ? '#10b981' : '#ef4444'};">
                  ${isCredit ? '+' : ''}₹${Math.abs(t.amount).toLocaleString()}
                </div>
                <div style="font-size:10.5px;font-weight:700;color:${t.status === 'completed' || t.status === 'approved' ? '#10b981' : (t.status === 'pending' ? '#f59e0b' : '#ef4444')};text-transform:capitalize;">
                  ${t.status}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      openModal('historyModal');
    }
  } catch (e) {
    showToast('Could not load history');
  }
}

// Modal Helpers
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

// Log Out
function logoutUser() {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('kitkat_user');
    window.location.href = '/login';
  }
}
