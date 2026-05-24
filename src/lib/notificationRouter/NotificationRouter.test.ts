/**
 * NotificationRouter — Unit Tests
 * يتحقق من: rule matching, deduplication, priority handling, suppression
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationRouter } from './NotificationRouter';

describe('NotificationRouter', () => {
  let router: NotificationRouter;

  beforeEach(() => {
    router = new NotificationRouter();
  });

  describe('Critical events', () => {
    it('should always deliver ride-cancelled', async () => {
      const result = await router.routeNotification(
        'ride-cancelled',
        { rideId: 'r1' },
        { isDriving: true, isActiveRide: true }
      );
      expect(result).not.toBeNull();
      expect(result?.eventType).toBe('ride-cancelled');
      expect(result?.delivery.sound).toBe(true);
    });

    it('should deliver urgent-support regardless of context', async () => {
      const result = await router.routeNotification(
        'urgent-support',
        {},
        { isDriving: true }
      );
      expect(result).not.toBeNull();
    });
  });

  describe('Driver parked vs driving', () => {
    it('should deliver ride-accepted when driver is parked', async () => {
      const result = await router.routeNotification(
        'ride-accepted',
        { rideId: 'r1' },
        { isDriving: false, isActiveRide: false }
      );
      expect(result).not.toBeNull();
      expect(result?.delivery.sound).toBe(true);
    });
  });

  describe('Deduplication', () => {
    it('should suppress duplicate event within window', async () => {
      const r1 = await router.routeNotification(
        'ride-cancelled',
        { rideId: 'r-dup' },
        {}
      );
      const r2 = await router.routeNotification(
        'ride-cancelled',
        { rideId: 'r-dup' },
        {}
      );
      expect(r1).not.toBeNull();
      expect(r2).toBeNull();
      const stats = router.getStats();
      expect(stats.totalSuppressed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Stats tracking', () => {
    it('should increment totalReceived on every call', async () => {
      await router.routeNotification('ride-cancelled', {}, {});
      await router.routeNotification('urgent-support', {}, {});
      const stats = router.getStats();
      expect(stats.totalReceived).toBe(2);
    });

    it('should track delivered notifications by priority', async () => {
      await router.routeNotification(
        'ride-cancelled',
        { rideId: 'r1' },
        {}
      );
      const stats = router.getStats();
      expect(stats.totalDelivered).toBeGreaterThanOrEqual(1);
      expect(Object.keys(stats.deliveredByPriority).length).toBeGreaterThan(0);
    });
  });

  describe('No matching rule', () => {
    it('should handle event without crash', async () => {
      const result = await router.routeNotification(
        'rating-request',
        {},
        { isDriving: true, isActiveRide: false }
      );
      // قد يُسلَّم أو يُحظر — المهم لا crash
      expect(result === null || (result && result.eventType === 'rating-request')).toBe(true);
    });
  });
});
