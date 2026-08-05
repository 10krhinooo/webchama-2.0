package org.chama.dto;

import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Member;

import java.time.LocalDate;
import java.util.List;

public record MemberDto(
    Long id,
    Long chamaId,
    String fullName,
    String phone,
    String nationalId,
    String nextOfKin,
    LocalDate joinDate,
    MemberStatus status,
    List<MemberRoleType> roles,
    boolean autoPayEnabled) {

    public static MemberDto from(Member member, List<MemberRoleType> roles) {
        return new MemberDto(
            member.id,
            member.chama.id,
            member.fullName,
            member.phone,
            member.nationalId,
            member.nextOfKin,
            member.joinDate,
            member.status,
            roles,
            member.autoPayEnabled);
    }
}
