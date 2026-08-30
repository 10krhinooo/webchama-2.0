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
import org.chama.dto.MyChamaDto;
import org.chama.dto.SavingsProgressDto;
import org.chama.dto.UpdateAutoPushSettingsDto;
import org.chama.dto.UpdateChamaDto;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.security.CurrentUser;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class ChamaService {

    // Excludes visually ambiguous characters (0/O, 1/I/L) since a join code is meant to be read
    // off a phone screen or WhatsApp message and retyped by hand.
    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int JOIN_CODE_LENGTH = 8;
    private static final SecureRandom JOIN_CODE_RANDOM = new SecureRandom();

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MeetingRepository meetingRepository;

    /**
     * SUPER_ADMIN gets no special treatment here, per MIGRATION_PLAN.md section 5 ("no operational
     * access to any single chama's financial data by default"), only chamas they actually hold a
     * member row in, same as any other user.
     */
    public List<Chama> listForUser(CurrentUser user) {
        List<Long> chamaIds = memberRepository.findByKeycloakUserId(user.getKeycloakUserId())
            .stream()
            .map(m -> m.chama.id)
            .toList();
        return chamaIds.isEmpty() ? List.of() : chamaRepository.findByIds(chamaIds);
    }

    /** For the My Chamas picker: each chama the caller belongs to, plus their role(s) in it. */
    public List<MyChamaDto> listMineWithRoles(CurrentUser user) {
        List<Chama> chamas = listForUser(user);
        if (chamas.isEmpty()) {
            return List.of();
        }
        List<Long> chamaIds = chamas.stream().map(c -> c.id).toList();
        Map<Long, List<MemberRoleType>> rolesByChama =
            memberRoleRepository.findRoleTypesForKeycloakUserGroupedByChama(user.getKeycloakUserId(), chamaIds);
        return chamas.stream()
            .map(c -> MyChamaDto.from(c, rolesByChama.getOrDefault(c.id, List.of()), user.isSuperAdmin()))
            .toList();
    }

    public SavingsProgressDto getSavingsProgress(Long id) {
        Chama chama = get(id);
        return new SavingsProgressDto(chama.savingsTarget, contributionRepository.sumAmountPaidForChama(id));
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
        chama.savingsTarget = dto.savingsTarget();
        chama.joinCode = generateUniqueJoinCode();
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
        chama.approvalThreshold = dto.approvalThreshold();
        chama.savingsTarget = dto.savingsTarget();
        return chama;
    }

    /** Chairperson-triggered rotation if a join code leaks or a chama wants to close signups. */
    @Transactional
    public Chama regenerateJoinCode(Long id) {
        Chama chama = get(id);
        chama.joinCode = generateUniqueJoinCode();
        return chama;
    }

    private String generateUniqueJoinCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(JOIN_CODE_LENGTH);
            for (int i = 0; i < JOIN_CODE_LENGTH; i++) {
                sb.append(JOIN_CODE_ALPHABET.charAt(JOIN_CODE_RANDOM.nextInt(JOIN_CODE_ALPHABET.length())));
            }
            code = sb.toString();
        } while (chamaRepository.joinCodeExists(code));
        return code;
    }

    @Transactional
    public Chama updateAutoPushSettings(Long id, UpdateAutoPushSettingsDto dto) {
        Chama chama = get(id);
        chama.autoPushEnabled = dto.autoPushEnabled();
        chama.autoPushRetryHours = dto.autoPushRetryHours();
        return chama;
    }

    @Transactional
    public void delete(Long id) {
        if (!chamaRepository.findByIdOptional(id).isPresent()) {
            throw new NotFoundException();
        }
        // Order matters: every table below references chama directly or transitively (member,
        // loan, meeting), so they must go first. Bulk delete-by-query throughout (never loading
        // the child entities into the persistence context) avoids stale-entity flush ordering
        // issues with the final chamaRepository.deleteById(id) below.
        paymentRepository.delete("chama.id", id);
        loanRepaymentRepository.delete("loan.chama.id", id);
        // Must run before loanRepository.delete below: loan_disbursement.loan_id is a NOT NULL FK
        // with no cascade (issue P1-7).
        loanDisbursementRepository.delete("loan.chama.id", id);
        loanRepository.delete("chama.id", id);
        payoutRepository.delete("chama.id", id);
        payoutScheduleRepository.delete("chama.id", id);
        penaltyRepository.delete("chama.id", id);
        meetingAttendanceRepository.delete("meeting.chama.id", id);
        meetingRepository.delete("chama.id", id);
        contributionRepository.delete("chama.id", id);
        memberRoleRepository.deleteByChamaId(id);
        memberRepository.delete("chama.id", id);
        // activity_log references chama with no cascade and was missing from this list, so
        // deleting a chama that had recorded any activity, which is every chama that has been
        // used, failed on the foreign key. notification is absent here deliberately: its own
        // foreign key cascades, see V41.
        activityLogRepository.delete("chama.id", id);
        chamaRepository.deleteById(id);
    }
}
