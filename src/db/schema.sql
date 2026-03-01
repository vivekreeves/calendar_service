-- schema.sql
-- Defines region and country tables linked via country_code.
CREATE TABLE IF NOT EXISTS region (
    country_code VARCHAR(5) PRIMARY KEY,
    region_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS country (
    id BIGSERIAL PRIMARY KEY,
    country_code VARCHAR(5) NOT NULL REFERENCES region(country_code) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(150) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_code, holiday_date)
);
