# Key Pickup Reminder

The `/keypickupreminder` command lets officers schedule a reminder to pick up a key before an event. The bot pings the specified user (if not specified, the person who sent the command) in their committee's Discord channel one hour before the event time.

## Usage

```
/keypickupreminder DateTime:<dd/mm/yyyy hh:mm> [User:<@username>]
```

The datetime is interpreted in the **America/Los_Angeles** timezone.

Requires **Officer** privilege or above.

## How It Works

### Channel Resolution

The bot determines which channel to send the reminder in by inspecting the target user's roles:

1. **Committee roles** are checked first. The channel name is derived from the committee name (e.g., the **Finance & Facilities** role maps to `#finance-facilities`, **Design & Publicity** maps to `#design-publicity`).
2. If no committee role is found, the **@Exec** role is checked, mapping to `#exec`.
3. If the user has no committee or exec role, the command fails with an error.

### Scheduling & Persistence

Reminders are stored in **MongoDB** (collection: `keyPickupReminders`) so they survive bot restarts and redeployments. The scheduling flow:

1. On command invocation, a reminder document is created in the database and a `setTimeout` is queued in-process.
2. On bot startup, all pending reminders are loaded from the database and their timeouts are re-scheduled.
3. When a timeout fires, the bot sends the reminder message, then deletes the document.

If the event is **less than one hour away**, the reminder fires immediately.

> [!IMPORTANT]
>
> Node.js `setTimeout` has a maximum delay of ~24.8 days. For reminders further out, the service chains intermediate timeouts automatically — no action needed, but be aware the mechanism exists if debugging timer behavior.

### Reminder Message

The message sent in the channel looks like:

> @user, remember to pick up the key for the event at Jun 25, 2025 2:00 PM!

The timestamp uses Discord's `<t:unix:f>` format, so it renders in each reader's local timezone.

## Source Files

| File | Purpose |
| ---- | ------- |
| [key-pickup-reminder.command.ts](../src/features/committee/key-pickup-reminder.command.ts) | Slash command handler |
| [key-pickup-reminder.service.ts](../src/services/key-pickup-reminder.service.ts) | Scheduling service (timeouts + DB) |
| [key-pickup-reminder.model.ts](../src/models/key-pickup-reminder.model.ts) | Mongoose model |
| [ready.listener.ts](../src/bot/listeners/ready.listener.ts) | Startup hook that reloads pending reminders |
