# Architecture rules
- Keep the owner panel isolated under /admin, with Cloud sessions and server-validated roles; the legacy client login must never grant administrative privileges.
- Use existing subscriptions and Kiwify events as revenue sources alongside manual purchases, deduplicating external order IDs; simulated checkout is never a revenue source.
- Expose only allowlisted public settings through a read-only function; administrative tables remain admin-only under RLS.
- Track authenticated tool workspace openings as usage sessions and heartbeat activity separately; do not imply completed processing or anonymous users are tracked.
- Keep shared client presentation unchanged and apply published settings through a provider and route boundary.