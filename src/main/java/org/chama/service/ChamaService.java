package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.dto.CreateChamaDto;
import org.chama.dto.UpdateChamaDto;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.security.CurrentUser;

import java.util.List;

@ApplicationScoped
public class ChamaService {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ContributionRepository contributionRepository;

    public List<Chama> listForUser(CurrentUser user) {
        if (user.isSuperAdmin()) {
            return chamaRepository.listAll();
        }
        List<Long> chamaIds = memberRepository.findByKeycloakUserId(user.getKeycloakUserId())
            .stream()
            .map(m -> m.chama.id)
            .toList();
        return chamaIds.isEmpty() ? List.of() : chamaRepository.findByIds(chamaIds);
    }

    public Chama get(Long id) {
        return chamaRepository.findByIdOptional(id).orElseThrow(NotFoundException::new);
    }

    @Transactional
    public Chama create(CreateChamaDto dto, CurrentUser creator) {
        Chama chama = new Chama();
        chama.name = dto.name();
        chama.description = dto.description();
        chama.type = dto.type();
        chama.currency = dto.currency() != null ? dto.currency() : "KES";
        chama.contributionFrequency = dto.contributionFrequency();
        chama.contributionAmount = dto.contributionAmount();
        chama.meetingDay = dto.meetingDay();
        chamaRepository.persist(chama);

        Member founder = new Member();
        founder.chama = chama;
        founder.keycloakUserId = creator.getKeycloakUserId();
        founder.fullName = dto.creatorFullName();
        founder.phone = dto.creatorPhone();
        memberRepository.persist(founder);

        MemberRole chairRole = new MemberRole();
        chairRole.member = founder;
        chairRole.role = MemberRoleType.CHAIRPERSON;
        chairRole.persist();

        return chama;
    }

    @Transactional
    public Chama update(Long id, UpdateChamaDto dto) {
        Chama chama = get(id);
        chama.name = dto.name();
        chama.description = dto.description();
        chama.type = dto.type();
        if (dto.currency() != null) {
            chama.currency = dto.currency();
        }
        chama.contributionFrequency = dto.contributionFrequency();
        chama.contributionAmount = dto.contributionAmount();
        chama.meetingDay = dto.meetingDay();
        return chama;
    }

    @Transactional
    public void delete(Long id) {
        if (!chamaRepository.findByIdOptional(id).isPresent()) {
            throw new NotFoundException();
        }
        // Order matters: member_role and contribution both reference member,
        // which references chama, so they must go first. Bulk delete-by-query
        // throughout (never loading the child entities into the persistence
        // context) avoids stale-entity flush ordering issues with the final
        // chamaRepository.deleteById(id) below.
        contributionRepository.delete("chama.id", id);
        memberRoleRepository.deleteByChamaId(id);
        memberRepository.delete("chama.id", id);
        chamaRepository.deleteById(id);
    }
}
