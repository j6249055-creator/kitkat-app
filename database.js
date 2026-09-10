const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const initialData = {
  settings: {
    siteName: "Kitkat long-term app",
    brandTitle: "KITKAT",
    slogan: "Have a break, have a KitKat",
    launchDate: "11 September 2026",
    minDeposit: 560,
    minWithdrawal: 120,
    withdrawalTime: "00:10-17:00",
    welcomeBonus: 0,
    firstPurchaseBonus: 120,
    partnerIncome: "25%",
    commissionRates: {
      lv1: 0.25,
      lv2: 0.03,
      lv3: 0.02
    },
    upiId: "7017398044-2@ibl",
    payeeName: "BHARAT SINGH DAGUR",
    telegramLink: "https://t.me/kitkatofficalchannel",
    supportTelegram: "https://t.me/KitKatPremiumSupport",
    tickerItems: [
      "User 740****838 received ₹120 daily profit from Long-term income A",
      "Withdrawal Approved! ₹1,240 credited to User ID: 82914 via PhonePe UPI",
      "User 918****102 purchased Long-term income B (₹2,300)",
      "Instant Payout! ₹3,500 transferred to User ID: 49094",
      "Referral commission ₹575 credited to User 740****838 (LV1 25%)"
    ]
  },
  users: [
    {
      id: 49094,
      displayId: "7409601838",
      name: "Priyanshu Chahar",
      phone: "8239191458",
      password: "123",
      wPassword: "123",
      refCode: "kkat88",
      refBy: "ADMIN",
      balance: 2958,
      totalEarnings: 360,
      totalRecharge: 5570,
      totalWithdraw: 2222,
      bankDetails: {
        accountName: "Priyanshu Chahar",
        bankName: "State Bank of India",
        accountNumber: "38920192019",
        ifsc: "SBIN0001234",
        upiId: "8239191458@paytm"
      },
      createdAt: "2026-09-07T19:10:24.500Z"
    }
  ],
  products: [
    {
      id: 1,
      name: "Long-term income A",
      planTitle: "Long-term income A",
      category: "long_term",
      price: 560,
      dailyProfit: 120,
      dailyIncome: 120,
      days: 360,
      duration: 360,
      totalProfit: 43200,
      totalIncome: 43200,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Hot",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 2,
      name: "Long-term income B",
      planTitle: "Long-term income B",
      category: "long_term",
      price: 2300,
      dailyProfit: 622,
      dailyIncome: 622,
      days: 350,
      duration: 350,
      totalProfit: 217700,
      totalIncome: 217700,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Hot",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 3,
      name: "KitKat income C",
      planTitle: "KitKat income C",
      category: "long_term",
      price: 980,
      dailyProfit: 220,
      dailyIncome: 220,
      days: 360,
      duration: 360,
      totalProfit: 79200,
      totalIncome: 79200,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Popular",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 4,
      name: "KitKat income D",
      planTitle: "KitKat income D",
      category: "long_term",
      price: 1400,
      dailyProfit: 320,
      dailyIncome: 320,
      days: 360,
      duration: 360,
      totalProfit: 115200,
      totalIncome: 115200,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Popular",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 5,
      name: "KitKat income E",
      planTitle: "KitKat income E",
      category: "long_term",
      price: 2100,
      dailyProfit: 480,
      dailyIncome: 480,
      days: 360,
      duration: 360,
      totalProfit: 172800,
      totalIncome: 172800,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Popular",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 6,
      name: "KitKat income F",
      planTitle: "KitKat income F",
      category: "long_term",
      price: 3200,
      dailyProfit: 750,
      dailyIncome: 750,
      days: 360,
      duration: 360,
      totalProfit: 270000,
      totalIncome: 270000,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "VIP",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 7,
      name: "KitKat income 6",
      planTitle: "KitKat income 6",
      category: "long_term",
      price: 4600,
      dailyProfit: 1100,
      dailyIncome: 1100,
      days: 360,
      duration: 360,
      totalProfit: 396000,
      totalIncome: 396000,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "VIP",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 8,
      name: "KitKat income H",
      planTitle: "KitKat income H",
      category: "long_term",
      price: 6800,
      dailyProfit: 1650,
      dailyIncome: 1650,
      days: 360,
      duration: 360,
      totalProfit: 594000,
      totalIncome: 594000,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Super VIP",
      status: "Active Plan",
      isComingSoon: false
    },
    {
      id: 9,
      name: "KitKat income 1",
      planTitle: "KitKat income 1",
      category: "long_term",
      price: 9600,
      dailyProfit: 2500,
      dailyIncome: 2500,
      days: 360,
      duration: 360,
      totalProfit: 900000,
      totalIncome: 900000,
      quota: "0/20",
      img: "/img/kitkat_pack.jpg",
      tag: "Super VIP",
      status: "Active Plan",
      isComingSoon: false
    }
  ],
  orders: [],
  transactions: []
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db:', err);
    return initialData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing db:', err);
  }
}

module.exports = {
  readDb,
  writeDb
};
