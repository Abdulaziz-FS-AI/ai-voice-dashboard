// Admin configuration - Add authorized admin users here
export const adminConfig = {
  // List of authorized admin usernames
  authorizedAdmins: [
    'admin',
    'abdulaziz',
    'voice-matrix-admin',
    // Add more admin usernames here as needed
  ],

  // List of authorized admin emails
  authorizedAdminEmails: [
    'admin@voicematrix.com',
    'abdulaziz@voicematrix.com',
    'abdulaziz.fs.ai@gmail.com',
    // Add more admin emails here as needed
  ],

  // Secret admin access code (for emergency access)
  adminAccessCode: 'VOICE_MATRIX_ADMIN_2024',
};

/**
 * Check if a user is authorized as an admin
 */
export const isAuthorizedAdmin = (user: any, userName: string | null): boolean => {
  if (!user && !userName) return false;

  // Check by username
  if (userName && adminConfig.authorizedAdmins.includes(userName.toLowerCase())) {
    return true;
  }

  // Check by user.username (fallback)
  if (user?.username && adminConfig.authorizedAdmins.includes(user.username.toLowerCase())) {
    return true;
  }

  // Check by email if available
  if (user?.email && adminConfig.authorizedAdminEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  // Check sign-in details for email
  if (user?.signInDetails?.loginId && adminConfig.authorizedAdminEmails.includes(user.signInDetails.loginId.toLowerCase())) {
    return true;
  }

  return false;
};

/**
 * Check admin access code for emergency access
 */
export const validateAdminAccessCode = (code: string): boolean => {
  return code === adminConfig.adminAccessCode;
};

// Additional admin utilities
export interface AdminUser {
  email: string;
  role: 'admin' | 'super-admin';
  permissions: string[];
}

/**
 * Check if user has specific permission for VAPI management
 */
export const hasVapiPermission = (user: any, userName: string | null): boolean => {
  return isAuthorizedAdmin(user, userName);
};

/**
 * Get user role for display purposes
 */
export const getUserRole = (user: any, userName: string | null): 'user' | 'admin' => {
  return isAuthorizedAdmin(user, userName) ? 'admin' : 'user';
};

// Available permissions
export const PERMISSIONS = {
  MANAGE_ASSISTANTS: 'manage-assistants',
  MANAGE_USERS: 'manage-users', 
  VIEW_ANALYTICS: 'view-analytics',
  MANAGE_API_KEYS: 'manage-api-keys'
} as const;