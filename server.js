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

// ------------------- AUTH ENDPOINTS ------------------- //
app.post('/api/auth/register', (req, res) => {
    const { name, phone, password, w_password, ref_by } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ code: 400, msg: 'Phone number and password required' });
    }
    if (password.length < 3) {
        return res.status(400).json({ code: 400, msg: 'Password must be at least 3 characters' });
    }

    const db = readDb();
    const existingUser = db.users.find(u => u.phone === phone);
    if (existingUser) {
        return res.status(400).json({ code: 400, msg: 'Phone number already registered' });
    }

    const newUser = {
        id: Date.now().toString(),
        name: name || 'User',
        phone,
        password,
        w_password: w_password || password,
        balance: 0,
        totalRecharge: 0,
        totalWithdraw: 0,
        refCode: generateRefCode(),
        refBy: ref_by || '',
        vipLevel: 0,
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDb(db);

    return res.json({ code: 200, msg: 'Registration successful', user: newUser });
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
