package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.WelfareFund;

import java.util.Optional;

@ApplicationScoped
public class WelfareFundRepository implements PanacheRepository<WelfareFund> {

    public Optional<WelfareFund> findByChama(Long chamaId) {
        return find("chama.id", chamaId).firstResultOptional();
    }
}
