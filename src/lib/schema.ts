import z from 'zod';

/**
 * Platform config.
 *
 * @since 1.0.0
 */
export const platformConfig = z.object({
  platform: z.literal('ADTPulse'),
  name: z.string().min(1).max(50),
  subdomain: z.union([
    z.literal('portal'),
    z.literal('portal-ca'),
  ]),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(300),
  fingerprint: z.string().min(1).max(5120),
  mode: z.union([
    z.literal('normal'),
    z.literal('paused'),
    z.literal('reset'),
  ]),
  speed: z.union([
    z.literal(1),
    z.literal(0.75),
    z.literal(0.5),
    z.literal(0.25),
  ]),
  sensors: z.array(z.object({
    name: z.string().min(1).max(50).optional(),
    adtName: z.string().min(1).max(100),
    adtType: z.union([
      z.literal('co'),
      z.literal('doorWindow'),
      z.literal('fire'),
      z.literal('flood'),
      z.literal('glass'),
      z.literal('motion'),
      z.literal('panic'),
      z.literal('temperature'),
    ]),
    adtZone: z.number().min(1).max(99),
  })).min(1).max(148),
});
