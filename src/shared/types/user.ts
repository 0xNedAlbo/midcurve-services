/**
 * User Type Definitions
 *
 * Simple user model for position tracking and identification.
 * No authentication logic - that's handled by the API project.
 */

/**
 * User interface
 *
 * Minimal user model with just id, name, and timestamps.
 * Provides foreign key support for Position model.
 */
export interface User {
  /**
   * Unique identifier (database-generated)
   */
  id: string;

  /**
   * User's display name
   */
  name: string;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last update timestamp
   */
  updatedAt: Date;
}
