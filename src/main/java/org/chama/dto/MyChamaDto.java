package org.chama.dto;

import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Chama;

import java.math.BigDecimal;
import java.util.List;

/** One row for the "My Chamas" picker: a chama plus the caller's own role(s) in it. */
public record MyChamaDto(
    Long id,
    String name,
    String description,
    ChamaType type,
    String currency,
    ContributionFrequency contributionFrequency,
    BigDecimal contributionAmount,
    List<MemberRoleType> roles,
    boolean superAdmin) {

    public static MyChamaDto from(Chama chama, List<MemberRoleType> roles, boolean superAdmin) {
        return new MyChamaDto(
            chama.id,
            chama.name,
            chama.description,
            chama.type,
            chama.currency,
            chama.contributionFrequency,
            chama.contributionAmount,
            roles,
            superAdmin);
    }
}
