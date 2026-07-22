package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.dto.CreateMemberDto;
import org.chama.dto.UpdateMemberDto;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.service.notification.MemberInvitationEmailService;

import java.util.List;
import java.util.Map;

@ApplicationScoped
public class MemberService {

    /**
     * {@code temporaryPassword} is null when the invited email already had a
     * Keycloak account (reused rather than recreated), and set only when a
     * brand-new account was just provisioned.
     */
    public record MemberProvisioningResult(Member member, String temporaryPassword) {
    }

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    KeycloakAdminService keycloakAdminService;

    @Inject
    MemberInvitationEmailService memberInvitationEmailService;

    public List<Member> listForChama(Long chamaId) {
        return memberRepository.findByChama(chamaId);
    }

    public Member get(Long chamaId, Long memberId) {
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return member;
    }

    public List<org.chama.domain.enums.MemberRoleType> rolesOf(Long memberId) {
        return memberRoleRepository.findRoleTypesForMember(memberId);
    }

    @Transactional
    public MemberProvisioningResult create(Long chamaId, CreateMemberDto dto) {
        String keycloakUserId;
        String temporaryPassword = null;
        try {
            String existing = keycloakAdminService.findUserByEmail(dto.email());
            if (existing != null) {
                keycloakUserId = existing;
            } else {
                temporaryPassword = keycloakAdminService.generateTempPassword();
                keycloakUserId = keycloakAdminService.createUser(dto.email(), dto.fullName(), temporaryPassword);
            }
        } catch (Exception e) {
            throw new WebApplicationException(e, Response.status(502)
                .entity(Map.of("userMessage", "Could not create the member's account right now. Try again shortly."))
                .build());
        }

        Member member = new Member();
        member.chama = chamaService.get(chamaId);
        member.keycloakUserId = keycloakUserId;
        member.fullName = dto.fullName();
        member.phone = dto.phone();
        member.nationalId = dto.nationalId();
        member.nextOfKin = dto.nextOfKin();
        memberRepository.persist(member);

        for (var roleType : dto.roles()) {
            MemberRole role = new MemberRole();
            role.member = member;
            role.role = roleType;
            role.persist();
        }

        if (temporaryPassword != null) {
            memberInvitationEmailService.sendCredentials(dto.email(), dto.fullName(), temporaryPassword);
        }
        return new MemberProvisioningResult(member, temporaryPassword);
    }

    @Transactional
    public Member update(Long chamaId, Long memberId, UpdateMemberDto dto) {
        Member member = get(chamaId, memberId);
        member.fullName = dto.fullName();
        member.phone = dto.phone();
        member.nationalId = dto.nationalId();
        member.nextOfKin = dto.nextOfKin();

        memberRoleRepository.delete("member.id", memberId);
        for (var roleType : dto.roles()) {
            MemberRole role = new MemberRole();
            role.member = member;
            role.role = roleType;
            role.persist();
        }
        return member;
    }

    @Transactional
    public Member updateStatus(Long chamaId, Long memberId, org.chama.domain.enums.MemberStatus status) {
        Member member = get(chamaId, memberId);
        member.status = status;
        return member;
    }

    @Transactional
    public void delete(Long chamaId, Long memberId) {
        Member member = get(chamaId, memberId);
        memberRoleRepository.delete("member.id", memberId);
        memberRepository.delete(member);
    }
}
