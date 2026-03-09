const { Pool } = require('@neondatabase/serverless');
const { Pool: LocalPool } = require('pg');
const { requireEnv } = require('../config/stack');

let pool;

function initPool() {
    if (pool) return pool;

    const connectionString = process.env.NODE_ENV === 'test'
        ? process.env.DATABASE_URL
        : requireEnv('DATABASE_URL');

    if (!connectionString) {
        throw new Error('DATABASE_URL is required');
    } else {
        // If DATABASE_URL is set, figure out if it's neon or classic pg
        if (connectionString.includes('neon.tech')) {
            pool = new Pool({ connectionString });
            console.log('🔗 Connected to Neon Serverless PostgreSQL');
        } else {
            pool = new LocalPool({ connectionString });
            console.log('🔗 Connected to PostgreSQL Database');
        }
    }

    return pool;
}

async function query(text, params) {
    initPool();
    return pool.query(text, params);
}

module.exports = {
    initPool,
    query,
    getClient: async () => {
        initPool();
        return pool.connect();
    }
};
