
CREATE TABLE IF NOT EXISTS `job_queue` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `job_uuid` TEXT NOT NULL,
    `ns_url` TEXT NOT NULL,
    `create_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    `state` TEXT CHECK(`state` IN ('submitted', 'processing')) NOT NULL DEFAULT 'submitted',
    `parameters` JSONB NULL,
    CONSTRAINT `unique_ns_url_state` UNIQUE (`ns_url`, `state`) ON CONFLICT ABORT
);

CREATE TABLE IF NOT EXISTS `recommendations` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `job_uuid` TEXT NOT NULL,
    `ns_url` TEXT NOT NULL,
    `create_ts` INTEGER NOT NULL,
    `finish_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    `parameters` JSONB NOT NULL,
    `recommendation` JSONB NOT NULL,
    CONSTRAINT `unique_job_uuid_ns_url` UNIQUE (`job_uuid`, `ns_url`) ON CONFLICT ABORT
);