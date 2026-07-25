package org.chama.security;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Member;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * The tenant-scoping gate every chama-scoped resource method must call
 * before touching that chama's data. A caller's role is never trusted from
 * the JWT for chama-scoped actions (see CurrentUser), it is always resolved
 * fresh from the member_role table for the specific chama in the request
 * path. SUPER_ADMIN gets no bypass here, per MIGRATION_PLAN.md section 5
 * ("no operational access to any single chama's financial data by
 * default"): a platform owner only reaches a chama's members/contributions
 * if they hold an actual member row in it, exactly like anyone else. Their
 * cross-chama view is the separate, aggregated PlatformOverviewResource.
 */
@ApplicationScoped
public class TenantAccessService {

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    /**
     * Throws 403 unless the caller has a member row in this chama (any role).
     */
    public void requireMembership(CurrentUser user, Long chamaId) {
        if (user.getKeycloakUserId() == null
                || memberRepository.findByChamaAndKeycloakUserId(chamaId, user.getKeycloakUserId()).isEmpty()) {
            throw new ForbiddenException("Not a member of this chama");
        }
    }

    /**
     * Throws 403 unless the caller holds at least one of the given roles
     * within this specific chama.
     */
    public void requireRole(CurrentUser user, Long chamaId, MemberRoleType... allowedRoles) {
        if (user.getKeycloakUserId() == null) {
            throw new ForbiddenException("Not authenticated");
        }
        List<MemberRoleType> roles = memberRoleRepository.findRoleTypesForKeycloakUserInChama(user.getKeycloakUserId(), chamaId);
        boolean hasRole = Arrays.stream(allowedRoles).anyMatch(roles::contains);
        if (!hasRole) {
            throw new ForbiddenException("Insufficient role for this chama");
        }
    }

    /**
     * The caller's own member row in this chama, if any. Used by "my own
     * data" endpoints (e.g. a member's own contribution history) where the
     * caller only ever sees rows tied to their own membership.
     */
    public Optional<Member> currentMember(CurrentUser user, Long chamaId) {
        if (user.getKeycloakUserId() == null) {
            return Optional.empty();
        }
        return memberRepository.findByChamaAndKeycloakUserId(chamaId, user.getKeycloakUserId());
    }
}
