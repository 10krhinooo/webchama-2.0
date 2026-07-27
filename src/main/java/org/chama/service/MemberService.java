package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.dto.CreateMemberDto;
import org.chama.dto.JoinChamaDto;
import org.chama.dto.UpdateMemberDto;
import org.chama.repository.ChamaRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.security.CurrentUser;
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
    ChamaRepository chamaRepository;

    @Inject
    KeycloakAdminService keycloakAdminService;

    @Inject
    MemberInvitationEmailService memberInvitationEmailService;

    @Inject
    PayoutService payoutService;

    @Inject
    ActivityLogService activityLogService;

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
        activityLogService.log(member.chama, ActivityEventType.MEMBER_INVITED, member.fullName + " was invited to the chama");
        return new MemberProvisioningResult(member, temporaryPassword);
    }

    /**
     * Self-service counterpart to {@link #create}: the caller already has a Keycloak account (they
     * are authenticated), so no account provisioning is needed, just a new Member row in whichever
     * chama the redeemed code belongs to, always with the plain MEMBER role (issue #170). Unlike
     * {@code create}, there is no chairperson role gate, possessing the join code is the invitation.
     */
    @Transactional
    public Member joinViaCode(JoinChamaDto dto, CurrentUser user) {
        Chama chama = chamaRepository.findByJoinCode(dto.joinCode()).orElseThrow(NotFoundException::new);
        if (memberRepository.findByChamaAndKeycloakUserId(chama.id, user.getKeycloakUserId()).isPresent()) {
            throw new BadRequestException("You are already a member of this chama.");
        }

        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = user.getKeycloakUserId();
        member.fullName = dto.fullName();
        member.phone = dto.phone();
        member.nationalId = dto.nationalId();
        member.nextOfKin = dto.nextOfKin();
        memberRepository.persist(member);

        MemberRole role = new MemberRole();
        role.member = member;
        role.role = MemberRoleType.MEMBER;
        role.persist();

        activityLogService.log(chama, ActivityEventType.MEMBER_JOINED, member.fullName + " joined the chama");
        return member;
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
        if (status == org.chama.domain.enums.MemberStatus.EXITED) {
            payoutService.handleMemberExit(chamaId, memberId);
        }
        return member;
    }

    /**
     * Self-service opt-in/out of the auto-STK-push scheduler (issue #60). No role gate beyond
     * "this is my own member row", enforced by the resource layer resolving {@code memberId} via
     * {@code TenantAccessService.currentMember} rather than trusting a path parameter.
     */
    @Transactional
    public Member updateAutoPay(Long chamaId, Long memberId, boolean autoPayEnabled) {
        Member member = get(chamaId, memberId);
        member.autoPayEnabled = autoPayEnabled;
        return member;
    }

    @Transactional
    public void delete(Long chamaId, Long memberId) {
        Member member = get(chamaId, memberId);
        memberRoleRepository.delete("member.id", memberId);
        memberRepository.delete(member);
    }
}
