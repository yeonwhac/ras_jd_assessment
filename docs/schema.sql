-- RAS Site Safety Forms: PostgreSQL schema (Supabase)
-- Run this in the Supabase SQL editor. It mirrors the live database.
-- Photo files are not stored in the database: they live in a private Supabase Storage bucket,
-- and the `photos` table only keeps their path.

CREATE TABLE users (
  user_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role          varchar NOT NULL CHECK (role IN ('framer', 'admin')),
  first_name    varchar NOT NULL,
  last_name     varchar NOT NULL,
  email         varchar NOT NULL UNIQUE,        -- login name; keep it lower case (the login looks it up lower-cased)
  password_hash varchar NOT NULL,               -- bcrypt hash, never the password itself
  is_active     boolean NOT NULL DEFAULT true,  -- former workers are deactivated, not deleted
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  site_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_name varchar NOT NULL UNIQUE,
  address   varchar
);

-- Hazard types a framer can tick on the form (filled by `npm run seed`)
CREATE TABLE hazards (
  hazard_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hazard_type varchar NOT NULL UNIQUE
);

-- One submitted safety form
CREATE TABLE submissions (
  submission_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users (user_id),
  site_id       bigint NOT NULL REFERENCES sites (site_id),
  work_date     date NOT NULL,                  -- the day the form is for (chosen by the framer)
  status        varchar NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),

  -- Checklist answers: true = Yes, false = No
  ppe_hard_hat             boolean NOT NULL,
  ppe_vest                 boolean NOT NULL,
  ppe_boots                boolean NOT NULL,
  ppe_eye_protection       boolean NOT NULL,
  fall_protection_in_place boolean NOT NULL,
  ladders_inspected        boolean NOT NULL,
  scaffolding_inspected    boolean NOT NULL,
  tools_good_condition     boolean NOT NULL,
  cords_good_condition     boolean NOT NULL,

  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),  -- when the form was actually submitted

  UNIQUE (user_id, site_id, work_date)          -- one form per framer, site and day
);

-- Hazards ticked on a submission (many-to-many). No rows means no hazards were identified.
CREATE TABLE submissions_hazards (
  submission_id bigint NOT NULL REFERENCES submissions (submission_id),
  hazard_id     bigint NOT NULL REFERENCES hazards (hazard_id),
  PRIMARY KEY (submission_id, hazard_id)
);

CREATE TABLE photos (
  photo_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES submissions (submission_id),
  photo_name    varchar,                        -- original file name, for display
  storage_path  varchar NOT NULL,               -- location of the file inside the Storage bucket
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the admin list, the summary and the photo lookups
CREATE INDEX IF NOT EXISTS idx_submissions_site_date ON submissions (site_id, work_date);
CREATE INDEX IF NOT EXISTS idx_submissions_work_date ON submissions (work_date);
CREATE INDEX IF NOT EXISTS idx_photos_submission ON photos (submission_id);

-- Only the API reads and writes these tables, through its direct database connection.
-- Row Level Security without any policy blocks Supabase's public Data API from touching them.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
