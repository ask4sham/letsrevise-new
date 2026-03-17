# Render Uptime & Cold Start Guide

## Why Render Cold Starts Happen

On Render's **free tier**, web services spin down after ~15 minutes of inactivity. The first request after spin-down triggers a cold start, which can take **30–60 seconds**. During this time, requests may timeout or appear to fail.

Paid plans keep services running and avoid this behaviour.

## Keeping the Backend Warm (Optional)

To reduce cold-start delays, use an external uptime monitor to ping the health endpoint at regular intervals.

### Recommended Uptime Monitor Services

| Service | Free Tier | Notes |
|---------|-----------|-------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-min interval | Popular, easy setup |
| [Better Stack](https://betterstack.com) | Generous free tier | Good for monitoring + status pages |
| [Cron-job.org](https://cron-job.org) | Free cron jobs | Simple HTTP ping |

### Suggested Configuration

- **Ping URL:** `https://letsrevise-new.onrender.com/api/health`
- **Interval:** Every 10 minutes (or 5 minutes if the service allows)
- **Method:** GET
- **Expected response:** HTTP 200 with `{"status":"OK",...}`

### Setup Example (UptimeRobot)

1. Create a new monitor
2. Monitor type: HTTP(s)
3. URL: `https://letsrevise-new.onrender.com/api/health`
4. Monitoring interval: 5 or 10 minutes
5. Save

### Notes

- This is **optional** and depends on your Render plan and traffic patterns.
- Free-tier monitors may have limits on check frequency.
- Cold starts are less of an issue once you move to a paid Render plan.
