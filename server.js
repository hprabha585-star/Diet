require('dotenv').config();
const path = require('path');
const express = require('express');
const { connectDB, sequelize } = require('./config/db');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');
const trackerRoutes = require('./routes/tracker');
const { Plan, Settings } = require('./models');
const { backfillDualPlanAccess } = require('./utils/backfillAccess');

// Safety net against unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = express();

app.use(express.json({ limit: '6mb' })); // roomy enough for a base64 payment screenshot

// /api/health checks the database with a REAL query
app.get('/api/health', async (req, res) => {
  const result = { ok: true, service: 'fastcoach-backend' };
  try {
    await sequelize.authenticate();
    result.database = 'connected';
  } catch (err) {
    return res.status(500).json({ ok: false, service: 'fastcoach-backend', database: 'NOT connected', error: err.message });
  }
  try {
    const { User } = require('./models');
    const count = await User.count();
    result.tablesCreated = true;
    result.userCount = count;
    result.adminCount = await User.count({ where: { role: 'admin' } });
    const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;
    const all = await User.findAll({ attributes: ['passwordHash'] });
    result.usersWithBrokenPassword = all.filter(u => !BCRYPT_PATTERN.test(u.passwordHash || '')).length;
  } catch (err) {
    result.tablesCreated = false;
    result.tableError = err.message;
  }
  res.json(result);
});

// Public: plans on landing page
app.get('/api/plans', async (req, res) => {
  try {
    let plans = await Plan.findAll({ where: { active: true }, order: [['order', 'ASC'], ['priceInr', 'ASC']] });
    if (!plans.length) {
      await Plan.bulkCreate(Plan.DEFAULTS);
      plans = await Plan.findAll({ where: { active: true }, order: [['order', 'ASC'], ['priceInr', 'ASC']] });
    }
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: 'Could not load plans' });
  }
});

// Public: website name + logo
app.get('/api/site-settings', async (req, res) => {
  try {
    const settings = await Settings.getOrCreate();
    res.json({ siteName: settings.siteName || 'FastCoach', logoBase64: settings.logoBase64 || null });
  } catch (err) {
    res.json({ siteName: 'FastCoach', logoBase64: null });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tracker', trackerRoutes);

// Static frontend serving
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Database initialization helper for local or serverless boot
async function initializeApp() {
  try {
    await connectDB();
    await sequelize.sync({ alter: true });
    console.log('Database tables verified/created/updated.');
    await backfillDualPlanAccess();
  } catch (err) {
    console.error('Initialization error (non-fatal):', err.message);
  }
}

// Export app for Vercel Serverless deployment
module.exports = app;

// Local development server runner
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  initializeApp().then(() => {
    app.listen(PORT, () => console.log(`FastCoach API running locally on port ${PORT}`));
  });
} else {
  // Trigger initialization on cold start for production serverless
  initializeApp();
}
