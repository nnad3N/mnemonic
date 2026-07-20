# syntax=docker/dockerfile:1

FROM denoland/deno:debian-2.9.3

ENV DENO_DIR=/deno-dir
ENV DENO_NO_PROMPT=1
ENV DENO_NO_UPDATE_CHECK=1

WORKDIR /app

COPY deno.json deno.lock package.json ./
RUN deno ci

COPY . .

RUN SKIP_ENV_VALIDATION=1 deno task build

RUN mkdir -p /data

EXPOSE 3000

CMD ["sh", "-c", "deno task db:push && exec deno task preview --host 0.0.0.0 --port 3000"]
