-- v0.1.2: remove stored nightscout_access_token fields from `jobs` entries.
UPDATE `jobs` SET `parameters` = json_remove(`parameters`, '$.nightscout_access_token');