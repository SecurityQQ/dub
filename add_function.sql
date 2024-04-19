CREATE OR REPLACE FUNCTION increment_clicks_domain(domain_id text) RETURNS void AS $$
BEGIN
  UPDATE "Domain"
  SET clicks = clicks + 1
  WHERE id = domain_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_clicks_link(link_id text) RETURNS void AS $$
BEGIN
  UPDATE "Link"
  SET clicks = clicks + 1
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql;
