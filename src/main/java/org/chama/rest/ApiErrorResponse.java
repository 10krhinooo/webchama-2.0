package org.chama.rest;

/**
 * The body every deliberate error answer carries.
 *
 * <p>Field names are the ones the frontend already reads in api/client.ts, so the message a service
 * wrote reaches the banner the user sees rather than being replaced by "Request failed with status
 * code 400".
 */
public record ApiErrorResponse(int status, String error, String message) {
}
