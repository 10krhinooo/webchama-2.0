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
import org.chama.dto.UpdateChamaDto;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
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

import java.util.List;
import java.util.Map;

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

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

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

    /** For the My Chamas picker: each chama the caller belongs to, plus their role(s) in it. */
    public List<MyChamaDto> listMineWithRoles(CurrentUser user) {
        List<Chama> chamas = listForUser(user);
        if (chamas.isEmpty()) {
            return List.of();
        }
        if (user.isSuperAdmin()) {
            return chamas.stream().map(c -> MyChamaDto.from(c, List.of(), true)).toList();
        }
        List<Long> chamaIds = chamas.stream().map(c -> c.id).toList();
        Map<Long, List<MemberRoleType>> rolesByChama =
            memberRoleRepository.findRoleTypesForKeycloakUserGroupedByChama(user.getKeycloakUserId(), chamaIds);
        return chamas.stream()
            .map(c -> MyChamaDto.from(c, rolesByChama.getOrDefault(c.id, List.of()), false))
            .toList();
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
        chama.approvalThreshold = dto.approvalThreshold();
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
        loanRepository.delete("chama.id", id);
        payoutRepository.delete("chama.id", id);
        payoutScheduleRepository.delete("chama.id", id);
        penaltyRepository.delete("chama.id", id);
        meetingAttendanceRepository.delete("meeting.chama.id", id);
        meetingRepository.delete("chama.id", id);
        contributionRepository.delete("chama.id", id);
        memberRoleRepository.deleteByChamaId(id);
        memberRepository.delete("chama.id", id);
        chamaRepository.deleteById(id);
    }
}
