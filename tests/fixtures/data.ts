type TestUser = {
  email?: string;
  password?: string;
};

/**
 * Credentials loaded from environment variables (via .env.test).
 * - TEST_USER_* should point to a normal seeded Supabase account for standard flows.
 * - TEST_ADMIN_* should point to an admin-capable seeded account if admin tests are run.
 */
export const testUsers: Record<'standard' | 'admin', TestUser> = {
  standard: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
};

/**
 * Placeholder seed IDs to be filled from seeded data later.
 */
export const seedIds: {
  exampleCatchId?: string;
  exampleSessionId?: string;
} = {
  exampleCatchId: undefined,
  exampleSessionId: undefined,
};
