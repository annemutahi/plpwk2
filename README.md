# Solstice Check-In Kiosk
This is a minimal, runnable version of the pivot. 
Uses RabbitMQ and a webhook

## Concept
Kiosk publishes a message to print_requests.
Printer consumes the message, prints then POSTs a webhook back to the kiosk.
A duplicate scan is checked against stored state (not_checked_in / pending / checked_in) before publishing, and the webhook re-validates against a jobId before accepting a confirmation.

## Running the system
1. Start RabbitMQ -> docker compose up -d
2. Start kiosk in one terminal -> cd kiosk, npm install, npm start
3. Start printer in another terminal -> cd printer, npm install, npm start

## Testing
Attendees available: 1,2,3.
Scan 1 -> curl -X POST http://localhost:3000/scan/1
Check terminal printout
Immediately scan same attendee, status should be 'pending'.
After a few seconds, status changes to 'checked-in' and you get an error.

Repeat same process for attendee 2 and 3.

To see every attendees state, write 'curl http://localhost:3000/status' in terminal