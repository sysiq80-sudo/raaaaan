-- Migration: 20260406150400_admin_dashboard_stats
-- Description: Creates an RPC function to aggregate all admin dashboard statistics in a single call to prevent client-side JS bottlenecks and memory leaks.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
    p_today_start TIMESTAMP WITH TIME ZONE,
    p_week_ago_start TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_rides BIGINT;
    v_active_drivers BIGINT;
    v_pending_drivers BIGINT;
    v_total_users BIGINT;
    v_active_rides BIGINT;
    v_completed_rides BIGINT;
    v_cancelled_rides BIGINT;
    v_total_drivers BIGINT;
    
    v_today_rides BIGINT;
    v_today_earnings NUMERIC;
    
    v_weekly_rides BIGINT;
    v_weekly_earnings NUMERIC;
    
    v_total_incentives_paid NUMERIC;
    v_avg_driver_rating NUMERIC;
    
    v_regions_count BIGINT;
    v_landmarks_count BIGINT;
BEGIN
    -- Only allow admins to use this function
    IF NOT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can access dashboard stats';
    END IF;

    -- Basic Counts
    SELECT COUNT(id) INTO v_total_rides FROM rides;
    SELECT COUNT(id) INTO v_total_users FROM profiles;
    SELECT COUNT(id) INTO v_total_drivers FROM drivers;
    SELECT COUNT(id) INTO v_active_drivers FROM drivers WHERE is_online = true;
    SELECT COUNT(id) INTO v_pending_drivers FROM drivers WHERE status = 'pending';
    
    -- Rides breakdowns
    SELECT COUNT(id) INTO v_active_rides FROM rides WHERE status IN ('pending', 'accepted', 'arrived', 'in_progress');
    SELECT COUNT(id) INTO v_completed_rides FROM rides WHERE status = 'completed';
    SELECT COUNT(id) INTO v_cancelled_rides FROM rides WHERE status = 'cancelled';
    
    -- Today's Stats
    SELECT 
        COUNT(id), 
        COALESCE(SUM(final_fare), 0)
    INTO 
        v_today_rides, 
        v_today_earnings
    FROM rides 
    WHERE created_at >= p_today_start;

    -- Adjust today earnings (only completed rides)
    SELECT COALESCE(SUM(final_fare), 0) INTO v_today_earnings
    FROM rides 
    WHERE created_at >= p_today_start AND status = 'completed';

    -- Weekly Stats
    SELECT 
        COUNT(id), 
        COALESCE(SUM(final_fare), 0)
    INTO 
        v_weekly_rides, 
        v_weekly_earnings
    FROM rides 
    WHERE created_at >= p_week_ago_start AND status = 'completed';

    -- Adjust weekly total rides
    SELECT COUNT(id) INTO v_weekly_rides
    FROM rides 
    WHERE created_at >= p_week_ago_start;

    -- Other Stats
    SELECT COALESCE(SUM(bonus_earned), 0) INTO v_total_incentives_paid FROM driver_incentive_claims;
    SELECT COALESCE(AVG(rating), 0) INTO v_avg_driver_rating FROM drivers WHERE rating IS NOT NULL;
    
    SELECT COUNT(id) INTO v_regions_count FROM regions WHERE is_active = true;
    SELECT COUNT(id) INTO v_landmarks_count FROM landmarks WHERE is_active = true;

    -- Return JSON Object
    RETURN jsonb_build_object(
        'totalRides', v_total_rides,
        'activeDrivers', v_active_drivers,
        'pendingDrivers', v_pending_drivers,
        'totalUsers', v_total_users,
        'activeRides', v_active_rides,
        'completedRides', v_completed_rides,
        'cancelledRides', v_cancelled_rides,
        'todayRides', v_today_rides,
        'todayEarnings', v_today_earnings,
        'weeklyRides', v_weekly_rides,
        'weeklyEarnings', v_weekly_earnings,
        'totalIncentivesPaid', v_total_incentives_paid,
        'totalDrivers', v_total_drivers,
        'avgDriverRating', ROUND(v_avg_driver_rating, 1),
        'regionsCount', v_regions_count,
        'landmarksCount', v_landmarks_count
    );
END;
$$;
