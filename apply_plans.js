const fs = require('fs');
const path = require('path');

const updatedProducts = [
  {
    id: 1,
    name: 'KitKat Classic 2-Finger',
    planTitle: 'Plan 1',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 110.00,
    totalIncome: 11000.00,
    price: 550,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹110.00 for 100 days. Total return ₹11,000.00.'
  },
  {
    id: 2,
    name: 'KitKat Chunky Waffle Crisp',
    planTitle: 'Plan 2',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 394.00,
    totalIncome: 39400.00,
    price: 1970,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹394.00 for 100 days. Total return ₹39,400.00.'
  },
  {
    id: 3,
    name: 'KitKat Dessert Delight Rich',
    planTitle: 'Plan 3',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 994.00,
    totalIncome: 99400.00,
    price: 4970,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹994.00 for 100 days. Total return ₹99,400.00.'
  },
  {
    id: 4,
    name: 'KitKat Dark Cocoa Gold',
    planTitle: 'Plan 4',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 1994.00,
    totalIncome: 199400.00,
    price: 9970,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹1,994.00 for 100 days. Total return ₹1,99,400.00.'
  },
  {
    id: 5,
    name: 'KitKat Mega Celebration Pack',
    planTitle: 'Plan 5',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 3994.00,
    totalIncome: 399400.00,
    price: 19970,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹3,994.00 for 100 days. Total return ₹3,99,400.00.'
  },
  {
    id: 6,
    name: 'KitKat Royal VIP Supreme',
    planTitle: 'Plan 6',
    tag: 'Hot',
    status: 'Active Plan',
    duration: 100,
    dailyIncome: 7594.00,
    totalIncome: 759400.00,
    price: 37970,
    badge: 'Hot',
    isComingSoon: false,
    desc: 'Daily return ₹7,594.00 for 100 days. Total return ₹7,59,400.00.'
  }
];

const dbPath = path.join(__dirname, 'data', 'db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  db.products = updatedProducts;
  db.settings.upiId = '7017398044-2@ibl';
  db.settings.payeeName = 'BHARAT SINGH DAGUR';
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('db.json updated with 6 plans and user PhonePe QR details!');
}

// Copy plan 5 svg as plan 6 svg
const p5Path = path.join(__dirname, 'public', 'img', 'plan_badge_5.svg');
const p6Path = path.join(__dirname, 'public', 'img', 'plan_badge_6.svg');
if (fs.existsSync(p5Path)) {
  let svg = fs.readFileSync(p5Path, 'utf8');
  svg = svg.replace('PLAN 5', 'PLAN 6');
  fs.writeFileSync(p6Path, svg, 'utf8');
  console.log('plan_badge_6.svg created!');
}
