package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.ChamaDto;
import org.chama.dto.ChamaReminderSettingsDto;
import org.chama.dto.CreateChamaDto;
import org.chama.dto.InviteToChamaDto;
import org.chama.dto.JoinChamaDto;
import org.chama.dto.MemberDto;
import org.chama.dto.MyChamaDto;
import org.chama.dto.SavingsProgressDto;
import org.chama.dto.UpdateAutoPushSettingsDto;
import org.chama.dto.UpdateChamaDto;
import org.chama.dto.UpdateChamaReminderSettingsDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ChamaService;
import org.chama.service.ContributionReminderService;
import org.chama.service.MemberService;
import org.chama.service.notification.ChamaInvitationEmailService;

import java.util.List;

@Path("/api/chamas")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ChamaResource {

    @Inject
    ChamaService chamaService;

    @Inject
    ContributionReminderService contributionReminderService;

    @Inject
    MemberService memberService;

    @Inject
    ChamaInvitationEmailService chamaInvitationEmailService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<ChamaDto> list() {
        return chamaService.listForUser(currentUser).stream().map(ChamaDto::from).toList();
    }

    @GET
    @Path("/mine")
    public List<MyChamaDto> mine() {
        return chamaService.listMineWithRoles(currentUser);
    }

    @GET
    @Path("/{id}")
    public ChamaDto get(@PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, id);
        return ChamaDto.from(chamaService.get(id));
    }

    @GET
    @Path("/{id}/savings-progress")
    public SavingsProgressDto savingsProgress(@PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, id);
        return chamaService.getSavingsProgress(id);
    }

    @POST
    public Response create(@Valid CreateChamaDto dto) {
        var chama = chamaService.create(dto, currentUser);
        return Response.status(Response.Status.CREATED).entity(ChamaDto.from(chama)).build();
    }

    @PUT
    @Path("/{id}")
    public ChamaDto update(@PathParam("id") Long id, @Valid UpdateChamaDto dto) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        return ChamaDto.from(chamaService.update(id, dto));
    }

    @PUT
    @Path("/{id}/auto-push-settings")
    public ChamaDto updateAutoPushSettings(@PathParam("id") Long id, @Valid UpdateAutoPushSettingsDto dto) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return ChamaDto.from(chamaService.updateAutoPushSettings(id, dto));
    }

    @GET
    @Path("/{id}/reminder-settings")
    public ChamaReminderSettingsDto reminderSettings(@PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return ChamaReminderSettingsDto.from(contributionReminderService.getOrCreate(id));
    }

    /**
     * Same gate as the auto-push settings above: both decide what the application sends to members
     * on their behalf, so both are a chairperson or treasurer call.
     */
    @PUT
    @Path("/{id}/reminder-settings")
    public ChamaReminderSettingsDto updateReminderSettings(@PathParam("id") Long id,
                                                           @Valid UpdateChamaReminderSettingsDto dto) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return ChamaReminderSettingsDto.from(contributionReminderService.update(
            id, dto.enabled(), dto.daysBeforeDue(), dto.overdueEveryDays(), dto.sendHour()));
    }

    /** Self-service: redeem another chama's join code to become a MEMBER there. Issue #170. */
    @POST
    @Path("/join")
    public Response join(@Valid JoinChamaDto dto) {
        var member = memberService.joinViaCode(dto, currentUser);
        return Response.status(Response.Status.CREATED)
            .entity(MemberDto.from(member, memberService.rolesOf(member.id)))
            .build();
    }

    @POST
    @Path("/{id}/join-code/regenerate")
    public ChamaDto regenerateJoinCode(@PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        return ChamaDto.from(chamaService.regenerateJoinCode(id));
    }

    /** Chairperson emails the chama's current join code to a prospective member. Issue #170. */
    @POST
    @Path("/{id}/join-code/invite")
    public Response inviteByEmail(@PathParam("id") Long id, @Valid InviteToChamaDto dto) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        var chama = chamaService.get(id);
        chamaInvitationEmailService.sendJoinInvite(dto.email(), chama.name, chama.joinCode);
        return Response.accepted().build();
    }

    /**
     * The chama's logo, used on the documents it issues.
     *
     * <p>Uploaded as raw bytes rather than multipart: the frontend already reads a file into memory
     * to preview it, and multipart would add a binding and a config flag for no gain.
     *
     * <p>The declared content type is not trusted. A PNG or JPEG is identified by its own leading
     * bytes, so a file that says image/png and is not one is rejected here rather than served back
     * to every member with that content type on it.
     */
    private static final int MAX_LOGO_BYTES = 256 * 1024;

    @PUT
    @Path("/{id}/logo")
    @Consumes({"image/png", "image/jpeg"})
    public ChamaDto uploadLogo(@PathParam("id") Long id, @HeaderParam("Content-Type") String contentType, byte[] body) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        if (body == null || body.length == 0) {
            throw new BadRequestException("No image was uploaded.");
        }
        if (body.length > MAX_LOGO_BYTES) {
            throw new BadRequestException("A logo must be 256KB or smaller. Try a smaller image.");
        }
        String detected = detectImageType(body);
        if (detected == null) {
            throw new BadRequestException("That file is not a PNG or a JPEG.");
        }
        return ChamaDto.from(chamaService.setLogo(id, body, detected));
    }

    @GET
    @Path("/{id}/logo")
    @Produces({"image/png", "image/jpeg"})
    public Response logo(@PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, id);
        var chama = chamaService.get(id);
        if (chama.logoBytes == null || chama.logoBytes.length == 0) {
            throw new NotFoundException();
        }
        return Response.ok(chama.logoBytes, chama.logoContentType)
            // Short and private: a logo changes rarely, but it is only for this chama's members.
            .header("Cache-Control", "private, max-age=300")
            .build();
    }

    @DELETE
    @Path("/{id}/logo")
    public ChamaDto deleteLogo(@PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        return ChamaDto.from(chamaService.clearLogo(id));
    }

    /** The image's own leading bytes, which is the only thing about its type that cannot be faked. */
    private static String detectImageType(byte[] body) {
        if (body.length >= 8 && (body[0] & 0xFF) == 0x89 && body[1] == 'P' && body[2] == 'N' && body[3] == 'G') {
            return "image/png";
        }
        if (body.length >= 3 && (body[0] & 0xFF) == 0xFF && (body[1] & 0xFF) == 0xD8 && (body[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        chamaService.delete(id);
        return Response.noContent().build();
    }
}
