import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a plaintext password against a bcrypt hash
 */
export const comparePassword = async (
  plain: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};
