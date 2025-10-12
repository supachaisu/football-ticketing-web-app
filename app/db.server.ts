import Database from 'better-sqlite3'

//
// Basic Setup
//

// Open or create the SQLite database
export const db = new Database('football-ticketing-app.sqlite')

// Enable foreign key constraints
db.pragma('foreign_keys = ON')
// Use Write-Ahead Logging for better concurrency
db.pragma('journal_mode = WAL')

// Simple integrity check
const result = db.prepare('PRAGMA integrity_check;').get() as {
  integrity_check: string
}
if (result.integrity_check !== 'ok') {
  console.log('Database integrity check failed:', result)
  throw new Error('Database integrity check failed')
}

//
// Initialize the database schema
//

// Create customers table
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`)
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_customer_created_at ON customers(created_at DESC)`
)
db.exec(`CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email)`)

// Create password hashes table
db.exec(`
CREATE TABLE IF NOT EXISTS password_hashes (
  customer_id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
)
`)

// Create matches table
db.exec(`
CREATE TABLE IF NOT EXISTS matches (
  match_id INTEGER PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TEXT NOT NULL,
  stadium TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_match_date ON matches(match_date)`)

// Create bookings table
db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  booking_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  booking_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
)
`)
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_booking_customer ON bookings(customer_id)`
)
db.exec(`CREATE INDEX IF NOT EXISTS idx_booking_match ON bookings(match_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status)`)
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_booking_date ON bookings(booking_date DESC)`
)

// Create tickets table
db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL,
  seat_number TEXT NOT NULL,
  ticket_type TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
)
`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_ticket_booking ON tickets(booking_id)`)

// Create payments table
db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
)
`)
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_payment_booking ON payments(booking_id)`
)
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_payment_date ON payments(payment_date DESC)`
)
db.exec(`CREATE INDEX IF NOT EXISTS idx_payment_status ON payments(status)`)

//
// Seed initial data
//

// Seed some matches if none exist
const matchCount = db
  .prepare<[], number>('SELECT COUNT(*) as count FROM matches')
  .get()
