-- Approve the test driver so they can see pending rides
UPDATE drivers 
SET status = 'approved' 
WHERE id = '1e6f6005-b4dc-4a08-a9d3-c894c90b5fbc';