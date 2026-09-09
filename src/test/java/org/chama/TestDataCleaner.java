package org.chama;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.repository.ChamaRepository;

/**
 * Empties every table a test might have written to.
 *
 * <p>One line, because since V49 the database knows the shape of a chama. Deleting the chamas
 * cascades to everything belonging to them, including the tables this list used to forget:
 * resolution and resolution_vote were never in it, so a test that opened a resolution left rows
 * behind for whatever ran next.
 *
 * <p>It used to be an ordered sequence of twenty-two deletes mirroring the one in ChamaService,
 * and each new per-chama table had to be added to both. That is what made it worth replacing:
 * two hand-maintained copies of the same invariant, neither of which was complete.
 *
 * <p>Call it inside {@code QuarkusTransaction.requiringNew()} from a {@code @BeforeEach}.
 */
@ApplicationScoped
public class TestDataCleaner {

    @Inject
    ChamaRepository chamaRepository;

    public void deleteAll() {
        chamaRepository.deleteAll();
    }
}
