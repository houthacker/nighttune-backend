-- v0.3.0: remove roundedRecommendation from ISF and CR job results.
UPDATE `job_results` SET `recommendations` = (
    SELECT json_replace(`recommendations`, fullkey, json_remove(value, '$.roundedRecommendation')) 
    FROM `job_results`, json_each(`job_results`.`recommendations`, '$.recommendations') 
    WHERE json_extract(value, '$.type') = 'ISF');

UPDATE `job_results` SET `recommendations` = (
    SELECT json_replace(`recommendations`, fullkey, json_remove(value, '$.roundedRecommendation')) 
    FROM `job_results`, json_each(`job_results`.`recommendations`, '$.recommendations') 
    WHERE json_extract(value, '$.type') = 'CR');