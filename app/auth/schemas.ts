import { Schema } from 'effect'

export const Email = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  Schema.brand('Email')
)
export type Email = typeof Email.Type

export class Customer extends Schema.Class<Customer>('Customer')({
  id: Schema.Int,
  name: Schema.NonEmptyTrimmedString,
  email: Email,
  phone: Schema.NonEmptyTrimmedString,
}) {}
