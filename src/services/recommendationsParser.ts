import { open } from 'node:fs/promises'
import { parse } from 'date-fns'
import { tz } from '@date-fns/tz'

import type { PathLike } from 'node:fs'
import { JobId } from '@models/job.js'


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

export function roundToNext(value: number, increment: number): number {
    const factor = 1 / increment
    return parseFloat((Math.ceil(value * factor - 0.5) / factor).toFixed(2))
}

export enum RecommendationType {
    ISF = 'ISF',
    CR = 'CR',
    BASAL = 'BASAL'
}

export enum PostProcessType {
    SMOOTH = 'SMOOTH'
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

    public readonly emailAddress: string | undefined

    public readonly basalIncrement: number

    public readonly basalSmoothing: string

    constructor(jobId: JobId, nsHost: string, dateFrom: string, dateTo: string, uam: boolean, autotuneVersion: string,
        timeZone: string, emailAddress: string | undefined = undefined, basalIncrement: number, basalSmoothing: string
    ) {
        this.jobId = jobId
        this.nsHost = nsHost
        this.dateFrom = dateFrom
        this.dateTo = dateTo
        this.uam = uam
        this.autotuneVersion = autotuneVersion
        this.timeZone = timeZone
        this.emailAddress = emailAddress
        this.basalIncrement = basalIncrement
        this.basalSmoothing = basalSmoothing
    }

}

/**
 * A `Recommendation` represents a single line from an autotune  recommendations log file.
 */
export class Recommendation {

    public readonly type: RecommendationType

    public readonly currentValue: number

    public readonly recommendedValue: number

    /**
     * Create a new `Recommendation`.
     * @param type The type of this recommendation.
     * @param current The current profile value.
     * @param recommended The recommended profile value.
     */
    constructor(type: RecommendationType, current: number, recommended: number) {
        this.type = type
        this.currentValue = current
        this.recommendedValue = recommended
    }

    /**
     * Creates a new `Recommendation` or a subtype based on the given line.
     * @param line A line from an autotune recommendations log file.
     * @param timezone The profile time zone.
     * @returns The parsed `Recommendation`, or `undefined` if the line does not contain a recommendation.
     */
    static create_from_line(line: string, timezone: string): Recommendation | undefined {
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

            const when = parse(hour_string, 'HH:mm', new Date(), { in: tz(timezone) })
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

    public readonly postProcessed: Map<PostProcessType, number>

    /**
     * Create a new `Recommendation`.
     * @param when The time of day of this recommendation, parsed from the format `%H:%M`.
     * @param current The current profile value.
     * @param recommended The recommended profile value.
     * @param daysMissing The amount of days without data.
     */
    constructor(when: Date, current: number, recommended: number, daysMissing: number) {
        super(RecommendationType.BASAL, current, recommended)

        this.when = when
        this.daysMissing = daysMissing
        this.postProcessed = new Map<PostProcessType, number>()
    }

    smoothedRecommendation(): number | undefined {
        return this.postProcessed.get(PostProcessType.SMOOTH)
    }
}

/**
 * 
 */
export class AutotuneResult {

    public readonly options: AutotuneOptions | undefined

    private readonly recommendations: Recommendation[]

    constructor(recommendations: Recommendation[], options?: AutotuneOptions) {
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
            let r = Recommendation.create_from_line(line, options.timeZone);
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