/**
 * Environment variable validation
 *
 * Validates all required environment variables at startup.
 * Provides clear error messages if configuration is invalid.
 *
 * SEC-003: Prevent confusing runtime errors from missing/invalid env vars
 */

interface EnvValidationError {
  variable: string;
  issue: string;
  suggestion: string;
}

interface EnvValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
  warnings: EnvValidationError[];
}

/**
 * Validates that a string is a valid URL
 */
const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isLocalSupabaseUrl = (value: string): boolean => {
  return value.startsWith('http://127.0.0.1:54321') || value.startsWith('http://localhost:54321');
};

/**
 * Validates that a Supabase key looks plausible for hosted mode (JWT-like).
 */
const looksLikeHostedAnonKey = (value: string): boolean => {
  return value.length > 80 && value.split('.').length === 3;
};

/**
 * Validates all required environment variables
 */
export const validateEnvironmentVariables = (): EnvValidationResult => {
  const errors: EnvValidationError[] = [];
  const warnings: EnvValidationError[] = [];

  // Check VITE_SUPABASE_URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    errors.push({
      variable: 'VITE_SUPABASE_URL',
      issue: 'Missing required environment variable',
      suggestion: 'Add VITE_SUPABASE_URL to your .env file (e.g., https://xxx.supabase.co)',
    });
  } else if (!isValidUrl(supabaseUrl)) {
    errors.push({
      variable: 'VITE_SUPABASE_URL',
      issue: 'Invalid URL format',
      suggestion: `Value "${supabaseUrl}" is not a valid URL. Should be https://xxx.supabase.co`,
    });
  } else if (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')) {
    warnings.push({
      variable: 'VITE_SUPABASE_URL',
      issue: 'Using localhost URL',
      suggestion: 'This looks like a local dev server URL. For production, use your Supabase project URL (https://xxx.supabase.co)',
    });
  } else if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.in')) {
    warnings.push({
      variable: 'VITE_SUPABASE_URL',
      issue: 'Unexpected URL format',
      suggestion: `URL "${supabaseUrl}" doesn't match typical Supabase format (https://xxx.supabase.co)`,
    });
  }

  // Check VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const actualKey = publishableKey || anonKey;
  const urlIsLocal = supabaseUrl ? isLocalSupabaseUrl(supabaseUrl) : false;

  if (!actualKey) {
    errors.push({
      variable: 'VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY',
      issue: 'Missing required environment variable',
      suggestion: 'Add either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY to your .env file',
    });
  } else if (urlIsLocal) {
    // Local mode: accept sb_ keys; only error if empty
    if (!actualKey || !actualKey.startsWith('sb_')) {
      errors.push({
        variable: publishableKey ? 'VITE_SUPABASE_PUBLISHABLE_KEY' : 'VITE_SUPABASE_ANON_KEY',
        issue: 'Invalid local key format',
        suggestion: 'For local dev, use the publishable key printed by `supabase start` (sb_publishable_…).',
      });
    }
  } else {
    // Hosted mode: require JWT-like anon key
    if (!looksLikeHostedAnonKey(actualKey)) {
      errors.push({
        variable: publishableKey ? 'VITE_SUPABASE_PUBLISHABLE_KEY' : 'VITE_SUPABASE_ANON_KEY',
        issue: 'Invalid key format',
        suggestion: 'Use the anon key from your Supabase project settings (long JWT with 3 segments).',
      });
    }
  }

  // Check for dangerous service role key in client code (should NEVER be present)
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    errors.push({
      variable: 'VITE_SUPABASE_SERVICE_ROLE_KEY',
      issue: 'CRITICAL SECURITY ISSUE: Service role key exposed in client code!',
      suggestion: 'IMMEDIATELY remove VITE_SUPABASE_SERVICE_ROLE_KEY from your environment variables. This key bypasses all RLS policies and should NEVER be in frontend code. Use only the anon/publishable key.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Logs validation errors to console with clear formatting
 */
export const logValidationErrors = (result: EnvValidationResult): void => {
  if (result.errors.length > 0) {
    console.error('❌ Environment Variable Validation Failed\n');
    result.errors.forEach((error) => {
      console.error(`Variable: ${error.variable}`);
      console.error(`Issue: ${error.issue}`);
      console.error(`Suggestion: ${error.suggestion}\n`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Variable Warnings\n');
    result.warnings.forEach((warning) => {
      console.warn(`Variable: ${warning.variable}`);
      console.warn(`Issue: ${warning.issue}`);
      console.warn(`Suggestion: ${warning.suggestion}\n`);
    });
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('✅ Environment variables validated successfully');
  }
};

/**
 * Validates environment variables and throws error if invalid
 * Call this at app startup to fail fast with clear error messages
 */
export const validateEnvironmentOrThrow = (): void => {
  const result = validateEnvironmentVariables();

  if (!result.valid) {
    logValidationErrors(result);
    throw new Error(
      'Environment variable validation failed. Check console for details. ' +
      'See .env.example for required variables.'
    );
  }

  // Always log result (warnings or success)
  if (result.warnings.length > 0) {
    logValidationErrors(result);
  } else {
    console.log('✅ Environment variables validated successfully');
  }
};
