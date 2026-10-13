const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'defaultdb',
  process.env.DB_USER || 'avnadmin',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: { underscored: true, timestamps: true },
    // Aiven requires SSL connections
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
    // Do not use process.exit(1) blindly in serverless, but kept for local safety
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

module.exports = { sequelize, connectDB };
