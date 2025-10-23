import { Schema } from 'effect'
import { db } from '~/db.server'
import { Email, type Customer } from '~/auth/schemas.server'

/**
 * Customer Repository
 * Tiny layer over better-sqlite3 to keep queries typed and reusable.
 * Selects explicit columns to match the Customer schema (omits created_at).
 */

const selectCustomerColumns = `
	SELECT customer_id, name, email, phone
	FROM customers
` as const

/** Find a customer by numeric ID. */
export function findCustomerById(customerId: number | bigint): Customer | null {
	const row = db
		.prepare<[number | bigint], Customer>(`${selectCustomerColumns} WHERE customer_id = ?`)
		.get(customerId)
	return row ?? null
}

/** Find a customer by validated email (use Email brand). */
export function findCustomerByEmail(email: Email): Customer | null {
	const row = db
		.prepare<Email, Customer>(`${selectCustomerColumns} WHERE email = ?`)
		.get(email)
	return row ?? null
}

/**
 * Convenience helper: accepts an unknown string, validates it as Email, and
 * returns the matching customer or null if invalid/not found.
 */
export function findCustomerByEmailUnsafe(emailStr: string): Customer | null {
	const parsed = Schema.decodeUnknownEither(Email)(emailStr)
	if (parsed._tag === 'Left') return null
	return findCustomerByEmail(parsed.right)
}

/** Check if a customer exists by ID. */
export function customerExists(customerId: number | bigint): boolean {
	const row = db
		.prepare<[number | bigint], { count: number }>(
			'SELECT COUNT(1) as count FROM customers WHERE customer_id = ?'
		)
		.get(customerId)
	return (row?.count ?? 0) > 0
}

