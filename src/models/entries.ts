import { type } from 'arktype'

export const RetainedDataRequest = type({

    /**
     * The minimum amount of retained days of data.
     */
    days: "1 <= number.integer <= 30",

    /**
     * The IANA time zone name of the NS profile.
     */
    timezone: type("string").narrow((val, ctx) => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: val })
        } catch (error: any) {
            return ctx.mustBe("a valid IANA timezone name")
        }
        return true
    })
})