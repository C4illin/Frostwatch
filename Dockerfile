FROM oven/bun AS builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN bun install
COPY . .
RUN bun build server.js --compile --minify --bytecode --outfile dist

FROM gcr.io/distroless/cc
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./

EXPOSE 3000
CMD [ "/usr/src/app/dist" ]
