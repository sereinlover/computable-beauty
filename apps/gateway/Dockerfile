# Build context is the repo root — go.mod's `replace .../contracts =>
# ../../contracts` needs that directory on disk alongside apps/gateway.

FROM golang:1.26-alpine AS build
WORKDIR /src

# In mainland China, proxy.golang.org can be unreachable — uncomment to use
# a China mirror instead.
# ENV GOPROXY="https://goproxy.cn,direct"

# contracts/ first, then gateway's go.mod/go.sum, so `go mod download`
# layer-caches independently of application source changes.
COPY contracts/ ./contracts/
COPY apps/gateway/go.mod apps/gateway/go.sum ./apps/gateway/
WORKDIR /src/apps/gateway
RUN go mod download

WORKDIR /src
COPY apps/gateway/ ./apps/gateway/
WORKDIR /src/apps/gateway
RUN CGO_ENABLED=0 go build -o /out/gateway ./cmd

FROM alpine:3.22
RUN addgroup -S gateway && adduser -S gateway -G gateway

# Pre-create and chown the upload volume's mount point — a fresh named volume
# inherits the image's ownership at that path, and without this it'd be
# root-owned, unwritable by the non-root `gateway` user below.
RUN mkdir -p /data/uploads && chown -R gateway:gateway /data/uploads

WORKDIR /app
COPY --from=build --chown=gateway:gateway /out/gateway .
USER gateway

ENTRYPOINT ["/app/gateway"]
