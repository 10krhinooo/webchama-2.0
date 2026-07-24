package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.model.ActivityLog;
import org.chama.domain.model.Chama;
import org.chama.repository.ActivityLogRepository;

@ApplicationScoped
public class ActivityLogService {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    Event<ActivityLog> activityLogEvent;

    @Transactional
    public ActivityLog log(Chama chama, ActivityEventType eventType, String description) {
        ActivityLog entry = new ActivityLog();
        entry.chama = chama;
        entry.eventType = eventType;
        entry.description = description;
        activityLogRepository.persist(entry);
        activityLogEvent.fire(entry);
        return entry;
    }
}
