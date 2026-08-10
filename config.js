// ==========================================
// CENTRAL SUPER ADMIN & CONFIGURATION FILE
// ==========================================

// 1. YOUR SUPER ADMIN EMAIL (Replace with your actual account email)
const SUPER_ADMIN_EMAIL = "miacairns22@gmail.com";

// 2. PERMISSION MATRIX
// Easily enable or disable features as you build more functionality in the future.
const ADMIN_PERMISSIONS = {
  canChangeGroupName: true,
  canChangeGroupPasscode: true,
  canDeleteMessages: true,
  canKickMembers: true
};

/**
 * Checks if the current logged-in user is authorized as an Admin for a group.
 * Returns true if:
 * - User's email matches SUPER_ADMIN_EMAIL
 * - OR User is the original creator of the group (currentGroup.creator_id)
 */
function isUserAdmin(user, group) {
  if (!user) return false;
  
  // Super Admin override (You always have permission everywhere)
  if (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  
  // Creator check (Group owner has permission in their own group)
  if (group && group.creator_id === user.id) {
    return true;
  }

  return false;
}
