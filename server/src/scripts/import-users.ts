import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import path from 'path';

// Load env from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SALT_ROUNDS = 12;

const VALID_ROLES = ['transporter', 'dispatcher', 'supervisor', 'manager'] as const;
const VALID_FLOORS = ['FCC1', 'FCC4', 'FCC5', 'FCC6'] as const;

interface ParsedUser {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  primary_floor: string | null;
  password: string;
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }
  const last_name = parts[parts.length - 1]; // last word (may be hyphenated)
  const first_name = parts.slice(0, -1).join(' ');
  return { first_name, last_name };
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function normalizeFloor(floor: string): string | null {
  if (!floor || floor.trim() === '') return null;
  const normalized = floor.trim().toUpperCase();
  if (VALID_FLOORS.includes(normalized as any)) return normalized;
  // Try prefixing with FCC if it's just a number
  const withPrefix = `FCC${normalized.replace(/\s+/g, '')}`;
  if (VALID_FLOORS.includes(withPrefix as any)) return withPrefix;
  return normalized; // return as-is for validation to catch
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNameFromRow(row: Record<string, any>): string | undefined {
  // The Managers sheet uses "Managers" as the name column header; others use "Name"
  return row['Name'] || row['Managers'];
}

async function importUsers() {
  const excelPath = path.resolve('C:/Users/GWSwa/Desktop/FCC Transport Users Final.xlsx');
  console.log(`Reading Excel file: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  console.log(`Sheets found: ${workbook.SheetNames.join(', ')}\n`);

  // Collect rows from ALL sheets
  const allRows: { row: Record<string, any>; sheet: string; rowNum: number }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
    console.log(`  Sheet "${sheetName}": ${rows.length} rows`);
    for (let i = 0; i < rows.length; i++) {
      allRows.push({ row: rows[i], sheet: sheetName, rowNum: i + 2 });
    }
  }

  console.log(`\nTotal rows across all sheets: ${allRows.length}\n`);

  // Parse and validate all rows
  const users: ParsedUser[] = [];
  const errors: string[] = [];

  for (const { row, sheet, rowNum } of allRows) {
    const name = getNameFromRow(row);
    const email = row['Email'];
    const role = row['Role'];
    const primaryFloor = row['Primary Floor'];
    const password = row['Password'];

    if (!name || !email || !role || !password) {
      errors.push(`${sheet} row ${rowNum}: Missing required field (name=${name}, email=${email}, role=${role}, password=${password ? '***' : undefined})`);
      continue;
    }

    const { first_name, last_name } = splitName(name);
    const normalizedRole = normalizeRole(role);
    const normalizedFloor = normalizeFloor(primaryFloor || '');
    const normalizedEmail = email.toString().trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) {
      errors.push(`${sheet} row ${rowNum}: Invalid email "${normalizedEmail}"`);
      continue;
    }

    if (!VALID_ROLES.includes(normalizedRole as any)) {
      errors.push(`${sheet} row ${rowNum}: Invalid role "${role}" (expected: ${VALID_ROLES.join(', ')})`);
      continue;
    }

    if (normalizedFloor && !VALID_FLOORS.includes(normalizedFloor as any)) {
      errors.push(`${sheet} row ${rowNum}: Invalid floor "${primaryFloor}" (expected: ${VALID_FLOORS.join(', ')})`);
      continue;
    }

    users.push({
      first_name,
      last_name,
      email: normalizedEmail,
      role: normalizedRole,
      primary_floor: normalizedFloor,
      password: password.toString(),
    });
  }

  if (errors.length > 0) {
    console.log('Validation errors:');
    errors.forEach((e) => console.log(`  - ${e}`));
    console.log('');
  }

  if (users.length === 0) {
    console.log('No valid users to import. Exiting.');
    await pool.end();
    return;
  }

  console.log(`Importing ${users.length} valid users...\n`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const transporterIds: number[] = [];

  try {
    await client.query('BEGIN');

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, primary_floor)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, role`,
        [user.email, passwordHash, user.first_name, user.last_name, user.role, user.primary_floor]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
        console.log(`  + Inserted: ${user.first_name} ${user.last_name} (${user.role}) - ${user.email}`);
        if (result.rows[0].role === 'transporter') {
          transporterIds.push(result.rows[0].id);
        }
      } else {
        skipped++;
        console.log(`  ~ Skipped (duplicate): ${user.email}`);
      }
    }

    // Create transporter_status records for new transporters
    for (const userId of transporterIds) {
      await client.query(
        `INSERT INTO transporter_status (user_id, status)
         VALUES ($1, 'offline')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    }

    await client.query('COMMIT');

    console.log('\n--- Import Summary ---');
    console.log(`Total rows in Excel:  ${allRows.length}`);
    console.log(`Validation errors:    ${errors.length}`);
    console.log(`Inserted:             ${inserted}`);
    console.log(`Skipped (duplicate):  ${skipped}`);
    console.log(`Transporter statuses: ${transporterIds.length} created`);
    console.log('Import completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importUsers();
