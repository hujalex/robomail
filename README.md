Robomail - AgentMail Clone

Robomail serves to provide an API interface enabling agents and humans alike to deploy and manage email inboxes programmatically. Robomail manages the underlying infrastructure


Database
We leverage NeonDB to store required information including accounts, inboxes, messages, and message threads


Mailing Service
- Resend provides an inbound email service that makes a POST request to our API server whenever an email address receives a new message. Our API Server contains a webhook to process the POST request on-demand.
- Resend furthermore provides an outbound email service that allows us to send emails to other email addresses

Software Development Kit (SDK)

Robomail's HTTP API server follows the OpenAPI standard enabling straightforward SDK generation in TypeScript through fern. The SDK provides an interface to programmatically interact with the robomail HTTP API server to manage agent inboxes.


Sending Emails


Receiving Emails
