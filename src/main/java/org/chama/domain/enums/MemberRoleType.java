package org.chama.domain.enums;

/**
 * A member's role within one specific chama. Deliberately not the same thing
 * as a Keycloak realm role: realm roles are global to a user, but the same
 * person can be chairperson of one chama and a plain member of another, so
 * the per-chama role must live in this table, not in the JWT.
 */
public enum MemberRoleType {
    CHAIRPERSON,
    TREASURER,
    SECRETARY,
    MEMBER
}
