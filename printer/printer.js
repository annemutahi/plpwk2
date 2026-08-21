import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'print_queue';
const KIOSK_WEBHOOK_URL = 'http://localhost:3000/kiosk-webhook/print';

async function start() {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });


channel.prefetch(1);

console.log(`Printer waiting for jobs...`);

channel.consume(
    QUEUE_NAME, async (msg) => {
    if (!msg) return;
        const job = JSON.parse(msg.content.toString());
        console.log(`Received print job: ${job.name} (${job.attendeeId}), job ${job.jobId}`);

        const duration = 1000 + Math.random() * 2000;
        const succeed = Math.random() > 0.05;

        setTimeout(async () => {
            try{
                await fetch(KIOSK_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jobId: job.jobId,
                        attendeeId: job.attendeeId,
                        status: succeed ? 'success' : 'failure',
                    }),
                });
                
                channel.ack(msg);
                console.log(`Print job ${job.jobId} completed with status: ${succeed ? 'success' : 'failure'}`);
            } catch (error) {
                console.error(`Failed to send webhook for job ${job.jobId}:`, error);
                channel.nack(msg, false, true); // Requeue the message
            }
        }, duration);
    },
    { noAck: false }
);
}

start().catch((error) => {
    console.error('Error starting printer:', error);
    process.exit(1);
});