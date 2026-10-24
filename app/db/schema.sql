CREATE TABLE IF NOT EXISTS admins (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username varchar(40) NOT NULL UNIQUE, password_hash text NOT NULL,
  auth_version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
CREATE TABLE IF NOT EXISTS vehicles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(32) NOT NULL UNIQUE, plate varchar(20) NOT NULL UNIQUE,
  name varchar(120) NOT NULL, type varchar(80) NOT NULL,
  odometer integer NOT NULL DEFAULT 0 CHECK (odometer >= 0),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  notes varchar(2000) NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS drivers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(32) NOT NULL UNIQUE, name varchar(120) NOT NULL,
  phone varchar(20) NOT NULL, license_no varchar(32) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes varchar(2000) NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trips (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(32) NOT NULL UNIQUE,
  vehicle_id integer NOT NULL REFERENCES vehicles(id), driver_id integer NOT NULL REFERENCES drivers(id),
  origin varchar(160) NOT NULL, destination varchar(160) NOT NULL,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  start_odometer integer CHECK (start_odometer >= 0), end_odometer integer CHECK (end_odometer >= start_odometer),
  notes varchar(2000) NOT NULL DEFAULT '', started_at timestamptz, finished_at timestamptz,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK ((status='in_progress') = (started_at IS NOT NULL AND finished_at IS NULL)),
  CHECK (status <> 'completed' OR (started_at IS NOT NULL AND finished_at IS NOT NULL AND end_odometer IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS maintenance (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(32) NOT NULL UNIQUE,
  vehicle_id integer NOT NULL REFERENCES vehicles(id), title varchar(160) NOT NULL,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  provider varchar(160) NOT NULL DEFAULT '', cost_vnd numeric(14,0) NOT NULL DEFAULT 0 CHECK (cost_vnd >= 0),
  odometer integer CHECK (odometer >= 0), result varchar(2000) NOT NULL DEFAULT '',
  started_at timestamptz, finished_at timestamptz,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK ((status='in_progress') = (started_at IS NOT NULL AND finished_at IS NULL)),
  CHECK (status <> 'completed' OR (started_at IS NOT NULL AND finished_at IS NOT NULL AND odometer IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS trips_vehicle_time_idx ON trips(vehicle_id,start_at,end_at) WHERE status IN ('planned','in_progress');
CREATE INDEX IF NOT EXISTS trips_driver_time_idx ON trips(driver_id,start_at,end_at) WHERE status IN ('planned','in_progress');
CREATE INDEX IF NOT EXISTS maintenance_vehicle_time_idx ON maintenance(vehicle_id,start_at,end_at) WHERE status IN ('planned','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS one_running_trip_vehicle ON trips(vehicle_id) WHERE status='in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS one_running_trip_driver ON trips(driver_id) WHERE status='in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS one_running_maintenance_vehicle ON maintenance(vehicle_id) WHERE status='in_progress';
CREATE TABLE IF NOT EXISTS seed_versions (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
