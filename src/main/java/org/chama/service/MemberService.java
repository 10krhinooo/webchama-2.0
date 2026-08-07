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
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.ResolutionVoteRepository;
import org.chama.repository.WelfareContributionRepository;
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

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    ResolutionVoteRepository resolutionVoteRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

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
     * Recovery path for an invite whose original email never arrived, or whose one-time temporary
     * password was lost before anyone wrote it down (issue P1-11): resets the member's Keycloak
     * password to a new random temporary one and re-sends the credential email. Returns the new
     * password too, same as {@link #create}, so a chairperson can share it directly if the email
     * still doesn't land.
     */
    @Transactional
    public String resendInvite(Long chamaId, Long memberId) {
        Member member = get(chamaId, memberId);
        String temporaryPassword = keycloakAdminService.generateTempPassword();
        String email;
        try {
            email = keycloakAdminService.getUserEmail(member.keycloakUserId);
            keycloakAdminService.resetPassword(member.keycloakUserId, temporaryPassword);
        } catch (Exception e) {
            throw new WebApplicationException(e, Response.status(502)
                .entity(Map.of("userMessage", "Could not reset this member's password right now. Try again shortly."))
                .build());
        }

        if (email != null) {
            memberInvitationEmailService.sendCredentials(email, member.fullName, temporaryPassword);
        }
        activityLogService.log(member.chama, ActivityEventType.MEMBER_INVITE_RESENT,
            member.fullName + "'s invite was resent");
        return temporaryPassword;
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

    /**
     * A hard delete only ever removes the member and role rows: any contribution, loan, payment,
     * penalty, payout, welfare, meeting/vote, approval, or document history is left in place by
     * rejecting the delete outright rather than either crashing on the first NOT NULL foreign key
     * it hits or silently cascading away financial/governance records (issue P0-6). Deleting a
     * member who has ever been financially or governance-active should go through
     * {@link #updateStatus} to {@code MemberStatus.EXITED} instead, which keeps their history.
     */
    @Transactional
    public void delete(Long chamaId, Long memberId) {
        Member member = get(chamaId, memberId);
        if (hasHistory(memberId)) {
            throw new BadRequestException(
                "This member has contribution, loan, payment, or other activity history and can't "
                    + "be deleted. Set their status to EXITED instead to preserve that history.");
        }
        memberRoleRepository.delete("member.id", memberId);
        memberRepository.delete(member);
    }

    private boolean hasHistory(Long memberId) {
        return contributionRepository.count("member.id", memberId) > 0
            || loanRepository.count("member.id = ?1 or approvedBy.id = ?1", memberId) > 0
            || paymentRepository.count("member.id", memberId) > 0
            || penaltyRepository.count("member.id = ?1 or decidedBy.id = ?1", memberId) > 0
            || payoutRepository.count("member.id", memberId) > 0
            || welfareContributionRepository.count("member.id", memberId) > 0
            || meetingAttendanceRepository.count("member.id", memberId) > 0
            || resolutionVoteRepository.count("member.id", memberId) > 0
            || approvalRepository.count(
                "member.id = ?1 or requestedBy.id = ?1 or firstApprover.id = ?1 or secondApprover.id = ?1",
                memberId) > 0
            || generatedDocumentRepository.count("member.id", memberId) > 0;
    }
}
