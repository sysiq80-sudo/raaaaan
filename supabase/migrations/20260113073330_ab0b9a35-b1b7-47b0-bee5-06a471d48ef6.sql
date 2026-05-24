-- Remove block from phone number 964
DELETE FROM blocked_phones WHERE phone = '964';

-- Also clean up any old blocks that have expired
DELETE FROM blocked_phones WHERE blocked_until < NOW() AND is_permanent = false;