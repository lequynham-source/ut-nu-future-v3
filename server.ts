import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendToSheet } from './googleSheets.ts';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize Gemini API for Vision
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// WebSocket clients management
const clients = new Map<string, { ws: WebSocket, user: any }>();

wss.on('connection', (ws) => {
  let userId: string | null = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'auth') {
        userId = data.userId.toString();
        clients.set(userId, { ws, user: data.user });
        console.log(`User ${userId} (${data.user.name}) connected via WebSocket`);
      }

      if (data.type === 'location_update' && userId) {
        const client = clients.get(userId);
        if (client) {
          client.user.location = data.location;
          // Broadcast location to admins
          broadcastToRole('admin', {
            type: 'driver_location',
            driverId: userId,
            driverName: client.user.name,
            location: data.location
          });
        }
      }

      if (data.type === 'help_request' && userId) {
        const client = clients.get(userId);
        if (client) {
          // Broadcast to all drivers nearby (for simplicity, all drivers for now)
          broadcastToRole('driver', {
            type: 'help_needed',
            driverId: userId,
            driverName: client.user.name,
            location: data.location,
            message: data.message || 'Cần giúp đỡ gấp!'
          }, userId);
        }
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`User ${userId} disconnected from WebSocket`);
    }
  });
});

function broadcastToRole(role: string, data: any, excludeUserId?: string) {
  const message = JSON.stringify(data);
  clients.forEach((client, id) => {
    if (client.user.role === role && id !== excludeUserId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  });
}

function sendNotificationToUser(userId: string, data: any) {
  const client = clients.get(userId.toString());
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

function broadcastToAll(data: any) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

console.log(`Starting server on port ${PORT}...`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Increase limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let db: any;

// Database wrapper functions with retries
const dbQuery = async (sql: string, params: any[] = [], retries = 3) => {
  let i = 1;
  const pgSql = sql.replace(/\?/g, () => `$${i++}`);
  try {
    const result = await db.query(pgSql, params);
    return result.rows;
  } catch (error: any) {
    if (retries > 0 && (error.message.includes('timeout') || error.message.includes('terminated'))) {
      console.log(`Database query failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return dbQuery(sql, params, retries - 1);
    }
    throw error;
  }
};

const dbQueryOne = async (sql: string, params: any[] = [], retries = 3) => {
  let i = 1;
  const pgSql = sql.replace(/\?/g, () => `$${i++}`);
  try {
    const result = await db.query(pgSql, params);
    return result.rows[0];
  } catch (error: any) {
    if (retries > 0 && (error.message.includes('timeout') || error.message.includes('terminated'))) {
      console.log(`Database query one failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return dbQueryOne(sql, params, retries - 1);
    }
    throw error;
  }
};

const dbExecute = async (sql: string, params: any[] = [], retries = 3) => {
  let i = 1;
  const pgSql = sql.replace(/\?/g, () => `$${i++}`);
  try {
    await db.query(pgSql, params);
  } catch (error: any) {
    if (retries > 0 && (error.message.includes('timeout') || error.message.includes('terminated'))) {
      console.log(`Database execute failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return dbExecute(sql, params, retries - 1);
    }
    throw error;
  }
};

const initDb = async () => {
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL (PostgreSQL) is required. Please set it in your environment variables.");
  }

  try {
    console.log("Attempting to connect to PostgreSQL database...");
    
    // Handle special characters in passwords (like @) by encoding them
    if (connectionString.includes('@')) {
      const lastAtIndex = connectionString.lastIndexOf('@');
      const firstColonIndex = connectionString.indexOf(':', connectionString.indexOf('://') + 3);
      
      if (firstColonIndex !== -1 && lastAtIndex > firstColonIndex) {
        const protocolAndUser = connectionString.substring(0, firstColonIndex + 1);
        const password = connectionString.substring(firstColonIndex + 1, lastAtIndex);
        const hostAndDb = connectionString.substring(lastAtIndex);
        
        if (password.includes('@')) {
          console.log("Encoding special characters in database password...");
          connectionString = protocolAndUser + encodeURIComponent(password) + hostAndDb;
        }
      }
    }

    const { Pool } = await import('pg');
    db = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000, // Increase to 20 seconds
      idleTimeoutMillis: 30000,
      max: 20,
    });
    
    // Test connection with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const client = await db.connect();
        try {
          await client.query('SELECT 1');
          console.log("Successfully connected to PostgreSQL database");
          break;
        } finally {
          client.release();
        }
      } catch (err) {
        retries--;
        console.error(`Database connection attempt failed. Retries left: ${retries}`);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error("CRITICAL: Failed to connect to PostgreSQL:", (error as Error).message);
    throw error; // Stop the server if database is not available
  }

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role VARCHAR(50),
      name VARCHAR(255),
      avatar_url TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      license_plate VARCHAR(255) UNIQUE,
      insurance_expiry VARCHAR(255),
      registration_expiry VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS driver_reports (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER REFERENCES users(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      agency_name VARCHAR(255),
      money_amount VARCHAR(255),
      photo_url TEXT,
      location_lat REAL,
      location_lng REAL,
      timestamp VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS sale_reports (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER REFERENCES users(id),
      agency_name VARCHAR(255),
      check_in_photo_url TEXT,
      check_in_lat REAL,
      check_in_lng REAL,
      check_in_time VARCHAR(255),
      check_out_photo_url TEXT,
      check_out_time VARCHAR(255),
      duration_minutes INTEGER,
      notes TEXT,
      has_order INTEGER DEFAULT 0,
      order_details TEXT
    );

    CREATE TABLE IF NOT EXISTS driver_expenses (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER REFERENCES users(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      amount VARCHAR(255),
      description TEXT,
      photo_url TEXT,
      timestamp VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS return_goods_reports (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER REFERENCES users(id),
      agency_name VARCHAR(255),
      product_name VARCHAR(255),
      quantity INTEGER,
      reason TEXT,
      photo_url TEXT,
      timestamp VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS agencies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
      address TEXT,
      lat REAL,
      lng REAL,
      phone VARCHAR(50),
      created_at VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS new_agency_reports (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER,
      agency_name VARCHAR(255),
      address TEXT,
      phone VARCHAR(50),
      lat REAL,
      lng REAL,
      photo_url TEXT,
      notes TEXT,
      created_at VARCHAR(255)
    );
  `;

  try {
    await db.query(schema);
    try {
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
      await db.query('ALTER TABLE sale_reports ADD COLUMN IF NOT EXISTS notes TEXT');
      await db.query('ALTER TABLE sale_reports ADD COLUMN IF NOT EXISTS has_order INTEGER DEFAULT 0');
      await db.query('ALTER TABLE sale_reports ADD COLUMN IF NOT EXISTS order_details TEXT');
      await db.query('ALTER TABLE agencies ADD COLUMN IF NOT EXISTS phone VARCHAR(50)');
    } catch (e) {
      // Ignore
    }
    await db.query(`
      INSERT INTO users (username, password, role, name) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (username) DO NOTHING
    `, ['admin', 'Nhamle@123', 'admin', 'Administrator']);
    
    console.log("Database schema initialized successfully");
  } catch (error) {
    console.error("Error initializing database schema:", error);
  }
};

// API Routes

// Agencies
app.get('/api/agencies', async (req, res) => {
  const agencies = await dbQuery('SELECT * FROM agencies ORDER BY name ASC');
  res.json(agencies);
});

app.post('/api/agencies', async (req, res) => {
  const { name, address, lat, lng, phone } = req.body;
  try {
    await dbExecute(
      'INSERT INTO agencies (name, address, lat, lng, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address, lat, lng, phone, new Date().toISOString()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.post('/api/agencies/bulk', async (req, res) => {
  const { agencies } = req.body; // Array of { name, address, lat, lng, phone }
  try {
    for (const agency of agencies) {
      await dbExecute(
        'INSERT INTO agencies (name, address, lat, lng, phone, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (name) DO UPDATE SET address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng, phone = EXCLUDED.phone',
        [agency.name, agency.address, agency.lat, agency.lng, agency.phone, new Date().toISOString()]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

app.delete('/api/agencies/:id', async (req, res) => {
  await dbExecute('DELETE FROM agencies WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// New Agency Reports
app.get('/api/new-agency-reports', async (req, res) => {
  const reports = await dbQuery(`
    SELECT r.*, u.name as sale_name 
    FROM new_agency_reports r
    JOIN users u ON r.sale_id = u.id
    ORDER BY r.created_at DESC
  `);
  res.json(reports);
});

app.post('/api/new-agency-reports', async (req, res) => {
  const { sale_id, agency_name, address, phone, lat, lng, photo_url, notes } = req.body;
  try {
    await dbExecute(
      'INSERT INTO new_agency_reports (sale_id, agency_name, address, phone, lat, lng, photo_url, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [sale_id, agency_name, address, phone, lat, lng, photo_url, notes, new Date().toISOString()]
    );

    // Broadcast notification to admins and managers
    try {
      const saleUser = await dbQueryOne('SELECT name FROM users WHERE id = ?', [sale_id]);
      const notification = {
        type: 'notification',
        title: 'Đại lý mới được mở!',
        message: `Sale ${saleUser?.name || 'N/A'} vừa báo cáo mở đại lý mới: ${agency_name}`,
        timestamp: new Date().toISOString(),
        category: 'new_agency'
      };
      broadcastToRole('admin', notification);
      broadcastToRole('manager', notification);
    } catch (e) {
      console.error('Error broadcasting new agency notification:', e);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await dbQueryOne('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Dashboard Stats
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const { userId } = req.query;
    const now = new Date();
    const vnOffset = 7 * 60 * 60 * 1000;
    const vnNow = new Date(now.getTime() + vnOffset);
    
    const startOfVnDay = new Date(now.getTime() + vnOffset);
    startOfVnDay.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(startOfVnDay.getTime() - vnOffset);
    
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [usersCount, vehiclesCount, reportsCount, todayDeliveries, todaySalesPoints, yesterdaySurplus] = await Promise.all([
      dbQueryOne('SELECT COUNT(*) as total FROM users'),
      dbQueryOne('SELECT COUNT(*) as total FROM vehicles'),
      dbQueryOne('SELECT COUNT(*) as total FROM driver_reports'),
      dbQueryOne('SELECT COUNT(*) as total FROM driver_reports WHERE timestamp >= ? AND timestamp <= ?', [startOfDay.toISOString(), endOfDay.toISOString()]),
      dbQueryOne(`
        SELECT SUM(CASE WHEN has_order = 1 THEN 1 ELSE 0 END + CASE WHEN duration_minutes >= 30 THEN 1 ELSE 0 END) as total 
        FROM sale_reports 
        WHERE check_in_time >= ? AND check_in_time <= ?
        ${userId ? 'AND sale_id = ?' : ''}
      `, userId ? [startOfDay.toISOString(), endOfDay.toISOString(), userId] : [startOfDay.toISOString(), endOfDay.toISOString()]),
      // Calculate surplus from all previous days
      userId ? dbQuery(`
        SELECT (CAST(check_in_time AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date as date,
               SUM(CASE WHEN has_order = 1 THEN 1 ELSE 0 END + CASE WHEN duration_minutes >= 30 THEN 1 ELSE 0 END) as daily_points
        FROM sale_reports
        WHERE check_in_time < ? AND sale_id = ?
        GROUP BY date
        ORDER BY date ASC
      `, [startOfDay.toISOString(), userId]) : Promise.resolve([])
    ]);

    // Calculate cumulative surplus
    let surplus = 0;
    if (Array.isArray(yesterdaySurplus)) {
      yesterdaySurplus.forEach((day: any) => {
        const points = parseInt(day.daily_points) || 0;
        surplus = Math.max(0, points + surplus - 5);
      });
    }

    res.json({
      users: parseInt(usersCount.total),
      vehicles: parseInt(vehiclesCount.total),
      reports: parseInt(reportsCount.total),
      todayDeliveries: parseInt(todayDeliveries.total),
      todaySales: parseInt(todaySalesPoints.total || 0),
      saleSurplus: surplus
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Users
app.get('/api/users', async (req, res) => {
  const users = await dbQuery('SELECT id, username, role, name, avatar_url FROM users');
  res.json(users);
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, name } = req.body;
  
  try {
    // Prevent editing the main admin account
    const targetUser = await dbQueryOne('SELECT username FROM users WHERE id = ?', [id]);
    if (targetUser && targetUser.username === 'admin') {
      return res.status(403).json({ success: false, message: 'Không thể chỉnh sửa tài khoản quản trị viên hệ thống' });
    }

    if (password) {
      await dbExecute('UPDATE users SET username = ?, password = ?, role = ?, name = ? WHERE id = ?', [username, password, role, name, id]);
    } else {
      await dbExecute('UPDATE users SET username = ?, role = ?, name = ? WHERE id = ?', [username, role, name, id]);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    const result = await dbQueryOne('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?) RETURNING id', [username, password, role, name]);
    const newId = result.id;
    
    // Push to Google Sheets
    appendToSheet('Users!A:E', [
      [
        newId,
        username,
        password,
        role,
        name
      ]
    ]);

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbExecute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { password, avatar_url } = req.body;
  try {
    if (password) {
      await dbExecute('UPDATE users SET password = ? WHERE id = ?', [password, id]);
    }
    if (avatar_url) {
      await dbExecute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar_url, id]);
    }
    const user = await dbQueryOne('SELECT id, username, role, name, avatar_url FROM users WHERE id = ?', [id]);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Vehicles
app.get('/api/vehicles', async (req, res) => {
  const vehicles = await dbQuery('SELECT * FROM vehicles');
  res.json(vehicles);
});

app.post('/api/vehicles', async (req, res) => {
  const { license_plate, insurance_expiry, registration_expiry } = req.body;
  try {
    const result = await dbQueryOne('INSERT INTO vehicles (license_plate, insurance_expiry, registration_expiry) VALUES (?, ?, ?) RETURNING id', [license_plate, insurance_expiry, registration_expiry]);
    const newId = result.id;
    
    // Push to Google Sheets
    appendToSheet('Vehicles!A:D', [
      [
        newId,
        license_plate,
        insurance_expiry || 'Chưa cập nhật',
        registration_expiry || 'Chưa cập nhật',
        new Date().toISOString()
      ]
    ]);

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  const { insurance_expiry, registration_expiry } = req.body;
  try {
    await dbExecute('UPDATE vehicles SET insurance_expiry = ?, registration_expiry = ? WHERE id = ?', [insurance_expiry, registration_expiry, id]);
    
    const vehicle = await dbQueryOne('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (vehicle) {
      // Push update to Google Sheets (as a new log entry for simplicity)
      appendToSheet('Vehicles!A:D', [
        [
          id,
          vehicle.license_plate,
          insurance_expiry || 'Chưa cập nhật',
          registration_expiry || 'Chưa cập nhật',
          new Date().toISOString()
        ]
      ]);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbExecute('DELETE FROM vehicles WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Driver Reports
app.get('/api/driver-reports', async (req, res) => {
  const { startDate, endDate, page: pageQuery, limit: limitQuery } = req.query;
  
  const page = parseInt(pageQuery as string) || 1;
  const limit = parseInt(limitQuery as string) || 50;
  const offset = (page - 1) * limit;
  
  let baseQuery = `
    FROM driver_reports dr
    LEFT JOIN users u ON dr.driver_id = u.id
    LEFT JOIN vehicles v ON dr.vehicle_id = v.id
  `;
  
  const params: any[] = [];
  let whereClause = '';
  
  if (startDate && endDate) {
    const start = new Date(startDate as string);
    start.setUTCHours(0 - 7, 0, 0, 0);
    
    const end = new Date(endDate as string);
    end.setUTCHours(23 - 7, 59, 59, 999);
    
    whereClause = ` WHERE dr.timestamp >= ? AND dr.timestamp <= ?`;
    params.push(start.toISOString(), end.toISOString());
  }
  
  try {
    // Get total count
    const countResult = await dbQueryOne(`SELECT COUNT(*) as total ${baseQuery} ${whereClause}`, params);
    const total = parseInt(countResult.total);
    
    // Get paginated data
    let query = `SELECT dr.id, dr.driver_id, dr.vehicle_id, dr.agency_name, dr.money_amount, dr.location_lat, dr.location_lng, dr.timestamp, 
                 CASE WHEN dr.photo_url IS NOT NULL AND dr.photo_url != '' THEN 1 ELSE 0 END as has_photo,
                 u.name as driver_name, v.license_plate 
                 ${baseQuery} ${whereClause} ORDER BY dr.timestamp DESC LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];
    
    const reports = await dbQuery(query, dataParams);
    
    res.json({
      data: reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/driver-reports', async (req, res) => {
  const { driver_id, vehicle_id, agency_name, money_amount, photo_url, location_lat, location_lng, timestamp } = req.body;
  try {
    const result = await dbQueryOne(
      'INSERT INTO driver_reports (driver_id, vehicle_id, agency_name, money_amount, photo_url, location_lat, location_lng, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [driver_id, vehicle_id, agency_name, money_amount, photo_url, location_lat, location_lng, timestamp]
    );
    const newId = result.id;
    
    // Get driver and vehicle info
    const driver = await dbQueryOne('SELECT name FROM users WHERE id = ?', [driver_id]);
    const vehicle = await dbQueryOne('SELECT license_plate FROM vehicles WHERE id = ?', [vehicle_id]);

    if (String(money_amount).trim() === 'Không Trả Tiền') {
      const dateStr = new Date(timestamp).toLocaleDateString('vi-VN');
      const message = `CẢNH BÁO: ${agency_name} KHÔNG TRẢ TIỀN ngày ${dateStr} (Tài xế: ${driver?.name || 'Không rõ'})`;
      await dbExecute('INSERT INTO notifications (message, created_at) VALUES (?, ?)', [message, timestamp]);
      
      // Real-time notification to Admin
      broadcastToRole('admin', {
        type: 'notification',
        message,
        severity: 'high'
      });
    }

    // Check for large orders (e.g., > 20M)
    const amountNum = parseFloat(String(money_amount).replace(/\D/g, ''));
    if (!isNaN(amountNum) && amountNum >= 20000000) {
      const message = `ĐƠN HÀNG LỚN: ${agency_name} vừa chốt đơn ${amountNum.toLocaleString('vi-VN')} VNĐ!`;
      broadcastToRole('admin', {
        type: 'notification',
        message,
        severity: 'info'
      });
    }

    // Push to Google Sheets
    appendToSheet('DriverReports!A:H', [
      [
        timestamp,
        driver?.name || 'Unknown',
        vehicle?.license_plate || 'Unknown',
        agency_name,
        money_amount,
        `${location_lat},${location_lng}`,
        `https://maps.google.com/?q=${location_lat},${location_lng}`,
        photo_url ? 'Có ảnh' : 'Không có ảnh'
      ]
    ]);

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/driver-reports/:id', async (req, res) => {
  const { id } = req.params;
  const { vehicle_id, agency_name, money_amount, photo_url } = req.body;
  
  try {
    // Check if report exists and is within 24h
    const report = await dbQueryOne('SELECT timestamp FROM driver_reports WHERE id = ?', [id]);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const reportTime = new Date(report.timestamp).getTime();
    const now = new Date().getTime();
    const hoursDiff = (now - reportTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(403).json({ success: false, message: 'Không thể chỉnh sửa báo cáo đã quá 24 giờ' });
    }

    await dbExecute(
      'UPDATE driver_reports SET vehicle_id = ?, agency_name = ?, money_amount = ?, photo_url = ? WHERE id = ?',
      [vehicle_id, agency_name, money_amount, photo_url, id]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Sale Reports
app.get('/api/sale-reports', async (req, res) => {
  const { startDate, endDate, page: pageQuery, limit: limitQuery } = req.query;
  
  const page = parseInt(pageQuery as string) || 1;
  const limit = parseInt(limitQuery as string) || 50;
  const offset = (page - 1) * limit;
  
  let baseQuery = `
    FROM sale_reports sr
    LEFT JOIN users u ON sr.sale_id = u.id
  `;
  
  const params: any[] = [];
  let whereClause = '';
  
  if (startDate && endDate) {
    const start = new Date(startDate as string);
    start.setUTCHours(0 - 7, 0, 0, 0);
    
    const end = new Date(endDate as string);
    end.setUTCHours(23 - 7, 59, 59, 999);
    
    whereClause = ` WHERE sr.check_in_time >= ? AND sr.check_in_time <= ?`;
    params.push(start.toISOString(), end.toISOString());
  }
  
  try {
    // Get total count
    const countResult = await dbQueryOne(`SELECT COUNT(*) as total ${baseQuery} ${whereClause}`, params);
    const total = parseInt(countResult.total);
    
    // Get paginated data
    let query = `SELECT sr.id, sr.sale_id, sr.agency_name, sr.check_in_time, sr.check_out_time, sr.check_in_lat, sr.check_in_lng, sr.notes, sr.has_order, sr.order_details, sr.duration_minutes,
                 CASE WHEN sr.check_in_photo_url IS NOT NULL AND sr.check_in_photo_url != '' THEN 1 ELSE 0 END as has_check_in_photo,
                 CASE WHEN sr.check_out_photo_url IS NOT NULL AND sr.check_out_photo_url != '' THEN 1 ELSE 0 END as has_check_out_photo,
                 u.name as sale_name 
                 ${baseQuery} ${whereClause} ORDER BY sr.check_in_time DESC LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];
    
    const reports = await dbQuery(query, dataParams);
    
    res.json({
      data: reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/sale-reports/check-in', async (req, res) => {
  const { sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time } = req.body;
  try {
    const result = await dbQueryOne(
      'INSERT INTO sale_reports (sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time]
    );
    const newId = result.id;
    
    const sale = await dbQueryOne('SELECT name FROM users WHERE id = ?', [sale_id]);

    // Push to Google Sheets
    appendToSheet('SaleReports!A:I', [
      [
        newId, // Report ID
        sale?.name || 'Unknown',
        agency_name,
        check_in_time,
        `${check_in_lat},${check_in_lng}`,
        `https://maps.google.com/?q=${check_in_lat},${check_in_lng}`,
        check_in_photo_url ? 'Có ảnh' : 'Không có ảnh',
        'Chưa check-out',
        ''
      ]
    ]);

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/sale-reports/check-out', async (req, res) => {
  const { id, check_out_photo_url, check_out_time, duration_minutes, notes, has_order, order_details } = req.body;
  try {
    await dbExecute(
      'UPDATE sale_reports SET check_out_photo_url = ?, check_out_time = ?, duration_minutes = ?, notes = ?, has_order = ?, order_details = ? WHERE id = ?', 
      [check_out_photo_url, check_out_time, duration_minutes, notes || '', has_order ? 1 : 0, order_details || '', id]
    );
    
    const report = await dbQueryOne(`
      SELECT sr.*, u.name as sale_name
      FROM sale_reports sr
      LEFT JOIN users u ON sr.sale_id = u.id
      WHERE sr.id = ?
    `, [id]);

    if (report) {
      // Push check-out info to Google Sheets as a new row (or we could try to update, but append is easier)
      appendToSheet('SaleReports!A:I', [
        [
          id, // Report ID
          report.sale_name || 'Unknown',
          report.agency_name,
          report.check_in_time,
          `${report.check_in_lat},${report.check_in_lng}`,
          `https://maps.google.com/?q=${report.check_in_lat},${report.check_in_lng}`,
          'Đã Check-out',
          check_out_time,
          `${duration_minutes} phút`
        ]
      ]);

      // Notify admin if it's a large order
      if (has_order && order_details) {
        const message = `ĐƠN HÀNG MỚI: ${report.sale_name} vừa chốt đơn tại ${report.agency_name}. Chi tiết: ${order_details}`;
        broadcastToRole('admin', {
          type: 'notification',
          message,
          timestamp: check_out_time
        });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/sale-reports/update-order', async (req, res) => {
  const { id, has_order, order_details } = req.body;
  try {
    await dbExecute(
      'UPDATE sale_reports SET has_order = ?, order_details = ? WHERE id = ?',
      [has_order ? 1 : 0, order_details || '', id]
    );

    // Notify admin if it's a new order being sent
    if (has_order) {
      const report = await dbQueryOne(`
        SELECT sr.*, u.name as sale_name
        FROM sale_reports sr
        LEFT JOIN users u ON sr.sale_id = u.id
        WHERE sr.id = ?
      `, [id]);

      if (report) {
        const message = `ĐƠN HÀNG PHÁT SINH (Chưa check-out): ${report.sale_name} tại ${report.agency_name}. Chi tiết: ${order_details}`;
        broadcastToRole('admin', {
          type: 'notification',
          message,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/sale-reports/:id', async (req, res) => {
  const { id } = req.params;
  const { agency_name, notes, has_order, order_details, check_in_photo_url, check_out_photo_url } = req.body;
  
  try {
    const report = await dbQueryOne('SELECT check_in_time FROM sale_reports WHERE id = ?', [id]);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const reportTime = new Date(report.check_in_time).getTime();
    const now = new Date().getTime();
    const hoursDiff = (now - reportTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(403).json({ success: false, message: 'Không thể chỉnh sửa báo cáo đã quá 24 giờ' });
    }

    await dbExecute(
      'UPDATE sale_reports SET agency_name = ?, notes = ?, has_order = ?, order_details = ?, check_in_photo_url = ?, check_out_photo_url = ? WHERE id = ?',
      [agency_name, notes, has_order ? 1 : 0, order_details, check_in_photo_url, check_out_photo_url, id]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/sale-reports/offline-sync', async (req, res) => {
  const { 
    sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time,
    check_out_photo_url, check_out_time, duration_minutes, notes, has_order, order_details 
  } = req.body;
  
  try {
    const result = await dbQueryOne(
      `INSERT INTO sale_reports (
        sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time,
        check_out_photo_url, check_out_time, duration_minutes, notes, has_order, order_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        sale_id, agency_name, check_in_photo_url, check_in_lat, check_in_lng, check_in_time,
        check_out_photo_url, check_out_time, duration_minutes, notes || '', has_order ? 1 : 0, order_details || ''
      ]
    );
    
    const newId = result.id;
    const sale = await dbQueryOne('SELECT name FROM users WHERE id = ?', [sale_id]);

    // Push to Google Sheets (one row for the full session)
    appendToSheet('SaleReports!A:I', [
      [
        newId,
        sale?.name || 'Unknown',
        agency_name,
        check_in_time,
        `${check_in_lat},${check_in_lng}`,
        `https://maps.google.com/?q=${check_in_lat},${check_in_lng}`,
        'Đã Check-out (Offline Sync)',
        check_out_time,
        `${duration_minutes} phút`
      ]
    ]);

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Driver Expenses
app.get('/api/driver-expenses', async (req, res) => {
  try {
    const expenses = await dbQuery(`
      SELECT de.*, u.name as driver_name, v.license_plate 
      FROM driver_expenses de
      LEFT JOIN users u ON de.driver_id = u.id
      LEFT JOIN vehicles v ON de.vehicle_id = v.id
      ORDER BY de.timestamp DESC
    `);
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/driver-expenses', async (req, res) => {
  const { driver_id, vehicle_id, amount, description, photo_url, timestamp } = req.body;
  try {
    const result = await dbQueryOne(
      'INSERT INTO driver_expenses (driver_id, vehicle_id, amount, description, photo_url, timestamp) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [driver_id, vehicle_id, amount, description, photo_url, timestamp]
    );
    res.json({ success: true, id: result.id });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// KPI Leaderboard
app.get('/api/kpi', async (req, res) => {
  const { month, year } = req.query;
  // Default to current month if not provided
  const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
  const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

  try {
    // Driver KPI: count of deliveries
    const driverKpi = await dbQuery(`
      SELECT u.id, u.name, u.avatar_url, COUNT(dr.id) as total_deliveries
      FROM users u
      LEFT JOIN driver_reports dr ON u.id = dr.driver_id 
        AND EXTRACT(MONTH FROM CAST(dr.timestamp AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') = ?
        AND EXTRACT(YEAR FROM CAST(dr.timestamp AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') = ?
      WHERE u.role = 'driver'
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY total_deliveries DESC
    `, [targetMonth, targetYear]);

    // Sale KPI: count of points (Order = +1, Duration >= 30m = +1)
    const saleKpi = await dbQuery(`
      SELECT u.id, u.name, u.avatar_url, 
             SUM(CASE WHEN sr.has_order = 1 THEN 1 ELSE 0 END + CASE WHEN sr.duration_minutes >= 30 THEN 1 ELSE 0 END) as total_points
      FROM users u
      LEFT JOIN sale_reports sr ON u.id = sr.sale_id
        AND EXTRACT(MONTH FROM CAST(sr.check_in_time AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') = ?
        AND EXTRACT(YEAR FROM CAST(sr.check_in_time AS TIMESTAMP) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') = ?
      WHERE u.role = 'sale'
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY total_points DESC
    `, [targetMonth, targetYear]);

    res.json({ success: true, driverKpi, saleKpi });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Zalo Notification Stub
app.post('/api/zalo-notify', async (req, res) => {
  const { message, phone } = req.body;
  // In a real app, this would call the Zalo OA API
  console.log(`[ZALO STUB] Sending message to ${phone || 'Admin'}: ${message}`);
  res.json({ success: true, message: 'Notification sent via Zalo (Stub)' });
});

// Return Goods Reports
app.get('/api/return-goods-reports', async (req, res) => {
  const { startDate, endDate, page: pageQuery, limit: limitQuery } = req.query;
  const page = parseInt(pageQuery as string) || 1;
  const limit = parseInt(limitQuery as string) || 50;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT r.id, r.driver_id, r.agency_name, r.product_name, r.quantity, r.reason, r.timestamp,
             CASE WHEN r.photo_url IS NOT NULL AND r.photo_url != '' THEN 1 ELSE 0 END as has_photo,
             u.name as driver_name 
      FROM return_goods_reports r
      LEFT JOIN users u ON r.driver_id = u.id
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setUTCHours(0 - 7, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setUTCHours(23 - 7, 59, 59, 999);
      
      query += ' WHERE r.timestamp BETWEEN ? AND ?';
      params.push(start.toISOString(), end.toISOString());
    }

    query += ' ORDER BY r.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const reports = await dbQuery(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM return_goods_reports';
    const countParams: any[] = [];
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setUTCHours(0 - 7, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setUTCHours(23 - 7, 59, 59, 999);
      
      countQuery += ' WHERE timestamp BETWEEN ? AND ?';
      countParams.push(start.toISOString(), end.toISOString());
    }
    const totalResult = await dbQueryOne(countQuery, countParams);
    
    res.json({
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.total),
        totalPages: Math.ceil(parseInt(totalResult.total) / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/return-goods-reports', async (req, res) => {
  const { driver_id, agency_name, product_name, quantity, reason, photo_url, timestamp } = req.body;
  try {
    const result = await dbQueryOne(
      'INSERT INTO return_goods_reports (driver_id, agency_name, product_name, quantity, reason, photo_url, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [driver_id, agency_name, product_name, quantity, reason, photo_url, timestamp]
    );
    const newId = result.id;

    // Log to Google Sheets
    try {
      const user = await dbQueryOne('SELECT name FROM users WHERE id = ?', [driver_id]);
      await appendToSheet('ReturnGoods', [
        newId,
        user ? user.name : driver_id,
        agency_name,
        product_name,
        quantity,
        reason,
        photo_url || '',
        timestamp
      ]);
    } catch (e) {
      console.error('Error logging to Google Sheets:', e);
    }

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// AI Vision: Extract money from photo
app.post('/api/ai/extract-money', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, message: 'Image is required' });

  try {
    // Clean base64 string
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: {
        parts: [
          { text: "Bạn là một chuyên gia đọc hóa đơn và chứng từ. Hãy nhìn vào hình ảnh này và trích xuất TỔNG SỐ TIỀN được ghi trong đó. Chỉ trả về con số duy nhất, không thêm bất kỳ văn bản nào khác. Nếu không tìm thấy số tiền, hãy trả về '0'." },
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    });

    const text = response.text?.trim() || '0';
    // Remove non-numeric characters
    const amount = text.replace(/[^0-9]/g, '');
    
    res.json({ success: true, amount });
  } catch (error: any) {
    console.error('AI Vision Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Photo Retrieval Endpoints
app.get('/api/reports/:type/:id/photo', async (req, res) => {
  const { type, id } = req.params;
  const { photoType } = req.query; // For sale reports: 'check_in' or 'check_out'
  
  let table = '';
  let column = 'photo_url';
  
  if (type === 'driver') {
    table = 'driver_reports';
  } else if (type === 'sale') {
    table = 'sale_reports';
    column = photoType === 'check_out' ? 'check_out_photo_url' : 'check_in_photo_url';
  } else if (type === 'return') {
    table = 'return_goods_reports';
  } else {
    return res.status(400).json({ success: false, message: 'Invalid report type' });
  }

  try {
    const report = await dbQueryOne(`SELECT ${column} as photo_url FROM ${table} WHERE id = ?`, [id]);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, photo_url: report.photo_url });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/reports/:type/:id/image', async (req, res) => {
  const { type, id } = req.params;
  const { photoType } = req.query;
  
  let table = '';
  let column = 'photo_url';
  
  if (type === 'driver') table = 'driver_reports';
  else if (type === 'sale') {
    table = 'sale_reports';
    column = photoType === 'check_out' ? 'check_out_photo_url' : 'check_in_photo_url';
  } else if (type === 'return') table = 'return_goods_reports';
  else return res.status(400).send('Invalid type');

  try {
    const report = await dbQueryOne(`SELECT ${column} as photo_url FROM ${table} WHERE id = ?`, [id]);
    if (!report || !report.photo_url) return res.status(404).send('Not found');
    
    const base64Data = report.photo_url;
    if (base64Data.startsWith('data:image')) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for a year
        return res.send(buffer);
      }
    }
    res.status(400).send('Invalid image data');
  } catch (error) {
    res.status(500).send('Error');
  }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await dbQuery('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    res.json(notifications);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    await dbExecute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/db-status', async (req, res) => {
  try {
    const result = await db.query('SELECT 1');
    res.json({ 
      success: true, 
      status: "connected", 
      database: "Supabase (PostgreSQL)",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      status: "disconnected", 
      error: error.message 
    });
  }
});

// Catch-all for API routes to prevent falling through to SPA fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// Vite middleware setup
async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
