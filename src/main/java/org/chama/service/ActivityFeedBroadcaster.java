package org.chama.service;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import org.chama.domain.model.ActivityLog;
import org.chama.dto.ActivityLogDto;

/**
 * Fans out newly persisted ActivityLog rows to any subscriber currently streaming that chama's
 * feed. Observes on AFTER_SUCCESS so a broadcast never precedes the row it describes actually
 * being committed.
 */
@ApplicationScoped
public class ActivityFeedBroadcaster {

    private final BroadcastProcessor<ActivityLogDto> processor = BroadcastProcessor.create();

    public void onActivityLog(@Observes(during = TransactionPhase.AFTER_SUCCESS) ActivityLog log) {
        processor.onNext(ActivityLogDto.from(log));
    }

    public Multi<ActivityLogDto> streamForChama(Long chamaId) {
        return processor.filter(dto -> dto.chamaId().equals(chamaId));
    }
}
