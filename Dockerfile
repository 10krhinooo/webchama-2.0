# Self-contained backend image: `docker build .` from a fresh checkout produces a runnable
# container with no separate `mvnw package` step first (audit finding P1-10, closes the gap
# between a green CI build and something you can actually run). See DEPLOYMENT.md for the runtime
# environment variables this image needs and frontend/Dockerfile for the SPA's own image.

FROM maven:3-eclipse-temurin-26 AS build
WORKDIR /workspace

# Dependency layer first so `docker build` can cache it across source-only changes.
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src src

# application.properties is gitignored (it's where real per-developer secrets get copied to
# locally, see README's "Getting started"), so a fresh checkout never has one. The build only
# needs *some* file to exist here for Quarkus's build-time properties (Flyway locations, Hibernate
# DDL mode); every value that actually matters in a real deployment is a %prod.* override read
# from an environment variable at runtime (KEYCLOAK_URL, MPESA_*, FLUTTERWAVE_*, MAIL_*, etc, see
# application.properties), not baked into the image.
RUN test -f src/main/resources/application.properties || \
    cp src/main/resources/example.application.properties src/main/resources/application.properties

RUN mvn -B -q -DskipTests package

# Same UBI9 OpenJDK 21 runtime base and /deployments layout Quarkus's own scaffolded
# src/main/docker/Dockerfile.jvm uses, kept in sync with it deliberately.
FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:1.24

ENV LANGUAGE='en_US:en'

COPY --chown=185 --from=build /workspace/target/quarkus-app/lib/ /deployments/lib/
COPY --chown=185 --from=build /workspace/target/quarkus-app/*.jar /deployments/
COPY --chown=185 --from=build /workspace/target/quarkus-app/app/ /deployments/app/
COPY --chown=185 --from=build /workspace/target/quarkus-app/quarkus/ /deployments/quarkus/

EXPOSE 8080
USER 185
ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"

ENTRYPOINT [ "/opt/jboss/container/java/run/run-java.sh" ]
