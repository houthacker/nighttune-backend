
CREATE TABLE IF NOT EXISTS `job_queue` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `job_uuid` TEXT NOT NULL,
    `ns_url` TEXT NOT NULL,
    `create_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now', 'utc')),
    `state` TEXT CHECK(`state` IN ('submitted', 'processing', 'error')) NOT NULL DEFAULT 'submitted',
    `parameters` JSONB NULL,
    CONSTRAINT `unique_job_uuid_state` UNIQUE (`job_uuid`, `state`) ON CONFLICT ABORT
);

CREATE TABLE IF NOT EXISTS `job_errors` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `job_uuid` INTEGER NOT NULL UNIQUE ON CONFLICT REPLACE,
    `insert_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    `reason_code` TEXT NOT NULL
);

-- INSERT: Allow duplicates per `ns_url` for `state` = 'error', deny others.
CREATE TRIGGER IF NOT EXISTS `insert_job_queue_state` BEFORE INSERT ON `job_queue`
BEGIN
    SELECT CASE 
    WHEN NEW.`state` IN ('submitted', 'processing')
        AND (
            SELECT COUNT(*) 
            FROM `job_queue` 
            WHERE `ns_url` = NEW.`ns_url`
            AND `state` IN ('submitted', 'processing')
        ) > 0
    THEN
        RAISE(ABORT, 'Job already queued')
    END;
END;

-- UPDATE: Allow duplicates per `ns_url` for `state` = 'error', deny others.
CREATE TRIGGER IF NOT EXISTS `update_job_queue_state` BEFORE INSERT ON `job_queue`
BEGIN
    SELECT CASE 
    WHEN NEW.`state` IN ('submitted', 'processing')
        AND (
            SELECT COUNT(*) 
            FROM `job_queue` 
            WHERE `ns_url` = NEW.`ns_url`
            AND `state` IN ('submitted', 'processing')
        ) > 0
    THEN
        RAISE(ABORT, 'Job already queued')
    END;
END;

CREATE TABLE IF NOT EXISTS `recommendations` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `job_uuid` TEXT NOT NULL,
    `ns_url` TEXT NOT NULL,
    `create_ts` INTEGER NOT NULL,
    `finish_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now', 'utc')),
    `parameters` JSONB NOT NULL,
    `recommendation` JSONB NOT NULL,
    CONSTRAINT `unique_job_uuid_ns_url` UNIQUE (`job_uuid`, `ns_url`) ON CONFLICT ABORT
);
