package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.MemberRole;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@ApplicationScoped
public class MemberRoleRepository implements PanacheRepository<MemberRole> {

    public List<MemberRoleType> findRoleTypesForMember(Long memberId) {
        return find("member.id", memberId).stream().map(r -> r.role).toList();
    }

    public List<MemberRoleType> findRoleTypesForKeycloakUserInChama(String keycloakUserId, Long chamaId) {
        return find(
                "member.keycloakUserId = ?1 and member.chama.id = ?2",
                keycloakUserId, chamaId)
            .stream()
            .map(r -> r.role)
            .toList();
    }

    /** One query for the My Chamas picker, rather than N+1 per-chama role lookups. */
    public Map<Long, List<MemberRoleType>> findRoleTypesForKeycloakUserGroupedByChama(String keycloakUserId, List<Long> chamaIds) {
        return find("member.keycloakUserId = ?1 and member.chama.id in ?2", keycloakUserId, chamaIds)
            .list()
            .stream()
            .collect(Collectors.groupingBy(r -> r.member.chama.id, Collectors.mapping(r -> r.role, Collectors.toList())));
    }

    public long deleteByChamaId(Long chamaId) {
        return delete("member.chama.id", chamaId);
    }
}
