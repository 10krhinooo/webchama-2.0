package org.chama.domain.enums;

public enum DocumentType {
    CONTRIBUTION_RECEIPT("CR"),
    LOAN_STATEMENT("LS"),
    PAYOUT_RECEIPT("PR");

    private final String prefix;

    DocumentType(String prefix) {
        this.prefix = prefix;
    }

    /** Document-number prefix, e.g. "CR-2026-07-0001", used by the generation service (issue #42). */
    public String prefix() {
        return prefix;
    }
}
