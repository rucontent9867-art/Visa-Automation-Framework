"use strict";
/**
 * Date Utility
 *
 * Stateless helper methods.
 * Safe for parallel Playwright execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFutureDate = getFutureDate;
exports.getArrivalDate = getArrivalDate;
exports.getDepartureDate = getDepartureDate;
exports.getPassportExpiryDate = getPassportExpiryDate;
exports.getPassportIssueDate = getPassportIssueDate;
exports.getDateOfBirth = getDateOfBirth;
/**
 * Safe helper to add/subtract months without day-of-month rollover bugs
 * (e.g., Jan 31 + 1 month -> Feb 28/29 instead of Mar 3).
 */
function addMonths(baseDate, months) {
    const result = new Date(baseDate.getTime());
    const targetDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const maxDaysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(targetDay, maxDaysInMonth));
    return result;
}
/**
 * Returns a date after N months from today.
 */
function getFutureDate(monthsAhead = 9) {
    const date = addMonths(new Date(), monthsAhead);
    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };
}
/**
 * Arrival Date
 * Default = 9 months from today.
 */
function getArrivalDate() {
    return getFutureDate(9);
}
/**
 * Departure Date
 * Default = 30 days after arrival.
 */
function getDepartureDate(gapDays = 30, arrivalMonths = 9) {
    const date = addMonths(new Date(), arrivalMonths);
    date.setDate(date.getDate() + gapDays);
    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };
}
/**
 * Passport Expiry
 *
 * Must be beyond 9 months.
 *
 * Default = 5 years after today.
 */
function getPassportExpiryDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5);
    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };
}
/**
 * Passport Issue Date
 *
 * Default = 6 months before today.
 */
function getPassportIssueDate() {
    const date = addMonths(new Date(), -6);
    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };
}
/**
 * Date of Birth
 *
 * Default = 25 years old.
 * (Always >=18 years)
 */
function getDateOfBirth(age = 25) {
    if (age < 18) {
        age = 18;
    }
    const date = new Date();
    date.setFullYear(date.getFullYear() - age);
    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };
}
//# sourceMappingURL=date.js.map