import { z } from 'zod';

export const dashboardSummarySchema = {
  query: z.object({
    hubId: z
      .string()
      .trim()
      .optional()
      .transform((val) => {
        if (!val || val.toUpperCase() === 'ALL') {
          return undefined;
        }
        return val;
      })
      .refine(
        (val) => val === undefined || z.string().uuid().safeParse(val).success,
        'Invalid hubId UUID format'
      ),
  }),
};
