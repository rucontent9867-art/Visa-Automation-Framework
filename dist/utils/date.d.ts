/**
 * Date Utility
 *
 * Stateless helper methods.
 * Safe for parallel Playwright execution.
 */
export interface DateParts {
    day: string;
    month: string;
    year: string;
}
/**
 * Returns a date after N months from today.
 */
export declare function getFutureDate(monthsAhead?: number): DateParts;
/**
 * Arrival Date
 * Default = 9 months from today.
 */
export declare function getArrivalDate(): DateParts;
/**
 * Departure Date
 * Default = 30 days after arrival.
 */
export declare function getDepartureDate(gapDays?: number, arrivalMonths?: number): DateParts;
/**
 * Passport Expiry
 *
 * Must be beyond 9 months.
 *
 * Default = 5 years after today.
 */
export declare function getPassportExpiryDate(): DateParts;
/**
 * Passport Issue Date
 *
 * Default = 6 months before today.
 */
export declare function getPassportIssueDate(): DateParts;
/**
 * Date of Birth
 *
 * Default = 25 years old.
 * (Always >=18 years)
 */
export declare function getDateOfBirth(age?: number): DateParts;
//# sourceMappingURL=date.d.ts.map