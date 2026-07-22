package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.dto.CreateMemberDto;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;

import java.util.List;

@ApplicationScoped
public class MemberService {

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ChamaService chamaService;

    public List<Member> listForChama(Long chamaId) {
        return memberRepository.findByChama(chamaId);
    }

    public Member get(Long chamaId, Long memberId) {
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return member;
    }

    public List<org.chama.domain.enums.MemberRoleType> rolesOf(Long memberId) {
        return memberRoleRepository.findRoleTypesForMember(memberId);
    }

    @Transactional
    public Member create(Long chamaId, CreateMemberDto dto) {
        Member member = new Member();
        member.chama = chamaService.get(chamaId);
        member.keycloakUserId = dto.keycloakUserId();
        member.fullName = dto.fullName();
        member.phone = dto.phone();
        member.nationalId = dto.nationalId();
        member.nextOfKin = dto.nextOfKin();
        memberRepository.persist(member);

        for (var roleType : dto.roles()) {
            MemberRole role = new MemberRole();
            role.member = member;
            role.role = roleType;
            role.persist();
        }
        return member;
    }

    @Transactional
    public Member update(Long chamaId, Long memberId, CreateMemberDto dto) {
        Member member = get(chamaId, memberId);
        member.fullName = dto.fullName();
        member.phone = dto.phone();
        member.nationalId = dto.nationalId();
        member.nextOfKin = dto.nextOfKin();

        memberRoleRepository.delete("member.id", memberId);
        for (var roleType : dto.roles()) {
            MemberRole role = new MemberRole();
            role.member = member;
            role.role = roleType;
            role.persist();
        }
        return member;
    }

    @Transactional
    public void delete(Long chamaId, Long memberId) {
        Member member = get(chamaId, memberId);
        memberRoleRepository.delete("member.id", memberId);
        memberRepository.delete(member);
    }
}
