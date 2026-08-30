package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.ChamaReminderSettings;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ChamaReminderSettingsRepository implements PanacheRepository<ChamaReminderSettings> {

    public Optional<ChamaReminderSettings> findByChama(Long chamaId) {
        return find("chama.id", chamaId).firstResultOptional();
    }

    /**
     * Chamas that want reminders sent in this hour of the Nairobi day. The chama is joined in
     * because the sweep reads its name and currency for every message it builds.
     */
    public List<ChamaReminderSettings> findEnabledForHour(int nairobiHour) {
        return find("select s from ChamaReminderSettings s join fetch s.chama"
            + " where s.enabled = true and s.sendHour = ?1", nairobiHour).list();
    }
}
