package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Chama;

@ApplicationScoped
public class ChamaRepository implements PanacheRepository<Chama> {
}
