const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'defaultdb',
  process.env.DB_USER || 'avnadmin',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    // This line is REQUIRED for Vercel / serverless deployments.
    // Without it, the bundler strips out the `mysql2` package because
    // Sequelize loads it indirectly, causing a runtime error:
    // "Please install mysql2 package manually".
    dialectModule: require('mysql2'),
    logging: false,
    define: { underscored: true, timestamps: true },
    // Aiven requires SSL connections.
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false
      }
    },
    pool: { max: 5, min: 0, acquire: 20000, idle: 10000 }
  }
);

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected successfully to Aiven');
  } catch (err) {
    console.error('MySQL connection error:', err.message);
    // Do not use process.exit(1) blindly in serverless — the function
    // needs to return a response either way so the error surfaces in
    // the deployment logs. Kept for local dev only.
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

module.exports = { sequelize, connectDB };
