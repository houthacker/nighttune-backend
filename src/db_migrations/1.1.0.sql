-- v1.1.0 Add backend version to jobs table and set initial value.
-- This enables easier data migrations.
ALTER TABLE `jobs` ADD COLUMN `backend_version` TEXT NOT NULL DEFAULT 'unknown';
UPDATE `jobs` SET `backend_version` = '1.1.0';