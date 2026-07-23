package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.PayoutScheduleEntryStatus;
import org.chama.domain.model.PayoutSchedule;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class PayoutScheduleRepository implements PanacheRepository<PayoutSchedule> {

    public List<PayoutSchedule> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by sequencePosition", chamaId);
    }

    public List<PayoutSchedule> findActiveByChamaOrderedByPosition(Long chamaId) {
        return list("chama.id = ?1 and status = ?2 order by sequencePosition", chamaId, PayoutScheduleEntryStatus.ACTIVE);
    }

    public Optional<PayoutSchedule> findByChamaAndMember(Long chamaId, Long memberId) {
        return find("chama.id = ?1 and member.id = ?2", chamaId, memberId).firstResultOptional();
    }

    public long deleteByChamaId(Long chamaId) {
        return delete("chama.id", chamaId);
    }
}
