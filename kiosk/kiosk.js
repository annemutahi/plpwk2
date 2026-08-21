import express from 'express';
import amqp from 'amqplib';
import {randomUUID} from 'crypto';

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'print_queue';

const app = express();
app.use(express.json());

const attendees = new Map([
    ['1', { id: '1', name: 'Anne', status: 'not printed', currentjobId: null }],
    ['2', { id: '2', name: 'Bella', status: 'not printed', currentjobId: null }],
    ['3', { id: '3', name: 'Luna', status: 'not printed', currentjobId: null }]
]);

let channel;

async function connectRabbit() {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ. Queue asserted:', QUEUE_NAME);
}

app.post('/scan/:attendeeId', async (req, res) => {
    const attendeeId = req.params.attendeeId;
    const attendee = attendees.get(attendeeId);

    if (!attendee) {
        return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.status === 'checked_in') {
        return res.status(400).json({ error: 'Attendee already checked in' });
    }

    if (attendee.status === 'pending') {
        return res.status(400).json({ error: 'Print job already pending for this attendee', jobId: attendee.currentjobId });
    }

    const jobId = randomUUID();
    attendee.status = 'pending';
    attendee.currentjobId = jobId;

    const message = {
        jobId,
        attendeeId,
        name: attendee.name,
        requestedAt: new Date().toISOString()
    };

    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { persistent: true });

    console.log(`Print job created for attendee ${attendee.name} (${attendeeId}), job ${jobId}`);

    res.json({ message: 'Print job created', jobId });
});

app.post('/kiosk-webhook/print', (req, res) => {
    const { jobId, attendeeId, status } = req.body;

    const attendee = attendees.get(attendeeId);

    if (!attendee) {
        return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.currentjobId !== jobId) {
        console.log(`Ignoring stale/duplicate confirmation for job ${jobId} (attendee is on job ${attendee.currentjobId})`);
        return res.status(200).json({ message: 'Stale or duplicate job ignored' });
    }

    if (attendee.status === 'checked_in') {
        return res.status(400).json({ error: 'Attendee already checked in' });
    }

    if (status === 'success') {
        attendee.status = 'checked_in';
        console.log(`Checked in: ${attendee.name} (${attendeeId}) - job ${jobId}`);
    } else {
        attendee.status = 'not_checked_in';
        attendee.currentjobId = null;
        console.log(`Print failed for ${attendeeId}, job ${jobId}. Attendee may re-scan.`);
    }

    res.json({ ok: true });
});
 
    app.get('/status/:attendeeId', (req, res) => {
    const attendee = attendees.get(req.params.attendeeId);
    if (!attendee) return res.status(404).json({ error: 'Unknown attendee' });
    res.json(attendee);
    });
    
    app.get('/status', (_req, res) => {
    res.json(Array.from(attendees.values()));
    });
    
    connectRabbit()
    .then(() => {
        app.listen(PORT, () => console.log(`Kiosk service listening on :${PORT}`));
    })
    .catch((err) => {
        console.error('Failed to connect to RabbitMQ', err);
        process.exit(1);
    });
