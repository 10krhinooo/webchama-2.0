package org.chama.dto;

/**
 * Response for creating a member. {@code temporaryPassword} is only present
 * when a brand-new Keycloak account was provisioned, it is null when the
 * invited email already had an account (e.g. the person is already a member
 * of another chama) since no new credentials were generated. Surfaced once,
 * here, because there is no email/SMS delivery yet (see MemberService),
 * that lands with the notifications phase.
 */
public record MemberInvitationDto(MemberDto member, String temporaryPassword) {
}
