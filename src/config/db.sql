
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `uuid` TEXT NOT NULL UNIQUE ON CONFLICT ABORT,
    `state` TEXT CHECK(`state` IN ('submitted', 'processing', 'error', 'success')) NOT NULL DEFAULT 'submitted',
    `submit_ts` INTEGER NOT NULL DEFAULT (strftime('%s', 'now', 'utc')),
    `done_ts` INTEGER NULL,
    `ns_url` TEXT NOT NULL,
    `parameters` TEXT NOT NULL
);

-- INSERT: Allow duplicates per `ns_url` for `state` in ('error', 'success'), deny others.
CREATE TRIGGER IF NOT EXISTS `insert_jobs_state` BEFORE INSERT ON `jobs`
BEGIN
    SELECT CASE 
    WHEN NEW.`state` IN ('submitted', 'processing')
        AND (
            SELECT COUNT(*) 
            FROM `jobs` 
            WHERE `ns_url` = NEW.`ns_url`
            AND `state` IN ('submitted', 'processing')
        ) > 0
    THEN
        RAISE(ABORT, 'Job already queued')
    END;
END;

-- UPDATE: Allow duplicates per `ns_url` for `state` in ('error', 'success'), deny others.
CREATE TRIGGER IF NOT EXISTS `update_jobs_state` BEFORE INSERT ON `jobs`
BEGIN
    SELECT CASE 
    WHEN NEW.`state` IN ('submitted', 'processing')
        AND (
            SELECT COUNT(*) 
            FROM `jobs` 
            WHERE `ns_url` = NEW.`ns_url`
            AND `state` IN ('submitted', 'processing')
        ) > 0
    THEN
        RAISE(ABORT, 'Job already queued')
    END;
END;

CREATE TABLE IF NOT EXISTS `job_errors` (
    `job_id` INTEGER NOT NULL,
    `error_code` TEXT NOT NULL,
    FOREIGN KEY (`job_id`) 
        REFERENCES `jobs`(`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `job_results` (
    `job_id` INTEGER NOT NULL,
    `recommendations` TEXT NOT NULL,
    FOREIGN KEY (`job_id`) 
        REFERENCES `jobs`(`id`) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
