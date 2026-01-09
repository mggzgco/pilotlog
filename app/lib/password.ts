import argon2 from "argon2";

// AUTH-005: use Argon2id for secure password hashing
const options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1
};

export async function hashPassword(password: string) {
  return argon2.hash(password, options);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}
