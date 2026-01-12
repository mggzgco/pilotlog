# Deploy FlightTraks with GoDaddy (DNS) + AWS (app server)

This repo is a **single Next.js application** that includes:
- server-rendered UI (Next.js App Router)
- API routes (`app/api/*`) used by the UI
- authentication (Lucia) + server actions
- Prisma + PostgreSQL
- file uploads stored on disk by default (`/uploads`)

Because of that, you generally **should not split “frontend on GoDaddy” and “backend on AWS”** unless you are willing to refactor the app into two separate projects.

The recommended model is:
- **GoDaddy**: domain registrar + DNS
- **AWS**: runs the **entire Next.js app** (frontend + API) as the “application server”

## Recommended architecture

- **Compute**: ECS Fargate (or App Runner) running the Docker image from this repo
- **Database**: Amazon RDS PostgreSQL
- **File uploads**: Amazon EFS mounted into the container (recommended), or single-instance local storage (not recommended)
- **TLS**: ACM certificate + ALB (or CloudFront in front of ALB)
- **Secrets**: SSM Parameter Store or Secrets Manager

## 1) GoDaddy: DNS setup

### Option A (recommended): move DNS hosting to Route 53
- Keep the domain registered in GoDaddy.
- Create a public hosted zone in Route 53.
- In GoDaddy, change **nameservers** to the Route 53 nameservers.

This makes AWS load balancer / CloudFront integrations much easier.

### Option B: keep GoDaddy DNS, point a subdomain to AWS
If you keep GoDaddy DNS, use a subdomain like `app.yourdomain.com`:
- Create your AWS load balancer / CloudFront distribution.
- Add a **CNAME** in GoDaddy: `app` → `<ALB DNS name>` (or CloudFront domain).

Note: GoDaddy generally cannot CNAME the apex/root domain (`yourdomain.com`) to an ALB. Use `app.` or switch to Route 53.

## 2) AWS: create PostgreSQL (RDS)

1. Create an RDS Postgres instance (or Aurora Postgres).
2. Put it in private subnets.
3. Create a security group allowing inbound Postgres **only** from your ECS/App Runner security group.
4. Record the connection string:

`DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public`

## 3) AWS: uploads persistence (EFS)

The app stores receipts/photos on disk using `UPLOAD_DIR`.

Recommended:
1. Create an EFS file system.
2. Create mount targets in the same VPC/subnets as your service.
3. Mount EFS into your container at e.g. `/mnt/efs`.
4. Set:

- `UPLOAD_DIR=/mnt/efs/uploads`

This preserves uploads across deploys and task restarts.

## 4) Build and push the container image (ECR)

1. Create an ECR repo: `flighttraks`
2. Build and tag:

```bash
docker build -t flighttraks:latest .
docker tag flighttraks:latest <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/flighttraks:latest
```

3. Login and push:

```bash
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/flighttraks:latest
```

## 5) Deploy to ECS Fargate (ALB)

### Task definition env vars
Set these environment variables (as secrets where appropriate):

- **Core**
  - `NODE_ENV=production`
  - `PORT=3000`
  - `DATABASE_URL=...` (secret)
  - `NEXT_ALLOWED_ORIGINS=app.yourdomain.com` (comma-separated if multiple)
  - `UPLOAD_DIR=/mnt/efs/uploads` (if using EFS)

- **AeroAPI**
  - `AEROAPI_KEY=...` (secret)

- **Email**
  - `SMTP_HOST=...`
  - `SMTP_PORT=...`
  - `SMTP_USER=...`
  - `SMTP_PASS=...` (secret)
  - `MAIL_FROM=...` (optional)

### Migrations
Recommended approach:
- Run migrations as a **one-off ECS task** using the same image:
  - command: `npm run db:migrate`

If you are running a **single instance only**, you can set:
- `RUN_MIGRATIONS=1`

But don’t do that for multi-instance scaling (race conditions).

### Load balancer
- ALB listener 443 → target group → container port 3000
- Health check path: `/` (or add a dedicated health route later)

## 6) TLS (ACM)

- If using ALB directly: request ACM cert in the **same region** as the ALB.
- If using CloudFront: request ACM cert in **us-east-1**.

## 7) Verify production behavior

- Create a user, log in, verify sessions persist.
- Upload a receipt/photo and confirm it’s stored under the EFS path.
- Confirm CSP doesn’t block map tiles (OpenStreetMap) on your domain.
- Confirm checklists, logbook, and flight import work under your production URL.

## If you truly need “GoDaddy-hosted frontend + AWS API”

That requires a bigger refactor because the UI currently depends on Next.js server rendering + same-origin API routes.
You would need to:
- move all API routes to a separate backend (Express/Nest/Fastify, etc.)
- convert the Next app to a standalone SPA (or rebuild it) that talks to that API via CORS
- implement cross-origin auth/session strategy

That’s doable, but it’s a different architecture than this repository is currently built for.

