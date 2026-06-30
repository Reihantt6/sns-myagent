# SNS-MyAgent Dockerfile — minimal runtime image
# Uses prebuilt linux-x64 binary from GitHub Releases
# Build: docker build -t ghcr.io/reihantt6/sns-myagent:latest .
# Run:   docker run -it --rm ghcr.io/reihantt6/sns-myagent chat

# ─── Stage 1: Download prebuilt binary ────────────────────────────────────────
FROM alpine:3.20 AS fetcher
ARG VERSION=0.3.0
ARG TARGETARCH=amd64
RUN apk add --no-cache curl ca-certificates
RUN mkdir -p /out && \
    case "${TARGETARCH}" in \
        amd64) BIN="snsagent-linux-x64" ;; \
        arm64) BIN="snsagent-linux-arm64" ;; \
        *) echo "Unsupported arch: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    curl -fsSL \
      "https://github.com/Reihantt6/sns-myagent/releases/download/v${VERSION}/${BIN}" \
      -o "/out/snsagent" && \
    chmod +x /out/snsagent

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates bash tini
COPY --from=fetcher /out/snsagent /usr/local/bin/snsagent
RUN snsagent --version || true

WORKDIR /workspace
VOLUME ["/workspace", "/root/.sns-myagent"]
ENV PATH="/usr/local/bin:${PATH}"
ENV SNS_TELEGRAM_AUTOSTART=0
ENTRYPOINT ["/sbin/tini", "--", "snsagent"]
CMD ["chat"]

# Default labels
LABEL org.opencontainers.image.title="sns-myagent"
LABEL org.opencontainers.image.description="Pi Agent size, full features. BYOK coding agent CLI."
LABEL org.opencontainers.image.source="https://github.com/Reihantt6/sns-myagent"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="${VERSION}"