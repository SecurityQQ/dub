CREATE OR REPLACE FUNCTION increment_clicks_domain(domain_id text) RETURNS void AS $$
BEGIN
  UPDATE "Domain"
  SET clicks = clicks + 1,
    "lastClicked" = now()
  WHERE id = domain_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_clicks_link(link_id text) RETURNS void AS $$
BEGIN
  UPDATE "Link"
  SET clicks = clicks + 1,
      "lastClicked" = now()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION increment_project_usage_link(link_id text) RETURNS void AS $$
BEGIN
  UPDATE "Project"
  SET usage = usage + 1
  FROM "Link"
  WHERE "Project".id = "Link"."projectId" AND "Link".id = "link_id";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_project_usage_domain(domain_id text) RETURNS void AS $$
BEGIN
  UPDATE "Project"
  SET usage = usage + 1
  FROM "Domain"
  WHERE "Project".id = "Domain"."projectId" AND "Domain"."id" = "domain_id";
END;
$$ LANGUAGE plpgsql;