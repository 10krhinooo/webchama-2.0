package org.chama.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;

/**
 * Minimal Keycloak Admin API client for provisioning member accounts. Only
 * carries the operations this domain actually needs: chama-scoped roles are
 * never Keycloak roles (see TenantAccessService), so this never assigns
 * realm roles on user creation.
 */
@ApplicationScoped
public class KeycloakAdminService {

    @ConfigProperty(name = "keycloak.admin.url", defaultValue = "http://localhost:8180")
    String adminUrl;

    @ConfigProperty(name = "keycloak.admin.username", defaultValue = "admin")
    String adminUsername;

    @ConfigProperty(name = "keycloak.admin.password", defaultValue = "admin")
    String adminPassword;

    @ConfigProperty(name = "keycloak.app.realm", defaultValue = "chama")
    String appRealm;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    private String getAdminToken() throws Exception {
        String body = "grant_type=password"
            + "&client_id=" + URLEncoder.encode("admin-cli", StandardCharsets.UTF_8)
            + "&username=" + URLEncoder.encode(adminUsername, StandardCharsets.UTF_8)
            + "&password=" + URLEncoder.encode(adminPassword, StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder(
                URI.create(adminUrl + "/realms/master/protocol/openid-connect/token"))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .timeout(Duration.ofSeconds(15))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new RuntimeException("Failed to obtain Keycloak admin token: " + resp.statusCode());
        }
        return mapper.readTree(resp.body()).get("access_token").asText();
    }

    /**
     * Creates a user with a temporary password that must be changed on first
     * login. Username is set to the email, matching how members log in.
     */
    public String createUser(String email, String fullName, String tempPassword) throws Exception {
        String token = getAdminToken();
        String baseUrl = adminUrl + "/admin/realms/" + appRealm;

        String[] parts = fullName != null ? fullName.trim().split("\\s+", 2) : new String[]{"", ""};
        String firstName = parts[0];
        String lastName = parts.length > 1 ? parts[1] : "";

        ObjectNode userRep = mapper.createObjectNode();
        userRep.put("username", email);
        userRep.put("email", email);
        userRep.put("emailVerified", true);
        userRep.put("enabled", true);
        if (!firstName.isBlank()) userRep.put("firstName", firstName);
        if (!lastName.isBlank()) userRep.put("lastName", lastName);
        userRep.putArray("requiredActions").add("UPDATE_PASSWORD");

        ObjectNode cred = userRep.putArray("credentials").addObject();
        cred.put("type", "password");
        cred.put("value", tempPassword);
        cred.put("temporary", true);

        HttpRequest createReq = HttpRequest.newBuilder(URI.create(baseUrl + "/users"))
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(userRep)))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(15))
            .build();

        HttpResponse<String> createResp = http.send(createReq, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() < 200 || createResp.statusCode() >= 300) {
            throw new RuntimeException("Keycloak user creation failed: " + createResp.statusCode() + " " + createResp.body());
        }

        String location = createResp.headers().firstValue("Location")
            .orElseThrow(() -> new RuntimeException("No Location header in Keycloak response"));
        return location.substring(location.lastIndexOf('/') + 1);
    }

    /** Finds an existing account by email, so inviting the same person to a second chama reuses it. */
    public String findUserByEmail(String email) throws Exception {
        String token = getAdminToken();
        String url = adminUrl + "/admin/realms/" + appRealm + "/users?email="
            + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&exact=true";

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
            .GET()
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(15))
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new RuntimeException("Keycloak find user failed: " + resp.statusCode());
        }

        JsonNode arr = mapper.readTree(resp.body());
        if (arr.isArray() && !arr.isEmpty()) {
            return arr.get(0).get("id").asText();
        }
        return null;
    }

    public String generateTempPassword() {
        SecureRandom rng = new SecureRandom();
        String upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lower = "abcdefghijklmnopqrstuvwxyz";
        String digits = "0123456789";
        String special = "!@#$%";
        String all = upper + lower + digits + special;

        char[] password = new char[10];
        password[0] = upper.charAt(rng.nextInt(upper.length()));
        password[1] = lower.charAt(rng.nextInt(lower.length()));
        password[2] = digits.charAt(rng.nextInt(digits.length()));
        password[3] = special.charAt(rng.nextInt(special.length()));
        for (int i = 4; i < 10; i++) {
            password[i] = all.charAt(rng.nextInt(all.length()));
        }
        for (int i = password.length - 1; i > 0; i--) {
            int j = rng.nextInt(i + 1);
            char tmp = password[i];
            password[i] = password[j];
            password[j] = tmp;
        }
        return new String(password);
    }
}
