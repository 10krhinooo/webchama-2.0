package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.WelfareWithdrawal;

import java.util.List;

@ApplicationScoped
public class WelfareWithdrawalRepository implements PanacheRepository<WelfareWithdrawal> {

    public List<WelfareWithdrawal> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }
}
