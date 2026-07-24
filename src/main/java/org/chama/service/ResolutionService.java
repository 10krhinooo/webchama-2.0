package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ResolutionStatus;
import org.chama.domain.enums.VoteChoice;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.Member;
import org.chama.domain.model.Resolution;
import org.chama.domain.model.ResolutionVote;
import org.chama.dto.CreateResolutionDto;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.ResolutionRepository;
import org.chama.repository.ResolutionVoteRepository;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class ResolutionService {

    @Inject
    ResolutionRepository resolutionRepository;

    @Inject
    ResolutionVoteRepository resolutionVoteRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    public List<Resolution> listForChama(Long chamaId) {
        return resolutionRepository.findByChama(chamaId);
    }

    public Resolution get(Long chamaId, Long resolutionId) {
        Resolution resolution = resolutionRepository.findByIdOptional(resolutionId).orElseThrow(NotFoundException::new);
        if (!resolution.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return resolution;
    }

    public List<ResolutionVote> getVotes(Long chamaId, Long resolutionId) {
        get(chamaId, resolutionId);
        return resolutionVoteRepository.findByResolution(resolutionId);
    }

    public long countVotes(Long resolutionId, VoteChoice choice) {
        return resolutionVoteRepository.countByResolutionAndChoice(resolutionId, choice);
    }

    /** SECRETARY/CHAIRPERSON-only: opens a resolution against a meeting of this chama. */
    @Transactional
    public Resolution open(Long chamaId, CreateResolutionDto dto, Long openedByMemberId) {
        Meeting meeting = meetingRepository.findByIdOptional(dto.meetingId()).orElseThrow(NotFoundException::new);
        if (!meeting.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        Member openedBy = memberRepository.findByIdOptional(openedByMemberId).orElseThrow(NotFoundException::new);

        Resolution resolution = new Resolution();
        resolution.chama = chamaService.get(chamaId);
        resolution.meeting = meeting;
        resolution.title = dto.title();
        resolution.description = dto.description();
        resolution.openedBy = openedBy;
        resolutionRepository.persist(resolution);

        activityLogService.log(resolution.chama, ActivityEventType.RESOLUTION_OPENED,
            openedBy.fullName + " opened resolution \"" + resolution.title + "\"");
        return resolution;
    }

    /** Any member votes once for their own membership, while the resolution is still OPEN. */
    @Transactional
    public ResolutionVote castVote(Long chamaId, Long resolutionId, Long memberId, VoteChoice choice) {
        Resolution resolution = get(chamaId, resolutionId);
        if (resolution.status != ResolutionStatus.OPEN) {
            throw new BadRequestException("Resolution is not open for voting");
        }
        if (resolutionVoteRepository.findByResolutionAndMember(resolutionId, memberId).isPresent()) {
            throw new BadRequestException("You have already voted on this resolution");
        }
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);

        ResolutionVote vote = new ResolutionVote();
        vote.resolution = resolution;
        vote.member = member;
        vote.choice = choice;
        resolutionVoteRepository.persist(vote);
        return vote;
    }

    /** SECRETARY/CHAIRPERSON-only: tallies the votes and moves a resolution from OPEN to its final status. */
    @Transactional
    public Resolution close(Long chamaId, Long resolutionId) {
        Resolution resolution = get(chamaId, resolutionId);
        if (resolution.status != ResolutionStatus.OPEN) {
            throw new BadRequestException("Only an open resolution can be closed");
        }

        long forVotes = resolutionVoteRepository.countByResolutionAndChoice(resolutionId, VoteChoice.FOR);
        long againstVotes = resolutionVoteRepository.countByResolutionAndChoice(resolutionId, VoteChoice.AGAINST);

        resolution.status = forVotes > againstVotes ? ResolutionStatus.PASSED : ResolutionStatus.REJECTED;
        resolution.closedAt = Instant.now();

        activityLogService.log(resolution.chama, ActivityEventType.RESOLUTION_CLOSED,
            "Resolution \"" + resolution.title + "\" closed as " + resolution.status);
        return resolution;
    }
}
