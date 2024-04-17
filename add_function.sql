CREATE OR REPLACE FUNCTION increment_clicks(domain_id integer) RETURNS void AS $$
BEGIN
  UPDATE Domain
  SET clicks = clicks + 1
  WHERE id = domain_id;
END;
$$ LANGUAGE plpgsql;
