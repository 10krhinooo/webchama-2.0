package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.ArrearsBucketDto;
import org.chama.dto.ChamaHealthDto;
import org.chama.dto.ContributionTrendPointDto;
import org.chama.dto.LoanPortfolioSliceDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.AnalyticsService;

import java.util.List;

/**
 * Chama analytics.
 *
 * <p>Gated on CHAIRPERSON or TREASURER throughout, with one exception. Arrears and the loan
 * portfolio are per-member debt however they are aggregated, and the health score is built from
 * them, so all three are treasury information rather than something every member may browse. The
 * contribution trend is money in and out of the chama as a whole with no member in it, which is
 * exactly what a secretary presents at a meeting, so that one endpoint admits SECRETARY too.
 *
 * <p>There is deliberately no requireMembership variant anywhere here.
 */
@Path("/api/chamas/{chamaId}/analytics")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AnalyticsResource {

    private static final int DEFAULT_TREND_MONTHS = 12;

    @Inject
    AnalyticsService analyticsService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    @Path("/health")
    public ChamaHealthDto health(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return analyticsService.health(chamaId);
    }

    /** The one endpoint a secretary can read, see the class comment. */
    @GET
    @Path("/contribution-trend")
    public List<ContributionTrendPointDto> contributionTrend(
            @PathParam("chamaId") Long chamaId,
            @QueryParam("months") @DefaultValue("" + DEFAULT_TREND_MONTHS) int months) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON,
            MemberRoleType.TREASURER, MemberRoleType.SECRETARY);
        return analyticsService.contributionTrend(chamaId, months);
    }

    @GET
    @Path("/arrears")
    public List<ArrearsBucketDto> arrears(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return analyticsService.arrears(chamaId);
    }

    @GET
    @Path("/loan-portfolio")
    public List<LoanPortfolioSliceDto> loanPortfolio(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER);
        return analyticsService.loanPortfolio(chamaId);
    }
}
