import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
    company: z.string().trim().max(100).optional(),
    collegeName: z.string().trim().max(200).optional(),
    branch: z.string().trim().max(100).optional(),
    guideName: z.string().trim().max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    timezone: z.string().trim().max(50).optional(),
    notificationPreferences: z
      .object({
        emailNotifications: z.boolean().optional(),
        smsNotifications: z.boolean().optional(),
      })
      .optional(),
  }),
});
