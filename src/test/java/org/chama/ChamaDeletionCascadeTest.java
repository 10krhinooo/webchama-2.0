package org.chama;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The guard that keeps chama deletion from drifting again.
 *
 * <p>Deleting a chama used to be an ordered list of bulk deletes in {@code ChamaService}, mirrored
 * by a second list in {@code TestDataCleaner}. Every new per-chama table had to be added to both,
 * and the review called it the most fragile invariant in the backend for good reason: by the time
 * it was replaced, six tables had gone missing from it, so deleting a chama that had ever recorded
 * an approval, produced a receipt, opened a resolution or run a welfare fund failed on a foreign
 * key. Nobody noticed, because deleting a chama is rare and the tests only ever deleted empty ones.
 *
 * <p>V49 moved the work to the database. This is what stops the same drift happening to the new
 * arrangement: it reads the live constraints and fails when a table can be reached from a chama by
 * a foreign key that does not cascade. Adding a per-chama table without a cascade now breaks the
 * build with the constraint's name in the message, rather than breaking a chairperson's delete
 * months later.
 *
 * <p>Deliberately asks the database rather than reading the migrations. The migrations are what
 * someone intended; this is what is actually there.
 */
@QuarkusTest
class ChamaDeletionCascadeTest {

    @Inject
    DataSource dataSource;

    /**
     * Every foreign key pointing at one of the given tables, with the rule that governs a delete.
     */
    private static final String CONSTRAINTS_REFERENCING = """
        SELECT tc.table_name, tc.constraint_name, ccu.table_name AS parent, rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ANY (?)
        """;

    /**
     * Walks outward from chama and collects every constraint a delete would have to satisfy.
     *
     * <p>A table that carries its own chama_id is reached from the chama directly and only its own
     * chama constraint has to cascade; its other foreign keys are checked at the end of the
     * statement, by which point the cascade has removed both rows. A table without a chama_id is
     * only reachable through its parent, so that constraint has to cascade too. The distinction is
     * why this walks the graph instead of asserting on a fixed list.
     */
    @Test
    void everyTableReachableFromAChamaIsRemovedWithIt() throws Exception {
        List<String> offenders = new ArrayList<>();

        try (Connection connection = dataSource.getConnection()) {
            List<String> frontier = List.of("chama");
            List<String> visited = new ArrayList<>(frontier);

            while (!frontier.isEmpty()) {
                List<String> next = new ArrayList<>();
                try (PreparedStatement statement = connection.prepareStatement(CONSTRAINTS_REFERENCING)) {
                    statement.setArray(1, connection.createArrayOf("text", frontier.toArray()));
                    try (ResultSet rows = statement.executeQuery()) {
                        while (rows.next()) {
                            String child = rows.getString("table_name");
                            String constraint = rows.getString("constraint_name");
                            String parent = rows.getString("parent");
                            String rule = rows.getString("delete_rule");

                            boolean ownsChamaId = hasChamaId(connection, child);
                            // Reached directly from the chama, or only through this parent. Either
                            // way, this is a constraint the delete has to get past.
                            boolean mustCascade = "chama".equals(parent) || !ownsChamaId;

                            if (mustCascade && !"CASCADE".equals(rule)) {
                                offenders.add("%s.%s -> %s is %s, expected CASCADE"
                                    .formatted(child, constraint, parent, rule));
                            }
                            if (!visited.contains(child)) {
                                visited.add(child);
                                next.add(child);
                            }
                        }
                    }
                }
                frontier = next;
            }
        }

        assertTrue(offenders.isEmpty(),
            "A chama cannot be deleted while these constraints stand. Add ON DELETE CASCADE in a "
                + "migration, the same way V49 did, rather than adding another bulk delete to "
                + "ChamaService:\n  " + String.join("\n  ", offenders));
    }

    private static boolean hasChamaId(Connection connection, String table) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = 'chama_id'")) {
            statement.setString(1, table);
            try (ResultSet rows = statement.executeQuery()) {
                return rows.next();
            }
        }
    }
}
