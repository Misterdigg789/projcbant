import { test, expect } from '@playwright/test';
import { storage } from '../../server/storage';
import { db } from '../../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

test.describe('Profile update surfacing', () => {
  test('profile update is immediately reflected in server profile', async () => {
    const userId = `test_e2e_${Date.now()}`;
    const username = `e2e_test_${Date.now()}`;

    // Create a test user
    const created = await storage.createUser({
      id: userId,
      email: `${userId}@example.com`,
      password: 'test-password',
      firstName: 'E2E',
      lastName: 'User',
      username,
      profileImageUrl: null,
    });

    try {
      const initialProfile = await storage.getUserProfile(userId, userId);
      expect(initialProfile.firstName).toBe('E2E');

      // Update the profile
      await storage.updateUserProfile(userId, { firstName: 'UpdatedE2E' });

      // Read back the profile to confirm immediate consistency
      const updatedProfile = await storage.getUserProfile(userId, userId);
      expect(updatedProfile.firstName).toBe('UpdatedE2E');
    } finally {
      // Clean up test user
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});