import argon2 from 'argon2'

const PEPPER = process.env.AUTH_PEPPER // Ensure to set a strong pepper in production

if (!PEPPER) {
  throw new Error('PEPPER environment variable is not set')
}

/**
 * Hashes a password using argon2 with a pepper.
 * @param password - The plain text password to hash.
 * @returns The hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const combinedPassword = password + PEPPER
  return await argon2.hash(combinedPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  })
}

/**
 * Verifies a password against a hashed password using argon2 with a pepper.
 * @param hashedPassword - The hashed password to verify against.
 * @param inputPassword - The plain text password to verify.
 * @returns True if the password matches, false otherwise.
 */
export async function verifyPassword(
  hashedPassword: string,
  inputPassword: string
): Promise<boolean> {
  const combinedPassword = inputPassword + PEPPER
  return await argon2.verify(hashedPassword, combinedPassword)
}
