package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.CreateMeetingDto;
import org.chama.dto.MeetingAttendanceDto;
import org.chama.dto.MeetingDto;
import org.chama.dto.RecordAttendanceDto;
import org.chama.dto.UpdateMeetingMinutesDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.MeetingService;

import java.util.List;

@Path("/api/chamas/{chamaId}/meetings")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MeetingResource {

    @Inject
    MeetingService meetingService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<MeetingDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return meetingService.listForChama(chamaId).stream().map(MeetingDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public MeetingDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return MeetingDto.from(meetingService.get(chamaId, id));
    }

    /** SECRETARY/CHAIRPERSON-only: schedule a meeting with its agenda. */
    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreateMeetingDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.SECRETARY, MemberRoleType.CHAIRPERSON);
        var meeting = meetingService.create(chamaId, dto);
        return Response.status(Response.Status.CREATED).entity(MeetingDto.from(meeting)).build();
    }

    /** SECRETARY/CHAIRPERSON-only: fill in the minutes after the meeting. */
    @PUT
    @Path("/{id}/minutes")
    public MeetingDto updateMinutes(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid UpdateMeetingMinutesDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.SECRETARY, MemberRoleType.CHAIRPERSON);
        return MeetingDto.from(meetingService.updateMinutes(chamaId, id, dto.minutes()));
    }

    @GET
    @Path("/{id}/attendance")
    public List<MeetingAttendanceDto> attendance(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return meetingService.getAttendance(chamaId, id).stream().map(MeetingAttendanceDto::from).toList();
    }

    /** SECRETARY/CHAIRPERSON-only: record (or update) one member's attendance for this meeting. */
    @PUT
    @Path("/{id}/attendance/{memberId}")
    public MeetingAttendanceDto recordAttendance(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
                                                  @PathParam("memberId") Long memberId, @Valid RecordAttendanceDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.SECRETARY, MemberRoleType.CHAIRPERSON);
        return MeetingAttendanceDto.from(meetingService.recordAttendance(chamaId, id, memberId, dto.status()));
    }
}
