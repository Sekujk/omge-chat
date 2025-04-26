const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para inicializar las tablas necesarias
const initDb = async () => {
  try {
    // Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        socket_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Crear tabla de chats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(36) PRIMARY KEY,
        usuario1_id VARCHAR(36) REFERENCES usuarios(id) ON DELETE CASCADE,
        usuario2_id VARCHAR(36) REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ
      )
    `);

    // Crear tabla de mensajes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mensajes (
        id VARCHAR(36) PRIMARY KEY,
        chat_id VARCHAR(36) REFERENCES chats(id) ON DELETE CASCADE,
        usuario_id VARCHAR(36) REFERENCES usuarios(id) ON DELETE CASCADE,
        contenido TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
};

module.exports = { pool, initDb };