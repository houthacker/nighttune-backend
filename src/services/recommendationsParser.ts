import { open } from 'node:fs/promises'
import { parse } from 'date-fns'

import type { PathLike } from 'node:fs'
import { JobId } from '../models/job.js'


const ISF_LINE_START = 'ISF'
const CR_LINE_START = 'Carb Ratio'

/**
 * Checks whether the given string is numeric.
 * @param str The string to test.
 * @returns `true` if the string is numberic, `false` otherwise.
 */
function is_numeric(str: string): boolean {
    return !isNaN(Number(str));
}

export enum RecommendationType {
    ISF = 'ISF',
    CR = 'CR',
    BASAL = 'BASAL'
}

/**
 * A data class to store options used when executing an autotune job.
 */
export class AutotuneOptions {

    public readonly jobId: JobId

    public readonly nsHost: string

    public readonly dateFrom: string

    public readonly dateTo: string

    public readonly uam: boolean

    public readonly autotuneVersion: string

    public readonly timeZone: string

    constructor(jobId: JobId, nsHost: string, dateFrom: string, dateTo: string, uam: boolean, autotuneVersion: string,
        timeZone: string
    ) {
        this.jobId = jobId
        this.nsHost = nsHost
        this.dateFrom = dateFrom
        this.dateTo = dateTo
        this.uam = uam
        this.autotuneVersion = autotuneVersion
        this.timeZone = timeZone
    }

}

/**
 * A `Recommendation` represents a single line from an autotune  recommendations log file.
 */
export class Recommendation {

    public readonly type: RecommendationType

    public readonly currentValue: number

    public readonly recommendedValue: number

    public readonly roundedRecommendation: number

    /**
     * Create a new `Recommendation`.
     * @param type The type of this recommendation.
     * @param current The current profile value.
     * @param recommended The recommended profile value.
     */
    constructor(type: RecommendationType, current: number, recommended: number) {
        this.type = type;
        this.currentValue = current;
        this.recommendedValue = recommended;
        this.roundedRecommendation = parseFloat((Math.ceil(recommended * 20 - 0.5) / 20).toFixed(2));
    }

    /**
     * Creates a new `Recommendation` or a subtype based on the given line.
     * @param line A line from an autotune recommendations log file.
     * @returns The parsed `Recommendation`, or `undefined` if the line does not contain a recommendation.
     */
    static create_from_line(line: string): Recommendation | undefined {
        let ln = line.trim()

        // Columns are: [parameter, pump, autotune, days_missing]
        let columns = ln.split('|')

        if (ln.startsWith(ISF_LINE_START)) {
            return new Recommendation(
                RecommendationType.ISF, 
                parseFloat(columns[1].trim()), 
                parseFloat(columns[2].trim())
            )
        } else if (ln.startsWith(CR_LINE_START)) {
            return new Recommendation(
                RecommendationType.CR, 
                parseFloat(columns[1].trim()), 
                parseFloat(columns[2].trim())
            )
        } else if (is_numeric(ln.charAt(0))) {
            let hour_string = columns[0].trim()
            
            // half hours of basal recommendation have no values, so bail out and ignore those.
            for (const idx of [1, 2, 3]) {
                if (columns[idx].trim().length == 0) {
                    return undefined
                }
            }

            // let when = timeParse('%H:%M')(hour_string);
            const when = parse(hour_string, 'HH:mm', new Date())
            return new BasalRecommendation(
                when, 
                parseFloat(columns[1].trim()), 
                parseFloat(columns[2].trim()), 
                parseInt(columns[3])
            )
        }

        return undefined
    }
}

/**
 * A recommendation for basal amount at a specified time of day.
 */
export class BasalRecommendation extends Recommendation {

    public readonly when: Date

    public readonly daysMissing: number

    /**
     * Create a new `Recommendation`.
     * @param when The time of day of this recommendation, parsed from the format `%H:%M`.
     * @param current The current profile value.
     * @param recommended The recommended profile value.
     * @param daysMissing The amount of days without data.
     */
    constructor(when: Date, current: number, recommended: number, daysMissing: number) {
        super(RecommendationType.BASAL, current, recommended);

        this.when = when;
        this.daysMissing = daysMissing;
    }
}

/**
 * 
 */
export class AutotuneResult {

    public readonly options: AutotuneOptions

    private readonly recommendations: Recommendation[]

    constructor(recommendations: Recommendation[], options: AutotuneOptions) {
        this.options = options
        this.recommendations = recommendations;
    }

    /**
     * Creates a new `AutotuneResult` based on an autotune recommendations log file.
     * @param path The path to the recommendations log file. May be absolute or relative.
     * @param options The autotune parameters. Defaults to `{}`.
     * @returns The parsed autotune result.
     */
    static async parseLog(path: PathLike, options: AutotuneOptions): Promise<AutotuneResult> {
        const file = await open(path);

        let recommendations = [];
        for await (const line of file.readLines()) {
            let r = Recommendation.create_from_line(line);
            if (r instanceof Recommendation) {
                recommendations.push(r);
            }
        }

        return new AutotuneResult(recommendations, options);
    }

    /**
     * Finds the Insuline Sensivitiy Factor recommendation.
     * @returns The ISF recommendation, or `{}` if no such recommendation exists.
     */
    find_isf(): Recommendation {
        let filtered = this.recommendations.filter(r => r.type == RecommendationType.ISF);
        return filtered[0] || {};
    }

    /**
     * Finds the Carb Ratio recommendation.
     * @returns The CR recommendation, or `{}` if not such recommendation exists.
     */
    find_cr(): Recommendation {
        let filtered = this.recommendations.filter(r => r.type == RecommendationType.CR);
        return filtered[0] || {};
    }

    /**
     * 
     * Finds all basal recommendations.
     * @return The basal recommendations.
     */
    find_basal(): BasalRecommendation[] {
        return this.recommendations.filter(r => r.type == RecommendationType.BASAL) as BasalRecommendation[];
    }
}